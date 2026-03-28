import { useState, useEffect, useCallback, useRef } from 'react';

export interface RiskCell {
  h3Index: string;
  riskScore: number;
  riskLevel: 'safe' | 'caution' | 'high_risk';
  centerLat: number;
  centerLng: number;
  slowdownCount: number;
  rerouteCount: number;
  dangerTapCount: number;
  uniqueUsers: number;
  decayed?: boolean;
}

export interface AlertData {
  type: string;
  message: string;
  riskLevel: string;
  riskScore: number;
  h3Index: string;
}

export function useRiskSocket() {
  const [risks, setRisks] = useState<Map<string, RiskCell>>(new Map());
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<any>(null);

  const connectSocket = useCallback(async () => {
    try {
      const { io } = await import('socket.io-client');
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
      const socket = io(wsUrl, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        console.log('[WS] Connected to StreetPulse engine');
        setConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('[WS] Disconnected');
        setConnected(false);
      });

      socket.on('risk:batch', (data: RiskCell[]) => {
        setRisks(prev => {
          const updated = new Map(prev);
          data.forEach(cell => {
            if (cell.riskScore > 0) {
              updated.set(cell.h3Index, cell);
            }
          });
          return updated;
        });
      });

      socket.on('risk:update', (data: RiskCell) => {
        setRisks(prev => {
          const updated = new Map(prev);
          if (data.decayed || data.riskScore === 0) {
            updated.delete(data.h3Index);
          } else {
            updated.set(data.h3Index, data);
          }
          return updated;
        });
      });

      socket.on('alert:enter-zone', (data: AlertData) => {
        setAlert(data);
      });

      wsRef.current = socket;

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.warn('[WS] Connection failed:', err);
    }
  }, []);

  useEffect(() => {
    const cleanup = connectSocket();
    return () => {
      cleanup?.then(fn => fn?.());
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, [connectSocket]);

  const checkLocation = useCallback((lat: number, lng: number) => {
    if (wsRef.current?.connected) {
      wsRef.current.emit('location:check', { lat, lng });
    }
  }, []);

  const dismissAlert = useCallback(() => setAlert(null), []);

  return { risks, alert, connected, checkLocation, dismissAlert };
}
