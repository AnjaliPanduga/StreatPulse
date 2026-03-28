import * as h3 from 'h3-js';
import { getDbPool } from '../utils/db';
import { anonymizeId } from '../utils/privacy';

export interface SignalPoint {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: number;
}

export interface DetectedAnomaly {
  type: 'speed_drop' | 'reroute' | 'hesitation' | 'stop_cluster';
  lat: number;
  lng: number;
  h3Index: string;
  severity: number;
  metadata: Record<string, any>;
}

const H3_RESOLUTION = 9;

const SPEED_THRESHOLDS = {
  walking: 5,
  road: 15,
  dropRatio: 0.3,
};

const REROUTE_HEADING_CHANGE = 90;
const REROUTE_TIME_WINDOW = 30000;

const HESITATION_REVERSALS = 3;
const HESITATION_TIME_WINDOW = 60000;

const STOP_SPEED_THRESHOLD = 1;
const STOP_DURATION_MS = 45000;

export function detectAnomalies(points: SignalPoint[]): DetectedAnomaly[] {
  if (points.length < 2) return [];

  const anomalies: DetectedAnomaly[] = [];

  anomalies.push(...detectSpeedDrops(points));
  anomalies.push(...detectReroutes(points));
  anomalies.push(...detectHesitation(points));
  anomalies.push(...detectStopClusters(points));

  return anomalies;
}

function detectSpeedDrops(points: SignalPoint[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const expectedSpeed = prev.speed > 10 ? SPEED_THRESHOLDS.road : SPEED_THRESHOLDS.walking;
    const threshold = expectedSpeed * SPEED_THRESHOLDS.dropRatio;

    if (prev.speed > expectedSpeed && curr.speed < threshold) {
      const severity = 1 - (curr.speed / expectedSpeed);
      anomalies.push({
        type: 'speed_drop',
        lat: curr.lat,
        lng: curr.lng,
        h3Index: h3.latLngToCell(curr.lat, curr.lng, H3_RESOLUTION),
        severity: Math.min(severity, 1),
        metadata: {
          previousSpeed: prev.speed,
          currentSpeed: curr.speed,
          expectedSpeed,
        },
      });
    }
  }

  return anomalies;
}

function detectReroutes(points: SignalPoint[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const timeDiff = curr.timestamp - prev.timestamp;
    if (timeDiff > REROUTE_TIME_WINDOW) continue;

    let headingChange = Math.abs(curr.heading - prev.heading);
    if (headingChange > 180) headingChange = 360 - headingChange;

    if (headingChange > REROUTE_HEADING_CHANGE) {
      const severity = Math.min(headingChange / 180, 1);
      anomalies.push({
        type: 'reroute',
        lat: curr.lat,
        lng: curr.lng,
        h3Index: h3.latLngToCell(curr.lat, curr.lng, H3_RESOLUTION),
        severity,
        metadata: {
          headingChange,
          timeDelta: timeDiff,
        },
      });
    }
  }

  return anomalies;
}

function detectHesitation(points: SignalPoint[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (let i = 0; i < points.length; i++) {
    const windowEnd = points[i].timestamp + HESITATION_TIME_WINDOW;
    let reversals = 0;
    let lastDirection = 0;

    for (let j = i + 1; j < points.length && points[j].timestamp <= windowEnd; j++) {
      let headingChange = points[j].heading - points[j - 1].heading;
      if (headingChange > 180) headingChange -= 360;
      if (headingChange < -180) headingChange += 360;

      const direction = Math.sign(headingChange);
      if (direction !== 0 && direction !== lastDirection && lastDirection !== 0) {
        reversals++;
      }
      if (direction !== 0) lastDirection = direction;
    }

    if (reversals >= HESITATION_REVERSALS) {
      const midIdx = Math.min(i + Math.floor(reversals / 2), points.length - 1);
      const severity = Math.min(reversals / (HESITATION_REVERSALS * 2), 1);
      anomalies.push({
        type: 'hesitation',
        lat: points[midIdx].lat,
        lng: points[midIdx].lng,
        h3Index: h3.latLngToCell(points[midIdx].lat, points[midIdx].lng, H3_RESOLUTION),
        severity,
        metadata: { reversals, windowMs: HESITATION_TIME_WINDOW },
      });
      break;
    }
  }

  return anomalies;
}

function detectStopClusters(points: SignalPoint[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  let stopStart: number | null = null;
  let stopIdx = 0;

  for (let i = 0; i < points.length; i++) {
    if (points[i].speed < STOP_SPEED_THRESHOLD) {
      if (stopStart === null) {
        stopStart = points[i].timestamp;
        stopIdx = i;
      }

      const duration = points[i].timestamp - stopStart;
      if (duration >= STOP_DURATION_MS) {
        const severity = Math.min(duration / (STOP_DURATION_MS * 3), 1);
        anomalies.push({
          type: 'stop_cluster',
          lat: points[stopIdx].lat,
          lng: points[stopIdx].lng,
          h3Index: h3.latLngToCell(points[stopIdx].lat, points[stopIdx].lng, H3_RESOLUTION),
          severity,
          metadata: { durationMs: duration },
        });
        stopStart = null;
      }
    } else {
      stopStart = null;
    }
  }

  return anomalies;
}

export async function persistAnomalies(anomalies: DetectedAnomaly[], anonId: string): Promise<void> {
  if (anomalies.length === 0) return;

  const pool = getDbPool();

  const insertQueries = anomalies.map(async a => {
    return pool.query(
      `INSERT INTO anomalies (anon_id, anomaly_type, lat, lng, h3_index, severity, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [anonId, a.type, a.lat, a.lng, a.h3Index, a.severity, a.metadata]
    );
  });

  try {
    await Promise.all(insertQueries);
  } catch (error) {
    console.error('[AnomalyDetector] Insight insert failed:', error);
  }
}
