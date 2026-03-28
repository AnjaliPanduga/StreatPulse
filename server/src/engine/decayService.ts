import { getSupabase } from '../utils/supabase';
import { getActiveH3Cells } from './collectiveIntelligence';
import { computeRiskForCells, persistRiskResults } from './riskScorer';
import { getSocketManager } from '../socket/socketManager';

const SIGNAL_TTL_MS = 15 * 60 * 1000;
const STALE_CELL_TTL_MS = 20 * 60 * 1000;

export async function runDecayCycle(): Promise<{ purgedSignals: number; decayedCells: number; updatedCells: number }> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - SIGNAL_TTL_MS).toISOString();
  const staleCutoff = new Date(Date.now() - STALE_CELL_TTL_MS).toISOString();

  const { data: oldSignals } = await supabase
    .from('raw_signals')
    .select('id')
    .lte('created_at', cutoff);

  const purgedSignals = (oldSignals || []).length;

  if (purgedSignals > 0) {
    await supabase
      .from('raw_signals')
      .delete()
      .lte('created_at', cutoff);
  }

  await supabase
    .from('anomalies')
    .delete()
    .lte('created_at', cutoff);

  await supabase
    .from('danger_taps')
    .delete()
    .lte('created_at', cutoff);

  const { data: staleCells } = await supabase
    .from('geo_cells')
    .select('h3_index')
    .lte('updated_at', staleCutoff);

  const decayedCells = (staleCells || []).length;

  if (decayedCells > 0) {
    const staleIndices = staleCells!.map((c: any) => c.h3_index);

    await supabase
      .from('geo_cells')
      .update({
        risk_score: 0,
        risk_level: 'safe',
        slowdown_count: 0,
        reroute_count: 0,
        hesitation_count: 0,
        stop_cluster_count: 0,
        danger_tap_count: 0,
        unique_users: 0,
        updated_at: new Date().toISOString(),
      })
      .in('h3_index', staleIndices);

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
  return { purgedSignals, decayedCells, updatedCells };
}
