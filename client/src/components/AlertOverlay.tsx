import { useEffect, useState, useRef } from 'react';
import { AlertData } from '../hooks/useRiskSocket';

interface AlertOverlayProps {
  alert: AlertData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;

export default function AlertOverlay({ alert, onDismiss }: AlertOverlayProps) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!alert) return;

    setProgress(100);
    const start = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100));
    }, 50);

    dismissRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [alert, onDismiss]);

  if (!alert) return null;

  const levelLabel = alert.riskLevel === 'high_risk' ? 'High Risk Zone' : 'Caution Zone';
  const icon = alert.riskLevel === 'high_risk' ? '🚨' : '⚠️';

  return (
    <div className="alert-overlay" id="alert-overlay" role="alert" aria-live="assertive">
      <div className={`alert-card ${alert.riskLevel}`}>
        <div className="alert-glow" />

        <button
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          id="alert-dismiss-btn"
        >
          ×
        </button>

        <div className="alert-content">
          <span className="alert-icon">{icon}</span>
          <div className="alert-text">
            <h4>{levelLabel}</h4>
            <p>{alert.message}</p>
          </div>
        </div>

        <div
          className="alert-progress"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
