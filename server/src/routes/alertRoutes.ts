import { Router, Request, Response } from 'express';
import * as h3 from 'h3-js';
import { getAllActiveRisks } from '../engine/riskScorer';
import { generateAlert, shouldTriggerAlert } from '../engine/alertEngine';

const router = Router();

router.post('/check-location', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'Invalid location' });
      return;
    }

    const userH3 = h3.latLngToCell(lat, lng, 9);
    const neighbors = h3.gridDisk(userH3, 1);

    const allRisks = await getAllActiveRisks();
    const nearbyRisks = allRisks.filter(r => neighbors.includes(r.h3Index));

    const alerts = nearbyRisks
      .filter(r => shouldTriggerAlert(r))
      .map(r => generateAlert(r))
      .filter(Boolean);

    res.status(200).json({
      alerts,
      nearbyRisks: nearbyRisks.map(r => ({
        h3Index: r.h3Index,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel,
      })),
    });
  } catch (err) {
    console.error('[Alert] Error checking location:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/active-risks', async (_req: Request, res: Response): Promise<void> => {
  try {
    const risks = await getAllActiveRisks();
    res.status(200).json({ risks, count: risks.length });
  } catch (err) {
    console.error('[Alert] Error fetching risks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
