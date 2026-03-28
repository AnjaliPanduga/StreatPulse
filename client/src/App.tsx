import { useEffect, useRef } from 'react';
import MapView from './components/MapView';
import DangerButton from './components/DangerButton';
import AlertOverlay from './components/AlertOverlay';
import RiskLegend from './components/RiskLegend';
import { useRiskSocket } from './hooks/useRiskSocket';
import { useSignalTracker } from './hooks/useSignalTracker';

export default function App() {
  const { risks, alert, connected, checkLocation, dismissAlert } = useRiskSocket();
  const tracker = useSignalTracker();
  const lastCheckRef = useRef<number>(0);

  useEffect(() => {
    if (!tracker.lastPosition) return;

    const now = Date.now();
    if (now - lastCheckRef.current < 10000) return;
    lastCheckRef.current = now;

    checkLocation(tracker.lastPosition.lat, tracker.lastPosition.lng);
  }, [tracker.lastPosition, checkLocation]);

  return (
    <div className="app-container" id="app-root">
      {/* Header */}
      <header className="header-bar">
        <div className="header-brand">
          <div className="logo-icon">⚡</div>
          <h1>StreetPulse</h1>
        </div>
        <div className="header-status">
          <div className="status-badge">
            <div className="status-dot" style={{
              background: connected ? '#22c55e' : '#ef4444',
            }} />
            <span>{connected ? 'Live' : 'Connecting...'}</span>
          </div>
          {tracker.isTracking && (
            <div className="status-badge">
              <span>📍 Tracking</span>
            </div>
          )}
        </div>
      </header>

      {/* Map */}
      <MapView
        risks={risks}
        userPosition={tracker.lastPosition}
      />

      {/* Alert */}
      <AlertOverlay alert={alert} onDismiss={dismissAlert} />

      {/* Legend */}
      <RiskLegend risks={risks} connected={connected} />

      {/* Danger Button */}
      <DangerButton userPosition={tracker.lastPosition} />
    </div>
  );
}
