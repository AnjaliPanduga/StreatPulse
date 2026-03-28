import { Router, Request, Response } from 'express';
import * as h3 from 'h3-js';
import { getSupabase } from '../utils/supabase';
import { anonymizeId, sanitizeSignalPayload } from '../utils/privacy';
import { detectAnomalies, persistAnomalies, SignalPoint } from '../engine/anomalyDetector';
import { computeRiskForCells, persistRiskResults } from '../engine/riskScorer';
import { broadcastRiskUpdate } from '../socket/socketManager';
import { signalLimiter } from '../middleware/rateLimiter';

const router = Router();
const H3_RESOLUTION = 9;

router.post('/', signalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!sanitizeSignalPayload(req.body)) {
      res.status(400).json({ error: 'Invalid signal payload' });
      return;
    }

    const { points, sessionId } = req.body;
    const anonId = anonymizeId(sessionId);

    const supabase = getSupabase();

    const signalRows = points.map((p: SignalPoint) => ({
      anon_id: anonId,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
      heading: p.heading,
      h3_index: h3.latLngToCell(p.lat, p.lng, H3_RESOLUTION),
      location: `POINT(${p.lng} ${p.lat})`,
    }));

    const { error: signalError } = await supabase.from('raw_signals').insert(signalRows);
    if (signalError) {
      console.error('[Signal] Insert failed:', signalError);
    }

    const anomalies = detectAnomalies(points);

    if (anomalies.length > 0) {
      await persistAnomalies(anomalies, anonId);

      const affectedCells = [...new Set(anomalies.map(a => a.h3Index))];
      const riskResults = await computeRiskForCells(affectedCells);
      await persistRiskResults(riskResults);

      for (const risk of riskResults) {
        broadcastRiskUpdate(risk);
      }
    }

    res.status(200).json({
      received: points.length,
      anomaliesDetected: anomalies.length,
      cellsUpdated: anomalies.length > 0 ? [...new Set(anomalies.map(a => a.h3Index))].length : 0,
    });
  } catch (err) {
    console.error('[Signal] Error processing signals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
