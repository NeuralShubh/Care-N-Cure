const CLOUD_DB_URL = (typeof window !== 'undefined' && window.CARE_N_CURE_BACKEND_URL) 
  ? window.CARE_N_CURE_BACKEND_URL 
  : `https://care-n-cure.onrender.com/api/data`;

let cloudPushTimer = null;
let isCloudSyncing = false;
let hasPendingCloudPush = false;
let lastCloudSyncTimestamp = 0;

const DB = {
  get(key) {
    try {
      const val = JSON.parse(localStorage.getItem(`cnc_${key}`));
      return Array.isArray(val) ? val : (val || []);
    } catch {
      return [];
    }
  },
  set(key, data) {
    try {
      localStorage.setItem(`cnc_${key}`, JSON.stringify(data));
      localStorage.setItem('cnc_last_updated', Date.now().toString());
    } catch(e) {}
    DB.broadcastSync();
    DB.pushToCloud();
  },
  getConfig(key) {
    try { return JSON.parse(localStorage.getItem(`cnc_cfg_${key}`)); }
    catch { return null; }
  },
  setConfig(key, value) {
    try {
      localStorage.setItem(`cnc_cfg_${key}`, JSON.stringify(value));
      localStorage.setItem('cnc_last_updated', Date.now().toString());
    } catch(e) {}
    DB.broadcastSync();
    DB.pushToCloud();
  },
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },
  generateCustomerId() {
    const customers = DB.get('customers') || [];
    let maxNum = 0;
    customers.forEach(c => {
      if (c && c.id) {
        const str = String(c.id);
        const match = str.match(/^c(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    });
    return `c${maxNum + 1}`;
  },
  getAllData() {
    return {
      employees: DB.get('employees'),
      medicines: DB.get('medicines'),
      customers: DB.get('customers'),
      bills: DB.get('bills'),
      purchases: DB.get('purchases'),
      reminders: DB.get('reminders'),
      deletedReminders: DB.get('deletedReminders'),
      customCategories: DB.get('customCategories'),
      marketingTemplates: DB.get('marketingTemplates'),
      config: {
        billCounter: DB.getConfig('billCounter') || 1,
        activeMarketingTemplateId: DB.getConfig('activeMarketingTemplateId') || '',
        initialized: true
      },
      lastUpdated: parseInt(localStorage.getItem('cnc_last_updated') || '0') || Date.now()
    };
  },
  importAllData(fullObj, skipCloudPush = false) {
    if (!fullObj || typeof fullObj !== 'object') return false;
    if (Array.isArray(fullObj.employees)) localStorage.setItem('cnc_employees', JSON.stringify(fullObj.employees));
    if (Array.isArray(fullObj.medicines)) localStorage.setItem('cnc_medicines', JSON.stringify(fullObj.medicines));
    if (Array.isArray(fullObj.customers)) {
      let maxNum = 0;
      fullObj.customers.forEach(c => {
        if (c && c.id && /^c\d+$/i.test(String(c.id))) {
          const num = parseInt(String(c.id).substring(1), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      fullObj.customers.forEach(c => {
        if (c && c.id && !/^c\d+$/i.test(String(c.id))) {
          maxNum++;
          const oldId = c.id;
          const newId = `c${maxNum}`;
          c.id = newId;
          if (Array.isArray(fullObj.purchases)) {
            fullObj.purchases.forEach(p => { if (p.customerId === oldId) p.customerId = newId; });
          }
          if (Array.isArray(fullObj.reminders)) {
            fullObj.reminders.forEach(r => { if (r.customerId === oldId) r.customerId = newId; });
          }
        }
      });
      localStorage.setItem('cnc_customers', JSON.stringify(fullObj.customers));
    }
    if (Array.isArray(fullObj.bills)) localStorage.setItem('cnc_bills', JSON.stringify(fullObj.bills));
    if (Array.isArray(fullObj.purchases)) localStorage.setItem('cnc_purchases', JSON.stringify(fullObj.purchases));
    if (Array.isArray(fullObj.reminders)) localStorage.setItem('cnc_reminders', JSON.stringify(fullObj.reminders));
    if (Array.isArray(fullObj.deletedReminders)) localStorage.setItem('cnc_deletedReminders', JSON.stringify(fullObj.deletedReminders));
    if (Array.isArray(fullObj.customCategories)) localStorage.setItem('cnc_customCategories', JSON.stringify(fullObj.customCategories));
    if (Array.isArray(fullObj.marketingTemplates)) localStorage.setItem('cnc_marketingTemplates', JSON.stringify(fullObj.marketingTemplates));
    if (fullObj.config) {
      if (fullObj.config.billCounter) localStorage.setItem('cnc_cfg_billCounter', JSON.stringify(fullObj.config.billCounter));
      if (fullObj.config.activeMarketingTemplateId) localStorage.setItem('cnc_cfg_activeMarketingTemplateId', JSON.stringify(fullObj.config.activeMarketingTemplateId));
      localStorage.setItem('cnc_cfg_initialized', JSON.stringify(true));
    }
    const ts = fullObj.lastUpdated || Date.now();
    localStorage.setItem('cnc_last_updated', ts.toString());
    lastCloudSyncTimestamp = ts;
    DB.broadcastSync();
    if (!skipCloudPush) DB.pushToCloud();
    return true;
  },
  broadcastSync() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('cnc_db_channel');
        bc.postMessage({ type: 'DB_UPDATED', timestamp: Date.now() });
      }
    } catch(e) {}
  },
  pushToCloud() {
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
    }
    cloudPushTimer = setTimeout(() => {
      cloudPushTimer = null;
      DB.executeCloudPush();
    }, 300);
  },
  async executeCloudPush() {
    if (isCloudSyncing) {
      hasPendingCloudPush = true;
      return;
    }
    try {
      isCloudSyncing = true;
      const dataPayload = DB.getAllData();
      const payloadString = JSON.stringify({ name: 'cnc_care_n_cure_shared_live_db', data: dataPayload });
      
      const res = await fetch(CLOUD_DB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.lastUpdated) {
          localStorage.setItem('cnc_last_updated', json.data.lastUpdated.toString());
          lastCloudSyncTimestamp = json.data.lastUpdated;
        }
      }
    } catch (err) {
      console.warn('Cloud DB push warning:', err);
    } finally {
      isCloudSyncing = false;
      if (hasPendingCloudPush) {
        hasPendingCloudPush = false;
        DB.pushToCloud();
      }
    }
  },
  async pullFromCloud() {
    if (isCloudSyncing) return false;
    try {
      const res = await fetch(CLOUD_DB_URL);
      if (!res || !res.ok) return false;
      const result = await res.json();
      if (!result || !result.data) return false;
      
      const cloudData = result.data;
      if (cloudData && typeof cloudData === 'object') {
        DB.importAllData(cloudData, true);
        if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
        if (typeof updateBadges === 'function') updateBadges();
        return true;
      }
    } catch (err) {
      console.warn('Cloud DB pull warning:', err);
    }
    return false;
  }
};

async function seedData() {
  const defaultEmps = [
    { id: 'emp1', name: 'Arshad Tamboli', mobile: '', address: '', designation: 'Owner', joiningDate: new Date().toISOString().split('T')[0], salary: 0, isOwner: true }
  ];

  // Fetch live shared database from Supabase Render backend
  await DB.pullFromCloud();

  const existingEmployees = DB.get('employees');
  if (!Array.isArray(existingEmployees) || existingEmployees.length === 0) {
    DB.set('employees', defaultEmps);
  }

  DB.setConfig('initialized', true);
}

seedData();

// Start background Cloud DB Poll loop (every 5 seconds)
setInterval(function() {
  DB.pullFromCloud();
}, 5000);

window.addEventListener('focus', function() {
  DB.pullFromCloud();
});
