import { Router, Request, Response } from 'express';
import * as h3 from 'h3-js';
import { getSupabase } from '../utils/supabase';
import { anonymizeId } from '../utils/privacy';
import { computeRiskForCells, persistRiskResults } from '../engine/riskScorer';
import { broadcastRiskUpdate } from '../socket/socketManager';
import { dangerTapLimiter } from '../middleware/rateLimiter';

const router = Router();
const H3_RESOLUTION = 9;

router.post('/', dangerTapLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, sessionId } = req.body;

    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
      !sessionId || typeof sessionId !== 'string'
    ) {
      res.status(400).json({ error: 'Invalid danger tap payload' });
      return;
    }

    const anonId = anonymizeId(sessionId);
    const h3Index = h3.latLngToCell(lat, lng, H3_RESOLUTION);

    const supabase = getSupabase();

    const { error: insertError } = await supabase.from('danger_taps').insert({
      anon_id: anonId,
      lat,
      lng,
      h3_index: h3Index,
      location: `POINT(${lng} ${lat})`,
    });

    if (insertError) {
      console.error('[DangerTap] Insert failed:', insertError);
    }

    const riskResults = await computeRiskForCells([h3Index]);
    await persistRiskResults(riskResults);

    for (const risk of riskResults) {
      broadcastRiskUpdate(risk);
    }

    res.status(200).json({
      success: true,
      h3Index,
      message: 'Danger report recorded. Thank you for keeping others safe.',
    });
  } catch (err) {
    console.error('[DangerTap] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
