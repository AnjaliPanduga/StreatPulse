import { RiskResult } from './riskScorer';

interface AlertMessage {
  type: 'high_risk_zone';
  message: string;
  riskLevel: string;
  riskScore: number;
  h3Index: string;
}

const ALERT_MESSAGES: Record<string, string[]> = {
  speed_drop: [
    'Multiple riders slowed down here recently',
    'Several users reduced speed in this area',
    'Unusual slowdowns detected nearby',
  ],
  reroute: [
    'Several users rerouted from this area recently',
    'Multiple people changed direction here',
    'Route deviations detected in this zone',
  ],
  hesitation: [
    'Hesitation patterns detected in this area',
    'Multiple users showed uncertain movement here',
  ],
  stop_cluster: [
    'Unusual stops detected in this area',
    'Multiple users paused unexpectedly here',
  ],
  danger_tap: [
    'This area has been flagged by nearby users',
    'Multiple users reported this area as unsafe',
  ],
  general: [
    'Exercise caution in this area',
    'Elevated risk detected — stay alert',
  ],
};

function pickMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function generateAlert(risk: RiskResult): AlertMessage | null {
  if (risk.riskLevel === 'safe') return null;

  let dominantType = 'general';
  let maxCount = 0;

  const counts: Record<string, number> = {
    speed_drop: risk.slowdownCount,
    reroute: risk.rerouteCount,
    hesitation: risk.hesitationCount,
    stop_cluster: risk.stopClusterCount,
    danger_tap: risk.dangerTapCount,
  };

  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantType = type;
    }
  }

  const messages = ALERT_MESSAGES[dominantType] || ALERT_MESSAGES.general;

  return {
    type: 'high_risk_zone',
    message: pickMessage(messages),
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    h3Index: risk.h3Index,
  };
}

export function shouldTriggerAlert(risk: RiskResult): boolean {
  return risk.riskLevel === 'high_risk' || (risk.riskLevel === 'caution' && risk.riskScore >= 50);
}
