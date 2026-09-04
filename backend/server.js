const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { supabase, isConfigured } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// In-memory fallback cache if Supabase is temporarily unreachable or initial setup
let memoryState = {
  employees: [
    { id: 'emp1', name: 'Arshad Tamboli', mobile: '', address: '', designation: 'Owner', joiningDate: new Date().toISOString().split('T')[0], salary: 0, isOwner: true }
  ],
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
  origin: '*',
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
  // GET all items in collection
  app.get(`/api/${col}`, async (req, res) => {
    const state = await fetchStateFromSupabase();
    res.json(state[col] || []);
  });

  // POST create item in collection
  app.post(`/api/${col}`, async (req, res) => {
    try {
      const state = await fetchStateFromSupabase();
      if (!state[col]) state[col] = [];
      const newItem = req.body;
      if (!newItem.id) {
        newItem.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      }
      state[col].push(newItem);
      state.lastUpdated = Date.now();
      const success = await upsertStateToSupabase(state);
      res.status(201).json({ success: true, item: newItem, syncedWithSupabase: success });
    } catch (err) {
      res.status(500).json({ error: `Failed to create item in ${col}`, details: err.message });
    }
  });

  // PUT replace entire collection array
  app.put(`/api/${col}`, async (req, res) => {
    try {
      const state = await fetchStateFromSupabase();
      state[col] = req.body || [];
      state.lastUpdated = Date.now();
      const success = await upsertStateToSupabase(state);
      res.json({ success: true, count: state[col].length, syncedWithSupabase: success });
    } catch (err) {
      res.status(500).json({ error: `Failed to replace ${col}`, details: err.message });
    }
  });

  // PUT update specific item in collection by ID
  app.put(`/api/${col}/:id`, async (req, res) => {
    try {
      const state = await fetchStateFromSupabase();
      if (!state[col]) state[col] = [];
      const itemId = req.params.id;
      const idx = state[col].findIndex(item => item.id === itemId);
      if (idx === -1) {
        return res.status(404).json({ error: `Item ${itemId} not found in ${col}` });
      }
      state[col][idx] = { ...state[col][idx], ...req.body, id: itemId };
      state.lastUpdated = Date.now();
      const success = await upsertStateToSupabase(state);
      res.json({ success: true, item: state[col][idx], syncedWithSupabase: success });
    } catch (err) {
      res.status(500).json({ error: `Failed to update item in ${col}`, details: err.message });
    }
  });

  // DELETE item in collection by ID
  app.delete(`/api/${col}/:id`, async (req, res) => {
    try {
      const state = await fetchStateFromSupabase();
      if (!state[col]) state[col] = [];
      const itemId = req.params.id;
      const initialLen = state[col].length;
      state[col] = state[col].filter(item => item.id !== itemId);
      if (state[col].length === initialLen) {
        return res.status(404).json({ error: `Item ${itemId} not found in ${col}` });
      }
      state.lastUpdated = Date.now();
      const success = await upsertStateToSupabase(state);
      res.json({ success: true, deletedId: itemId, syncedWithSupabase: success });
    } catch (err) {
      res.status(500).json({ error: `Failed to delete item from ${col}`, details: err.message });
    }
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
