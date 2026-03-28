import { useState, useEffect, useCallback, useRef } from 'react';

interface TrackingState {
  isTracking: boolean;
  lastPosition: { lat: number; lng: number } | null;
  error: string | null;
}

interface SignalPoint {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: number;
}

const BATCH_INTERVAL = 5000;
const SESSION_KEY = 'streetpulse_session';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function computeSpeed(prev: GeolocationCoordinates, curr: GeolocationCoordinates, timeDelta: number): number {
  if (curr.speed !== null && curr.speed >= 0) return curr.speed * 3.6;

  const R = 6371000;
  const dLat = ((curr.latitude - prev.latitude) * Math.PI) / 180;
  const dLng = ((curr.longitude - prev.longitude) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((prev.latitude * Math.PI) / 180) *
    Math.cos((curr.latitude * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return timeDelta > 0 ? (distance / (timeDelta / 1000)) * 3.6 : 0;
}

function computeHeading(prev: GeolocationCoordinates, curr: GeolocationCoordinates): number {
  if (curr.heading !== null && curr.heading >= 0) return curr.heading;

  const dLng = ((curr.longitude - prev.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((curr.latitude * Math.PI) / 180);
  const x = Math.cos((prev.latitude * Math.PI) / 180) * Math.sin((curr.latitude * Math.PI) / 180) -
    Math.sin((prev.latitude * Math.PI) / 180) * Math.cos((curr.latitude * Math.PI) / 180) * Math.cos(dLng);
  let heading = (Math.atan2(y, x) * 180) / Math.PI;
  return (heading + 360) % 360;
}

export function useSignalTracker() {
  const [state, setState] = useState<TrackingState>({
    isTracking: false,
    lastPosition: null,
    error: null,
  });

  const bufferRef = useRef<SignalPoint[]>([]);
  const prevCoordsRef = useRef<GeolocationCoordinates | null>(null);
  const prevTimeRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const sendBatch = useCallback(async () => {
    if (bufferRef.current.length === 0) return;

    const points = [...bufferRef.current];
    bufferRef.current = [];

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      await fetch(`${apiUrl}/api/signals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': getSessionId(),
        },
        body: JSON.stringify({ points, sessionId: getSessionId() }),
      });
    } catch (err) {
      console.warn('[Tracker] Failed to send signals:', err);
      bufferRef.current.unshift(...points);
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { coords } = position;
        const now = Date.now();

        setState(prev => ({
          ...prev,
          isTracking: true,
          lastPosition: { lat: coords.latitude, lng: coords.longitude },
          error: null,
        }));

        if (prevCoordsRef.current) {
          const timeDelta = now - prevTimeRef.current;
          const speed = computeSpeed(prevCoordsRef.current, coords, timeDelta);
          const heading = computeHeading(prevCoordsRef.current, coords);

          bufferRef.current.push({
            lat: coords.latitude,
            lng: coords.longitude,
            speed,
            heading,
            timestamp: now,
          });
        }

        prevCoordsRef.current = coords;
        prevTimeRef.current = now;
      },
      (error) => {
        setState(prev => ({ ...prev, error: error.message }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;
  }, []);

  useEffect(() => {
    startTracking();

    const interval = setInterval(sendBatch, BATCH_INTERVAL);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(interval);
      sendBatch();
    };
  }, [startTracking, sendBatch]);

  return state;
}
