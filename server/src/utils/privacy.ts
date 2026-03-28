import crypto from 'crypto';

const SALT_PREFIX = 'streetpulse_v1_';

export function anonymizeId(sessionId: string): string {
  return crypto
    .createHash('sha256')
    .update(SALT_PREFIX + sessionId)
    .digest('hex')
    .substring(0, 16);
}

export function coarsenCoordinates(lat: number, lng: number, precision: number = 4): { lat: number; lng: number } {
  const factor = Math.pow(10, precision);
  return {
    lat: Math.round(lat * factor) / factor,
    lng: Math.round(lng * factor) / factor,
  };
}

export function sanitizeSignalPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.points) || payload.points.length === 0) return false;
  if (payload.points.length > 100) return false;
  if (!payload.sessionId || typeof payload.sessionId !== 'string') return false;

  return payload.points.every((p: any) =>
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    p.lat >= -90 && p.lat <= 90 &&
    p.lng >= -180 && p.lng <= 180 &&
    typeof p.speed === 'number' &&
    p.speed >= 0 &&
    typeof p.heading === 'number' &&
    typeof p.timestamp === 'number'
  );
}
