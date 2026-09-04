const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { supabase, isConfigured } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// In-memory fallback cache if Supabase is temporarily unreachable or initial setup
let memoryState = {
  employees: [],
  medicines: [],
  customers: [],
  bills: [],
  purchases: [],
  reminders: [],
  deletedReminders: [],
  customCategories: [],
  marketingTemplates: [],
  config: { billCounter: 1, activeMarketingTemplateId: '', initialized: true },
  lastUpdated: Date.now()
};

// Middleware
app.use(cors({
  origin: FRONTEND_URL === '*' ? '*' : [FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 1. Health Check Endpoint (Required for Render background checks & deployment monitoring)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Care N Cure Backend API',
    database: isConfigured() ? 'Connected to Supabase' : 'Fallback Local Storage Mode',
    timestamp: new Date().toISOString()
  });
});

// Helper function to fetch state from Supabase
async function fetchStateFromSupabase() {
  if (!isConfigured()) return memoryState;

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('*')
      .eq('id', 'primary_state')
      .single();

    if (error) {
      // If table doesn't exist or row missing, insert memoryState
      if (error.code === 'PGRST116' || error.message.includes('relation "public.app_state" does not exist')) {
        await upsertStateToSupabase(memoryState);
        return memoryState;
      }
      console.warn('Supabase fetch notice:', error.message);
      return memoryState;
    }

    if (data && data.data) {
      memoryState = data.data;
      return data.data;
    }
  } catch (err) {
    console.error('Supabase fetch error:', err.message);
  }
  return memoryState;
}

// Helper function to upsert state to Supabase
async function upsertStateToSupabase(payload) {
  memoryState = payload;
  if (!isConfigured()) return true;

  try {
    const lastUpdated = payload.lastUpdated || Date.now();
    const { error } = await supabase
      .from('app_state')
      .upsert({
        id: 'primary_state',
        data: payload,
        last_updated: lastUpdated,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Supabase upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase upsert exception:', err.message);
    return false;
  }
}

// 2. GET /api/data - Retrieve entire database state for synchronization
app.get('/api/data', async (req, res) => {
  try {
    const state = await fetchStateFromSupabase();
    res.status(200).json({
      name: 'cnc_care_n_cure_shared_live_db',
      data: state,
      lastUpdated: state.lastUpdated || Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application state', details: err.message });
  }
});

// 3. PUT /api/data - Save/sync complete database state payload
app.put('/api/data', async (req, res) => {
  try {
    let payload = req.body;

    // Support both { name: '...', data: {...} } and direct payload formats
    if (payload && payload.data) {
      payload = payload.data;
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload format' });
    }

    payload.lastUpdated = Date.now();
    const success = await upsertStateToSupabase(payload);

    res.status(200).json({
      success: true,
      message: 'Care N Cure database updated successfully',
      data: payload,
      syncedWithSupabase: success
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update database state', details: err.message });
  }
});

// 4. Granular Entity Endpoints (RESTful extensions)
const collections = ['medicines', 'customers', 'bills', 'purchases', 'reminders', 'employees', 'marketingTemplates'];

collections.forEach(col => {
  app.get(`/api/${col}`, async (req, res) => {
    const state = await fetchStateFromSupabase();
    res.json(state[col] || []);
  });

  app.put(`/api/${col}`, async (req, res) => {
    const state = await fetchStateFromSupabase();
    state[col] = req.body || [];
    state.lastUpdated = Date.now();
    await upsertStateToSupabase(state);
    res.json({ success: true, count: state[col].length });
  });
});

// Root Route
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; padding: 40px; text-align: center; color: #0f172a;">
      <h1 style="color: #0284c7;">🏥 Care N Cure Backend API</h1>
      <p style="font-size: 16px; color: #475569;">Backend Service is running and connected to Supabase PostgreSQL.</p>
      <p><a href="/api/health" style="color: #0284c7;">View Health Status</a> | <a href="/api/data" style="color: #0284c7;">View Data JSON</a></p>
    </div>
  `);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Care N Cure Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Database Mode: ${isConfigured() ? 'Supabase PostgreSQL' : 'Local Fallback'}`);
});
