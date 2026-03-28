import { getSupabase } from '../utils/supabase';

// Trust scores range from 0.1 (spammer) to 2.5 (highly verified)
const MIN_TRUST = 0.1;
const MAX_TRUST = 2.5;

export async function getTrustScores(anonIds: string[]): Promise<Map<string, number>> {
  if (anonIds.length === 0) return new Map();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('user_trust')
    .select('anon_id, trust_score')
    .in('anon_id', anonIds);

  const scores = new Map<string, number>();
  // Default everyone to 1.0 if they aren't in the DB yet
  for (const id of anonIds) {
    scores.set(id, 1.0);
  }

  if (data) {
    for (const row of data) {
      scores.set(row.anon_id, row.trust_score);
    }
  }

  return scores;
}

export async function recordCorroborationEvent(anonIds: string[]): Promise<void> {
  // If multiple users report the same danger at the same time, they all gain trust.
  if (anonIds.length < 2) return;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('user_trust')
    .select('*')
    .in('anon_id', anonIds);

  const updates = anonIds.map(id => {
    const existing = data?.find(r => r.anon_id === id);
    const prevScore = existing?.trust_score || 1.0;
    const newScore = Math.min(prevScore + 0.1, MAX_TRUST);
    
    return {
      anon_id: id,
      trust_score: newScore,
      total_reports: (existing?.total_reports || 0) + 1,
      corroborated_reports: (existing?.corroborated_reports || 0) + 1,
      last_active_at: new Date().toISOString()
    };
  });

  await supabase.from('user_trust').upsert(updates, { onConflict: 'anon_id' });
}
