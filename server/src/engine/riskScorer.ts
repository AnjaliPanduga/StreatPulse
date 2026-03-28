import * as h3 from 'h3-js';
import { getDbPool } from '../utils/db';
import { aggregateByCell } from './collectiveIntelligence';

export interface RiskResult {
  h3Index: string;
  riskScore: number;
  riskLevel: 'safe' | 'caution' | 'high_risk';
  centerLat: number;
  centerLng: number;
  slowdownCount: number;
  rerouteCount: number;
  hesitationCount: number;
  stopClusterCount: number;
  dangerTapCount: number;
  uniqueUsers: number;
}

const WEIGHTS = {
  slowdown: 0.3,
  reroute: 0.25,
  dangerTap: 0.35,
  timeFactor: 0.1,
};

const MAX_RAW_SCORE = 50;

function getTimeMultiplier(): number {
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 6) return 1.5;
  if (hour >= 18 || hour < 7) return 1.2;
  return 1.0;
}

function classifyRisk(score: number): 'safe' | 'caution' | 'high_risk' {
  if (score >= 67) return 'high_risk';
  if (score >= 34) return 'caution';
  return 'safe';
}

export async function computeRiskForCells(h3Indices: string[]): Promise<RiskResult[]> {
  if (h3Indices.length === 0) return [];

  const aggregations = await aggregateByCell(h3Indices);
  const timeMultiplier = getTimeMultiplier();
  const results: RiskResult[] = [];

  for (const [h3Index, agg] of aggregations) {
    let rawScore =
      (agg.anomalyCounts.speed_drop * WEIGHTS.slowdown) +
      (agg.anomalyCounts.reroute * WEIGHTS.reroute) +
      (agg.dangerTaps * WEIGHTS.dangerTap) +
      (timeMultiplier * WEIGHTS.timeFactor * 10);

    // Ensure a single danger tap pushes score up to at least Caution level
    if (agg.dangerTaps >= 1 && rawScore < 20) {
      rawScore = 20;
    }

    const boostedScore = rawScore * agg.multiUserWeight;
    const normalizedScore = Math.min(Math.round((boostedScore / MAX_RAW_SCORE) * 100), 100);

    const [centerLat, centerLng] = h3.cellToLatLng(h3Index);

    results.push({
      h3Index,
      riskScore: normalizedScore,
      riskLevel: classifyRisk(normalizedScore),
      centerLat,
      centerLng,
      slowdownCount: agg.anomalyCounts.speed_drop,
      rerouteCount: agg.anomalyCounts.reroute,
      hesitationCount: agg.anomalyCounts.hesitation,
      stopClusterCount: agg.anomalyCounts.stop_cluster,
      dangerTapCount: agg.dangerTaps,
      uniqueUsers: agg.uniqueUsers,
    });
  }

  return results;
}

export async function persistRiskResults(results: RiskResult[]): Promise<void> {
  if (results.length === 0) return;

  const pool = getDbPool();

  const upserts = results.map(async r => {
    return pool.query(
      `INSERT INTO geo_cells (h3_index, risk_score, risk_level, slowdown_count, reroute_count, hesitation_count, stop_cluster_count, danger_tap_count, unique_users, center_lat, center_lng, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (h3_index) DO UPDATE SET
         risk_score = EXCLUDED.risk_score,
         risk_level = EXCLUDED.risk_level,
         slowdown_count = EXCLUDED.slowdown_count,
         reroute_count = EXCLUDED.reroute_count,
         hesitation_count = EXCLUDED.hesitation_count,
         stop_cluster_count = EXCLUDED.stop_cluster_count,
         danger_tap_count = EXCLUDED.danger_tap_count,
         unique_users = EXCLUDED.unique_users,
         center_lat = EXCLUDED.center_lat,
         center_lng = EXCLUDED.center_lng,
         updated_at = EXCLUDED.updated_at`,
      [r.h3Index, r.riskScore, r.riskLevel, r.slowdownCount, r.rerouteCount, r.hesitationCount, r.stopClusterCount, r.dangerTapCount, r.uniqueUsers, r.centerLat, r.centerLng, new Date().toISOString()]
    );
  });

  try {
    await Promise.all(upserts);
  } catch (err) {
    console.error('[RiskScorer] Upsert failed:', err);
  }
}

export async function getAllActiveRisks(): Promise<RiskResult[]> {
  const pool = getDbPool();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { rows } = await pool.query(
    'SELECT * FROM geo_cells WHERE updated_at >= $1 ORDER BY risk_score DESC',
    [cutoff]
  );

  return (rows || []).map((r: any) => ({
    h3Index: r.h3_index,
    riskScore: r.risk_score,
    riskLevel: r.risk_level,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    slowdownCount: r.slowdown_count,
    rerouteCount: r.reroute_count,
    hesitationCount: r.hesitation_count,
    stopClusterCount: r.stop_cluster_count,
    dangerTapCount: r.danger_tap_count,
    uniqueUsers: r.unique_users,
  }));
}

export { getTimeMultiplier, classifyRisk, WEIGHTS, MAX_RAW_SCORE };
