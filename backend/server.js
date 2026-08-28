require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// SECURITY FIX: cors() with no options reflects any Origin header and
// allows credentials from anywhere. Restrict it to the real frontend
// origin(s) via an env var (comma-separated list), defaulting to local dev.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin / non-browser requests (no Origin header) through.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

// SECURITY FIX: no SSL config means a managed Postgres instance that
// requires TLS (Supabase, RDS, Azure Database for PostgreSQL, etc.) either
// fails to connect or -- with certain drivers/proxies -- silently connects
// in plaintext. Enable SSL whenever DB_HOST isn't localhost, and let it be
// forced or disabled explicitly via DB_SSL for local/dockerized Postgres.
const useSsl = process.env.DB_SSL
  ? process.env.DB_SSL === 'true'
  : process.env.DB_HOST && process.env.DB_HOST !== 'localhost';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'uganda_enterprise_db',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Basic liveness/readiness endpoint (used by container/orchestrator health checks).
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Endpoint to fetch dynamic dashboard metrics
app.get('/api/dashboard-metrics', async (req, res) => {
  try {
    // 1. Fetch live metrics from PostgreSQL

    // Core KPIs
    const networkRes = await pool.query(`
      SELECT
        SUM(length_km) as total_network_km,
        SUM(CASE WHEN lower(surface_type) IN ('bituminous', 'asphalt', 'paved') THEN length_km ELSE 0 END) as paved_network_km,
        SUM(CASE WHEN lower(surface_type) NOT IN ('bituminous', 'asphalt', 'paved') THEN length_km ELSE 0 END) as unpaved_network_km
      FROM core_road_links;
    `);

    // Surface Distribution
    const surfaceRes = await pool.query(`
      SELECT surface_type, SUM(length_km) as total_km
      FROM core_road_links
      GROUP BY surface_type;
    `);
    const surface_distribution = {};
    surfaceRes.rows.forEach(r => surface_distribution[r.surface_type] = parseFloat(r.total_km));

    // Class Distribution
    const classRes = await pool.query(`
      SELECT road_class, SUM(length_km) as total_km
      FROM core_road_links
      GROUP BY road_class;
    `);
    const class_distribution = {};
    classRes.rows.forEach(r => class_distribution[r.road_class] = parseFloat(r.total_km));

    // Region Distribution
    const regionRes = await pool.query(`
      SELECT maintenance_region, SUM(length_km) as total_km
      FROM core_road_links
      GROUP BY maintenance_region;
    `);
    const region_distribution = {};
    regionRes.rows.forEach(r => region_distribution[r.maintenance_region] = parseFloat(r.total_km));

    // Condition Distribution (mocked from earlier script parsing or DB)
    // Assuming you will later seed an asset_conditions table.
    // For now, we will return some hardcoded placeholder data for condition/projects
    // to match the dashboard's expectations.

    // 2. Fetch the 100+ Detailed Charts (Static JSON fallback for the grid)
    // We can load this from the generated public json for now, or serve it directly.
    let charts = [];
    try {
        const metricsFile = path.join(__dirname, '../enterprise_portal_ui/public/dashboard_metrics.json');
        const fileData = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
        charts = fileData.charts || [];
    } catch (e) {
        console.error("Could not load charts from static file:", e);
    }

    // 3. Assemble response payload matching frontend expectations
    const payload = {
      kpis: {
        total_network_km: parseFloat(networkRes.rows[0].total_network_km || 0).toFixed(2),
        paved_network_km: parseFloat(networkRes.rows[0].paved_network_km || 0).toFixed(2),
        unpaved_network_km: parseFloat(networkRes.rows[0].unpaved_network_km || 0).toFixed(2),
        total_projects: 142, // Mocked for now
        total_budget_ugx_bn: 450.5 // Mocked for now
      },
      road_network: {
        surface_distribution,
        class_distribution,
        region_distribution
      },
      projects: {
        status_distribution: { "Active": 80, "Completed": 42, "Planned": 20 },
        type_distribution: { "Upgrading": 50, "Rehabilitation": 40, "Maintenance": 52 }
      },
      performance: {
        condition_distribution: { "Good": 4500, "Fair": 2000, "Poor": 800 }
      },
      charts: charts
    };

    res.json(payload);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Enterprise Dashboard API server running on port ${port}`);
});
