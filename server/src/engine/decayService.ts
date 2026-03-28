import { getDbPool } from '../utils/db';
import { getActiveH3Cells } from './collectiveIntelligence';
import { computeRiskForCells, persistRiskResults } from './riskScorer';
import { getSocketManager } from '../socket/socketManager';

const SIGNAL_TTL_MS = 15 * 60 * 1000;
const STALE_CELL_TTL_MS = 20 * 60 * 1000;

export async function runDecayCycle(): Promise<{ purgedSignals: number; decayedCells: number; updatedCells: number }> {
  const pool = getDbPool();
  const cutoff = new Date(Date.now() - SIGNAL_TTL_MS).toISOString();
  const staleCutoff = new Date(Date.now() - STALE_CELL_TTL_MS).toISOString();

  const { rowCount: purgedSignals } = await pool.query('DELETE FROM raw_signals WHERE created_at <= $1', [cutoff]);
  await pool.query('DELETE FROM anomalies WHERE created_at <= $1', [cutoff]);
  await pool.query('DELETE FROM danger_taps WHERE created_at <= $1', [cutoff]);

  const { rows: staleCells } = await pool.query('SELECT h3_index FROM geo_cells WHERE updated_at <= $1', [staleCutoff]);

  const decayedCells = (staleCells || []).length;

  if (decayedCells > 0) {
    const staleIndices = staleCells.map((c: any) => c.h3_index);

    await pool.query(
      `UPDATE geo_cells SET 
        risk_score = 0, risk_level = 'safe',
        slowdown_count = 0, reroute_count = 0, hesitation_count = 0, stop_cluster_count = 0, danger_tap_count = 0, unique_users = 0,
        updated_at = $1
       WHERE h3_index = ANY($2)`,
      [new Date().toISOString(), staleIndices]
    );

    const io = getSocketManager();
    if (io) {
      for (const idx of staleIndices) {
        io.emit('risk:update', {
          h3Index: idx,
          riskScore: 0,
          riskLevel: 'safe',
          decayed: true,
        });
      }
    }
  }

  const activeCells = await getActiveH3Cells();
  let updatedCells = 0;

  if (activeCells.length > 0) {
    const results = await computeRiskForCells(activeCells);
    await persistRiskResults(results);
    updatedCells = results.length;

    const io = getSocketManager();
    if (io) {
      for (const r of results) {
        io.emit('risk:update', {
          h3Index: r.h3Index,
          riskScore: r.riskScore,
          riskLevel: r.riskLevel,
          centerLat: r.centerLat,
          centerLng: r.centerLng,
          slowdownCount: r.slowdownCount,
          rerouteCount: r.rerouteCount,
          dangerTapCount: r.dangerTapCount,
          uniqueUsers: r.uniqueUsers,
        });
      }
    }
  }

  console.log(`[Decay] Purged ${purgedSignals} signals, decayed ${decayedCells} cells, updated ${updatedCells} cells`);
  return { purgedSignals: purgedSignals || 0, decayedCells, updatedCells };
}
