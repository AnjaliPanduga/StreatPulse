import { getSupabase } from '../utils/supabase';
import { getTrustScores, recordCorroborationEvent } from './trustEngine';

interface AnomalyCounts {
  speed_drop: number;
  reroute: number;
  hesitation: number;
  stop_cluster: number;
}

interface CellAggregation {
  h3Index: string;
  anomalyCounts: AnomalyCounts;
  uniqueUsers: number;
  dangerTaps: number;
  multiUserWeight: number;
}

const TIME_WINDOW_MS = 15 * 60 * 1000;
const MULTI_USER_THRESHOLD = 2;
const MULTI_USER_BOOST = 1.5;
const CONCURRENT_WINDOW_MS = 5 * 60 * 1000;

export async function aggregateByCell(h3Indices: string[]): Promise<Map<string, CellAggregation>> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - TIME_WINDOW_MS).toISOString();

  const results = new Map<string, CellAggregation>();

  const { data: anomalies } = await supabase
    .from('anomalies')
    .select('h3_index, anomaly_type, anon_id, severity, created_at')
    .in('h3_index', h3Indices)
    .gte('created_at', cutoff);

  const { data: taps } = await supabase
    .from('danger_taps')
    .select('h3_index, anon_id, created_at')
    .in('h3_index', h3Indices)
    .gte('created_at', cutoff);

  for (const idx of h3Indices) {
    const cellAnomalies = (anomalies || []).filter(a => a.h3_index === idx);
    const cellTaps = (taps || []).filter(t => t.h3_index === idx);

    const uniqueAnomalyUsers = new Set(cellAnomalies.map(a => a.anon_id));
    const uniqueTapUsers = new Set(cellTaps.map(t => t.anon_id));
    const allUniqueUsers = new Set([...uniqueAnomalyUsers, ...uniqueTapUsers]);

    const counts: AnomalyCounts = {
      speed_drop: cellAnomalies.filter(a => a.anomaly_type === 'speed_drop').length,
      reroute: cellAnomalies.filter(a => a.anomaly_type === 'reroute').length,
      hesitation: cellAnomalies.filter(a => a.anomaly_type === 'hesitation').length,
      stop_cluster: cellAnomalies.filter(a => a.anomaly_type === 'stop_cluster').length,
    };

    const allUniqueUsersArray = Array.from(allUniqueUsers);
    const trustScores = await getTrustScores(allUniqueUsersArray);

    let avgTrustScore = 1.0;
    if (allUniqueUsersArray.length > 0) {
      const totalTrust = allUniqueUsersArray.reduce((sum, id) => sum + (trustScores.get(id) || 1.0), 0);
      avgTrustScore = totalTrust / allUniqueUsersArray.length;
    }

    let multiUserWeight = 1.0;
    if (allUniqueUsers.size >= MULTI_USER_THRESHOLD) {
      const timestamps = [
        ...cellAnomalies.map(a => new Date(a.created_at).getTime()),
        ...cellTaps.map(t => new Date(t.created_at).getTime())
      ].sort();
      let concurrentPairs = 0;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - 1] <= CONCURRENT_WINDOW_MS) {
          concurrentPairs++;
        }
      }
      if (concurrentPairs > 0) {
        multiUserWeight = MULTI_USER_BOOST + (concurrentPairs * 0.1);
        
        // BOOST TRUST FOR THESE USERS (Fire and forget database update)
        recordCorroborationEvent(allUniqueUsersArray).catch(err => console.error('[TrustEngine] Failed to record:', err));
      }
    }

    // Apply the average trust multiplier of the participants to the final collective weight
    multiUserWeight = multiUserWeight * avgTrustScore;

    results.set(idx, {
      h3Index: idx,
      anomalyCounts: counts,
      uniqueUsers: allUniqueUsers.size,
      dangerTaps: cellTaps.length,
      multiUserWeight: Math.min(multiUserWeight, 2.5),
    });
  }

  return results;
}

export async function getActiveH3Cells(): Promise<string[]> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - TIME_WINDOW_MS).toISOString();

  const { data: anomalyCells } = await supabase
    .from('anomalies')
    .select('h3_index')
    .gte('created_at', cutoff);

  const { data: tapCells } = await supabase
    .from('danger_taps')
    .select('h3_index')
    .gte('created_at', cutoff);

  const allCells = new Set<string>();
  (anomalyCells || []).forEach(r => allCells.add(r.h3_index));
  (tapCells || []).forEach(r => allCells.add(r.h3_index));

  return Array.from(allCells);
}
