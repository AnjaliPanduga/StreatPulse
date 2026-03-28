import { useMemo } from 'react';
import { RiskCell } from '../hooks/useRiskSocket';

interface RiskLegendProps {
  risks: Map<string, RiskCell>;
  connected: boolean;
}

export default function RiskLegend({ risks, connected }: RiskLegendProps) {
  const stats = useMemo(() => {
    let safe = 0, caution = 0, highRisk = 0, totalUsers = 0;
    risks.forEach(cell => {
      if (cell.riskLevel === 'safe') safe++;
      else if (cell.riskLevel === 'caution') caution++;
      else if (cell.riskLevel === 'high_risk') highRisk++;
      totalUsers += cell.uniqueUsers;
    });
    return { safe, caution, highRisk, total: risks.size, totalUsers };
  }, [risks]);

  return (
    <div className="risk-legend" id="risk-legend">
      <h3>Risk Levels</h3>

      <div className="legend-items">
        <div className="legend-item">
          <div className="legend-color safe" />
          <span>Safe</span>
        </div>
        <div className="legend-item">
          <div className="legend-color caution" />
          <span>Caution</span>
        </div>
        <div className="legend-item">
          <div className="legend-color high-risk" />
          <span>High Risk</span>
        </div>
      </div>

      <div className="legend-stats">
        <div className="legend-stat">
          <span>Active Zones</span>
          <span>{stats.total}</span>
        </div>
        <div className="legend-stat">
          <span>🟡 Caution</span>
          <span>{stats.caution}</span>
        </div>
        <div className="legend-stat">
          <span>🔴 High Risk</span>
          <span>{stats.highRisk}</span>
        </div>
        <div className="legend-stat">
          <span>Signal Status</span>
          <span style={{ color: connected ? '#22c55e' : '#ef4444' }}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
