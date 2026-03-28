-- StreetPulse Database Schema
-- Requires PostGIS extension enabled in Supabase

CREATE EXTENSION IF NOT EXISTS postgis;

-- Raw movement signals (anonymized)
CREATE TABLE IF NOT EXISTS raw_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anon_id VARCHAR(64) NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  h3_index VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_h3 ON raw_signals(h3_index);
CREATE INDEX idx_signals_created ON raw_signals(created_at DESC);
CREATE INDEX idx_signals_location ON raw_signals USING GIST(location);
CREATE INDEX idx_signals_anon ON raw_signals(anon_id);

-- Detected anomalies
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anon_id VARCHAR(64) NOT NULL,
  anomaly_type VARCHAR(20) NOT NULL CHECK (anomaly_type IN ('speed_drop', 'reroute', 'hesitation', 'stop_cluster')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  h3_index VARCHAR(20) NOT NULL,
  severity DOUBLE PRECISION DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anomalies_h3 ON anomalies(h3_index);
CREATE INDEX idx_anomalies_created ON anomalies(created_at DESC);
CREATE INDEX idx_anomalies_type ON anomalies(anomaly_type);

-- One-tap danger reports
CREATE TABLE IF NOT EXISTS danger_taps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anon_id VARCHAR(64) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  h3_index VARCHAR(20) NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_danger_h3 ON danger_taps(h3_index);
CREATE INDEX idx_danger_created ON danger_taps(created_at DESC);

-- Geo cells with computed risk scores
CREATE TABLE IF NOT EXISTS geo_cells (
  h3_index VARCHAR(20) PRIMARY KEY,
  risk_score DOUBLE PRECISION DEFAULT 0,
  risk_level VARCHAR(10) DEFAULT 'safe' CHECK (risk_level IN ('safe', 'caution', 'high_risk')),
  slowdown_count INTEGER DEFAULT 0,
  reroute_count INTEGER DEFAULT 0,
  hesitation_count INTEGER DEFAULT 0,
  stop_cluster_count INTEGER DEFAULT 0,
  danger_tap_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cells_risk ON geo_cells(risk_level);
CREATE INDEX idx_cells_updated ON geo_cells(updated_at DESC);
CREATE INDEX idx_cells_score ON geo_cells(risk_score DESC);

-- User Trust & Reputation System
CREATE TABLE IF NOT EXISTS user_trust (
  anon_id VARCHAR(64) PRIMARY KEY,
  trust_score DOUBLE PRECISION DEFAULT 1.0,
  total_reports INTEGER DEFAULT 0,
  corroborated_reports INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);
