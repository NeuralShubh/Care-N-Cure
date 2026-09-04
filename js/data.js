const CLOUD_DB_ID = 'ff808181a067127101a06b1861120c5f';
const CLOUD_DB_URL = (typeof window !== 'undefined' && window.CARE_N_CURE_BACKEND_URL) 
  ? window.CARE_N_CURE_BACKEND_URL 
  : `https://care-n-cure.onrender.com/api/data`;
const FALLBACK_DB_URL = `https://api.restful-api.dev/objects/${CLOUD_DB_ID}`;

let cloudPushTimer = null;
let isCloudSyncing = false;
let hasPendingCloudPush = false;
let lastCloudSyncTimestamp = 0;

const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(`cnc_${key}`)) || []; }
    catch { return []; }
  },
  set(key, data) {
    localStorage.setItem(`cnc_${key}`, JSON.stringify(data));
    localStorage.setItem('cnc_last_updated', Date.now().toString());
    DB.broadcastSync();
    DB.pushToCloud();
  },
  getConfig(key) {
    try { return JSON.parse(localStorage.getItem(`cnc_cfg_${key}`)); }
    catch { return null; }
  },
  setConfig(key, value) {
    localStorage.setItem(`cnc_cfg_${key}`, JSON.stringify(value));
    localStorage.setItem('cnc_last_updated', Date.now().toString());
    DB.broadcastSync();
    DB.pushToCloud();
  },
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
    if (Array.isArray(fullObj.customers)) localStorage.setItem('cnc_customers', JSON.stringify(fullObj.customers));
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
      
      let pushSuccess = false;
      try {
        const res = await fetch(CLOUD_DB_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString
        });
        if (res.ok) pushSuccess = true;
      } catch (e) {}

      if (!pushSuccess) {
        await fetch(FALLBACK_DB_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString
        });
      }
      lastCloudSyncTimestamp = dataPayload.lastUpdated;
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
    if (isCloudSyncing || cloudPushTimer) return false;
    try {
      let res = null;
      try {
        res = await fetch(CLOUD_DB_URL);
      } catch (e) {}

      if (!res || !res.ok) {
        res = await fetch(FALLBACK_DB_URL);
      }
      if (!res || !res.ok) return false;
      const result = await res.json();
      if (!result || !result.data) return false;
      
      const cloudData = result.data;
      const cloudTimestamp = cloudData.lastUpdated || 0;
      const localTimestamp = parseInt(localStorage.getItem('cnc_last_updated') || '0') || 0;
      const isInitialized = DB.getConfig('initialized');

      if (cloudTimestamp > localTimestamp || !isInitialized) {
        if (cloudData && typeof cloudData === 'object' && Array.isArray(cloudData.customers)) {
          DB.importAllData(cloudData, true);
          if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
          if (typeof updateBadges === 'function') updateBadges();
          return true;
        }
      } else if (localTimestamp > cloudTimestamp && isInitialized) {
        DB.pushToCloud();
      }
    } catch (err) {
      console.warn('Cloud DB pull warning:', err);
    }
    return false;
  }
};

async function seedData() {
  // First attempt to pull live shared database from Cloud
  const pulled = await DB.pullFromCloud();
  
  const existingEmployees = DB.get('employees');
  if (!Array.isArray(existingEmployees) || existingEmployees.length === 0) {
    const defaultEmps = [
      { id: 'emp1', name: 'Owner / Admin', mobile: '', address: '', designation: 'Owner', joiningDate: new Date().toISOString().split('T')[0], salary: 0, isOwner: true }
    ];
    DB.set('employees', defaultEmps);
  }

  if (pulled || DB.getConfig('initialized')) return;

  const employees = DB.get('employees');
  const medicines = [];
  const customers = [];
  const bills = [];
  const purchases = [];
  const reminders = [];
  const customCategories = [];
  const marketingTemplates = [];

  DB.set('employees', employees);
  DB.set('medicines', medicines);
  DB.set('customers', customers);
  DB.set('bills', bills);
  DB.set('purchases', purchases);
  DB.set('reminders', reminders);
  DB.set('customCategories', customCategories);
  DB.set('marketingTemplates', marketingTemplates);
  DB.setConfig('initialized', true);
  DB.setConfig('billCounter', 1);

  DB.pushToCloud();
}

seedData();

// Start background Cloud DB Poll loop (every 3 seconds)
setInterval(function() {
  DB.pullFromCloud();
}, 3000);

window.addEventListener('focus', function() {
  DB.pullFromCloud();
});

