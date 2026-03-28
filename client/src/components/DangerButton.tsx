import { useState, useCallback, useRef, useEffect } from 'react';

interface DangerButtonProps {
  userPosition: { lat: number; lng: number } | null;
}

const COOLDOWN_MS = 10000;

export default function DangerButton({ userPosition }: DangerButtonProps) {
  const [isDisabled, setIsDisabled] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SESSION_KEY = 'streetpulse_session';
  function getSessionId(): string {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  const startCooldown = useCallback(() => {
    setIsDisabled(true);
    setCooldownProgress(100);
    const start = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / COOLDOWN_MS) * 100);
      setCooldownProgress(remaining);

      if (remaining <= 0) {
        setIsDisabled(false);
        setCooldownProgress(0);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTap = useCallback(async () => {
    if (!userPosition || isDisabled) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/danger-tap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': getSessionId(),
        },
        body: JSON.stringify({
          lat: userPosition.lat,
          lng: userPosition.lng,
          sessionId: getSessionId(),
        }),
      });

      if (response.status === 429) {
        setFeedback('⏳ Rate limit reached. Please wait.');
        setIsDisabled(true);
        setTimeout(() => {
          setIsDisabled(false);
          setFeedback(null);
        }, 30000);
        return;
      }

      if (response.ok) {
        setTapCount(prev => prev + 1);
        setFeedback('✅ Area flagged. Stay safe.');
        startCooldown();
      } else {
        setFeedback('❌ Failed to report. Try again.');
      }
    } catch {
      setFeedback('📡 Network error. Retrying...');
    }

    setTimeout(() => setFeedback(null), 3000);
  }, [userPosition, isDisabled, startCooldown]);

  const handleSOS = useCallback(() => {
    if (!userPosition) return;
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${userPosition.lat},${userPosition.lng}`;
    const text = `🚨 SOS Emergency: I feel unsafe at my current location. Please check on me immediately. Track my location here: ${gmapsUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Emergency SOS',
        text: text,
      }).catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error sharing', err);
        }
      });
    } else {
      // Fallback for desktop browsers without Web Share support
      window.location.href = `sms:?body=${encodeURIComponent(text)}`;
    }
  }, [userPosition]);

  return (
    <div className="danger-button-wrapper">
      {feedback && <div className="danger-feedback" id="danger-feedback">{feedback}</div>}

      <div className="action-buttons-group">
        <button
          className="sos-button"
          onClick={handleSOS}
          disabled={!userPosition}
          title="Share SOS Location"
        >
          <span className="btn-icon">🆘</span>
        </button>

        <button
          className="danger-button"
          onClick={handleTap}
          disabled={isDisabled || !userPosition}
          id="danger-tap-button"
          aria-label="Report unsafe area"
          title="Report Unsafe Area"
        >
          <span className="btn-icon">⚠️</span>
          <div className="cooldown-ring" />
        </button>
      </div>
    </div>
  );
}
