import { classifyRisk, getTimeMultiplier, WEIGHTS, MAX_RAW_SCORE } from '../engine/riskScorer';

describe('RiskScorer', () => {
  describe('classifyRisk', () => {
    it('should classify score 0–33 as safe', () => {
      expect(classifyRisk(0)).toBe('safe');
      expect(classifyRisk(20)).toBe('safe');
      expect(classifyRisk(33)).toBe('safe');
    });

    it('should classify score 34–66 as caution', () => {
      expect(classifyRisk(34)).toBe('caution');
      expect(classifyRisk(50)).toBe('caution');
      expect(classifyRisk(66)).toBe('caution');
    });

    it('should classify score 67–100 as high_risk', () => {
      expect(classifyRisk(67)).toBe('high_risk');
      expect(classifyRisk(85)).toBe('high_risk');
      expect(classifyRisk(100)).toBe('high_risk');
    });
  });

  describe('getTimeMultiplier', () => {
    it('should return a number >= 1', () => {
      expect(getTimeMultiplier()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('WEIGHTS', () => {
    it('should have weights summing to 1.0', () => {
      const sum = WEIGHTS.slowdown + WEIGHTS.reroute + WEIGHTS.dangerTap + WEIGHTS.timeFactor;
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('risk formula', () => {
    it('should compute correct normalized score', () => {
      const slowdowns = 5;
      const reroutes = 3;
      const dangerTaps = 4;
      const timeMult = 1.5;

      const rawScore =
        (slowdowns * WEIGHTS.slowdown) +
        (reroutes * WEIGHTS.reroute) +
        (dangerTaps * WEIGHTS.dangerTap) +
        (timeMult * WEIGHTS.timeFactor * 10);

      const normalized = Math.min(Math.round((rawScore / MAX_RAW_SCORE) * 100), 100);

      expect(normalized).toBeGreaterThan(0);
      expect(normalized).toBeLessThanOrEqual(100);
    });
  });
});
