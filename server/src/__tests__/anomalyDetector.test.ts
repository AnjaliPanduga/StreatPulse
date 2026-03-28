import { detectAnomalies, SignalPoint } from '../engine/anomalyDetector';

describe('AnomalyDetector', () => {
  describe('detectSpeedDrops', () => {
    it('should detect a sudden speed drop', () => {
      const points: SignalPoint[] = [
        { lat: 17.385, lng: 78.486, speed: 25, heading: 90, timestamp: 1000 },
        { lat: 17.386, lng: 78.487, speed: 2, heading: 90, timestamp: 2000 },
      ];
      const anomalies = detectAnomalies(points);
      const speedDrops = anomalies.filter(a => a.type === 'speed_drop');
      expect(speedDrops.length).toBeGreaterThan(0);
      expect(speedDrops[0].severity).toBeGreaterThan(0);
    });

    it('should not detect a gradual speed decrease', () => {
      const points: SignalPoint[] = [
        { lat: 17.385, lng: 78.486, speed: 20, heading: 90, timestamp: 1000 },
        { lat: 17.386, lng: 78.487, speed: 15, heading: 90, timestamp: 2000 },
      ];
      const anomalies = detectAnomalies(points);
      const speedDrops = anomalies.filter(a => a.type === 'speed_drop');
      expect(speedDrops.length).toBe(0);
    });
  });

  describe('detectReroutes', () => {
    it('should detect a sharp heading change', () => {
      const points: SignalPoint[] = [
        { lat: 17.385, lng: 78.486, speed: 10, heading: 0, timestamp: 1000 },
        { lat: 17.386, lng: 78.487, speed: 10, heading: 150, timestamp: 10000 },
      ];
      const anomalies = detectAnomalies(points);
      const reroutes = anomalies.filter(a => a.type === 'reroute');
      expect(reroutes.length).toBeGreaterThan(0);
    });

    it('should ignore heading changes outside time window', () => {
      const points: SignalPoint[] = [
        { lat: 17.385, lng: 78.486, speed: 10, heading: 0, timestamp: 1000 },
        { lat: 17.386, lng: 78.487, speed: 10, heading: 150, timestamp: 60000 },
      ];
      const anomalies = detectAnomalies(points);
      const reroutes = anomalies.filter(a => a.type === 'reroute');
      expect(reroutes.length).toBe(0);
    });
  });

  describe('detectHesitation', () => {
    it('should detect zig-zag movement', () => {
      const points: SignalPoint[] = [
        { lat: 17.385, lng: 78.486, speed: 5, heading: 0, timestamp: 1000 },
        { lat: 17.385, lng: 78.486, speed: 5, heading: 45, timestamp: 5000 },
        { lat: 17.385, lng: 78.486, speed: 5, heading: 0, timestamp: 10000 },
        { lat: 17.385, lng: 78.486, speed: 5, heading: 50, timestamp: 15000 },
        { lat: 17.385, lng: 78.486, speed: 5, heading: -10, timestamp: 20000 },
        { lat: 17.385, lng: 78.486, speed: 5, heading: 40, timestamp: 25000 },
        { lat: 17.385, lng: 78.486, speed: 5, heading: -5, timestamp: 30000 },
      ];
      const anomalies = detectAnomalies(points);
      const hesitations = anomalies.filter(a => a.type === 'hesitation');
      expect(hesitations.length).toBeGreaterThan(0);
    });
  });

  describe('detectStopClusters', () => {
    it('should detect abnormal stop duration', () => {
      const points: SignalPoint[] = [
        { lat: 17.385, lng: 78.486, speed: 0.5, heading: 0, timestamp: 0 },
        { lat: 17.385, lng: 78.486, speed: 0.2, heading: 0, timestamp: 20000 },
        { lat: 17.385, lng: 78.486, speed: 0.3, heading: 0, timestamp: 50000 },
      ];
      const anomalies = detectAnomalies(points);
      const stops = anomalies.filter(a => a.type === 'stop_cluster');
      expect(stops.length).toBeGreaterThan(0);
    });
  });

  it('should return empty array for single point', () => {
    const result = detectAnomalies([{ lat: 17.385, lng: 78.486, speed: 10, heading: 0, timestamp: 1000 }]);
    expect(result).toEqual([]);
  });
});
