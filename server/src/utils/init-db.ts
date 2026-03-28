import { getDbPool } from './db';

async function initDatabase() {
  const pool = getDbPool();

  console.log('⏳ Connecting to Database and initializing schema...');

  const schema = `
    -- Enable PostGIS extension for spatial mapping
    CREATE EXTENSION IF NOT EXISTS postgis;

    -- Table: raw_signals
    CREATE TABLE IF NOT EXISTS raw_signals (
      id SERIAL PRIMARY KEY,
      anon_id TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      speed DOUBLE PRECISION NOT NULL,
      heading DOUBLE PRECISION NOT NULL,
      h3_index TEXT NOT NULL,
      location GEOGRAPHY(POINT, 4326),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Table: danger_taps
    CREATE TABLE IF NOT EXISTS danger_taps (
      id SERIAL PRIMARY KEY,
      anon_id TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      h3_index TEXT NOT NULL,
      location GEOGRAPHY(POINT, 4326),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Table: anomalies
    CREATE TABLE IF NOT EXISTS anomalies (
      id SERIAL PRIMARY KEY,
      anon_id TEXT NOT NULL,
      anomaly_type TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      h3_index TEXT NOT NULL,
      severity DOUBLE PRECISION NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Table: geo_cells
    CREATE TABLE IF NOT EXISTS geo_cells (
      h3_index TEXT PRIMARY KEY,
      risk_score INTEGER DEFAULT 0,
      risk_level TEXT DEFAULT 'safe',
      slowdown_count INTEGER DEFAULT 0,
      reroute_count INTEGER DEFAULT 0,
      hesitation_count INTEGER DEFAULT 0,
      stop_cluster_count INTEGER DEFAULT 0,
      danger_tap_count INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      center_lat DOUBLE PRECISION,
      center_lng DOUBLE PRECISION,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Table: user_trust
    CREATE TABLE IF NOT EXISTS user_trust (
      anon_id TEXT PRIMARY KEY,
      trust_score DOUBLE PRECISION DEFAULT 1.0,
      total_reports INTEGER DEFAULT 0,
      corroborated_reports INTEGER DEFAULT 0,
      last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Indexes for faster geospatial and time-series querying
    CREATE INDEX IF NOT EXISTS raw_signals_h3_idx ON raw_signals (h3_index);
    CREATE INDEX IF NOT EXISTS raw_signals_created_at_idx ON raw_signals (created_at);

    CREATE INDEX IF NOT EXISTS danger_taps_h3_idx ON danger_taps (h3_index);
    CREATE INDEX IF NOT EXISTS danger_taps_created_at_idx ON danger_taps (created_at);

    CREATE INDEX IF NOT EXISTS anomalies_h3_idx ON anomalies (h3_index);
    CREATE INDEX IF NOT EXISTS anomalies_created_at_idx ON anomalies (created_at);
  `;

  try {
    await pool.query(schema);
    console.log('✅ Database Schema successfully initialized!');
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
  } finally {
    pool.end();
  }
}

initDatabase();
