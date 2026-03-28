import { getDbPool } from '../utils/db';

const MIN_TRUST = 0.1;
const MAX_TRUST = 2.5;

export async function getTrustScores(anonIds: string[]): Promise<Map<string, number>> {
  if (anonIds.length === 0) return new Map();

  const pool = getDbPool();
  const { rows } = await pool.query(
    'SELECT anon_id, trust_score FROM user_trust WHERE anon_id = ANY($1)',
    [anonIds]
  );

  const scores = new Map<string, number>();
  for (const id of anonIds) {
    scores.set(id, 1.0);
  }

  if (rows) {
    for (const row of rows) {
      scores.set(row.anon_id, row.trust_score);
    }
  }

  return scores;
}

export async function recordCorroborationEvent(anonIds: string[]): Promise<void> {
  if (anonIds.length < 2) return;

  const pool = getDbPool();
  const { rows } = await pool.query('SELECT * FROM user_trust WHERE anon_id = ANY($1)', [anonIds]);

  const updates = anonIds.map(id => {
    const existing = rows?.find((r: any) => r.anon_id === id);
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

  const upsertQueries = updates.map(async u => {
    return pool.query(
      `INSERT INTO user_trust (anon_id, trust_score, total_reports, corroborated_reports, last_active_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (anon_id) DO UPDATE SET 
         trust_score = EXCLUDED.trust_score,
         total_reports = EXCLUDED.total_reports,
         corroborated_reports = EXCLUDED.corroborated_reports,
         last_active_at = EXCLUDED.last_active_at`,
      [u.anon_id, u.trust_score, u.total_reports, u.corroborated_reports, u.last_active_at]
    );
  });
  
  await Promise.all(upsertQueries).catch(e => console.error('[TrustEngine] Upsert failed:', e));
}
