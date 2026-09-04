const CLOUD_DB_ID = 'ff808181a067127101a06b1861120c5f';
const CLOUD_DB_URL = (typeof window !== 'undefined' && window.CARE_N_CURE_BACKEND_URL) 
  ? window.CARE_N_CURE_BACKEND_URL 
  : `https://care-n-cure-backend.onrender.com/api/data`;
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
      { id: 'emp1', name: 'Dr. Rajesh Kumar', mobile: '9876543210', address: '123 Medical Lane, Mumbai', designation: 'Owner', joiningDate: '2023-01-15', salary: 50000, isOwner: true },
      { id: 'emp2', name: 'Priya Sharma', mobile: '9876543211', address: '456 Health St, Mumbai', designation: 'Pharmacist', joiningDate: '2023-06-01', salary: 25000, isOwner: false },
      { id: 'emp3', name: 'Amit Patel', mobile: '9876543212', address: '789 Care Ave, Mumbai', designation: 'Cashier', joiningDate: '2024-01-10', salary: 20000, isOwner: false }
    ];
    DB.set('employees', defaultEmps);
  }

  if (pulled || DB.getConfig('initialized')) return;

  const employees = DB.get('employees');

  const medicines = [
    { id: 'med1', name: 'Paracetamol 500mg', company: 'Cipla', category: 'Analgesic', price: 25, quantity: 200, expiryDate: '2027-06-15', lowStockThreshold: 20 },
    { id: 'med2', name: 'Amoxicillin 250mg', company: 'Sun Pharma', category: 'Antibiotic', price: 85, quantity: 150, expiryDate: '2026-12-20', lowStockThreshold: 15 },
    { id: 'med3', name: 'Cetirizine 10mg', company: 'Cipla', category: 'Antihistamine', price: 35, quantity: 120, expiryDate: '2027-03-10', lowStockThreshold: 10 },
    { id: 'med4', name: 'Metformin 500mg', company: 'Dr. Reddy\'s', category: 'Antidiabetic', price: 45, quantity: 80, expiryDate: '2026-09-30', lowStockThreshold: 10 },
    { id: 'med5', name: 'Omeprazole 20mg', company: 'AstraZeneca', category: 'Antacid', price: 65, quantity: 5, expiryDate: '2026-08-15', lowStockThreshold: 10 },
    { id: 'med6', name: 'Atorvastatin 10mg', company: 'Pfizer', category: 'Cardiovascular', price: 120, quantity: 60, expiryDate: '2027-01-25', lowStockThreshold: 10 },
    { id: 'med7', name: 'Azithromycin 500mg', company: 'Zydus', category: 'Antibiotic', price: 95, quantity: 8, expiryDate: '2025-07-01', lowStockThreshold: 10 },
    { id: 'med8', name: 'Dolo 650', company: 'Micro Labs', category: 'Analgesic', price: 30, quantity: 250, expiryDate: '2027-09-20', lowStockThreshold: 20 },
    { id: 'med9', name: 'Pan-D', company: 'Alkem', category: 'Antacid', price: 110, quantity: 45, expiryDate: '2027-04-15', lowStockThreshold: 10 },
    { id: 'med10', name: 'Crocin Advance', company: 'GSK', category: 'Analgesic', price: 28, quantity: 180, expiryDate: '2027-11-10', lowStockThreshold: 15 }
  ];

  const customers = [
    { id: 'cust1', name: 'Suresh Mehta', mobile: '9988776655', address: '101 Wellness Rd, Mumbai' },
    { id: 'cust2', name: 'Anita Desai', mobile: '9988776656', address: '202 Health Nagar, Mumbai' },
    { id: 'cust3', name: 'Vikram Singh', mobile: '9988776657', address: '303 Care Colony, Mumbai' }
  ];

  const bills = [
    {
      id: 'bill1', billNumber: 'CNC-0001', customerId: 'cust1', employeeId: 'emp2',
      date: '2026-09-01', items: [
        { medicineId: 'med1', name: 'Paracetamol 500mg', price: 25, quantity: 2, total: 50 }
      ], total: 50, paymentMode: 'Cash'
    },
    {
      id: 'bill2', billNumber: 'CNC-0002', customerId: 'cust2', employeeId: 'emp2',
      date: '2026-09-02', items: [
        { medicineId: 'med4', name: 'Metformin 500mg', price: 45, quantity: 1, total: 45 },
        { medicineId: 'med3', name: 'Cetirizine 10mg', price: 35, quantity: 1, total: 35 }
      ], total: 80, paymentMode: 'UPI'
    }
  ];

  const purchases = [
    {
      id: 'pur1', customerId: 'cust1', medicineId: 'med1', medicineName: 'Paracetamol 500mg',
      purchaseDate: '2026-09-01', quantity: 2, daysSupply: 4, finishDate: '2026-09-05', billId: 'bill1'
    },
    {
      id: 'pur2', customerId: 'cust2', medicineId: 'med4', medicineName: 'Metformin 500mg',
      purchaseDate: '2026-09-02', quantity: 1, daysSupply: 15, finishDate: '2026-09-17', billId: 'bill2'
    },
    {
      id: 'pur3', customerId: 'cust2', medicineId: 'med3', medicineName: 'Cetirizine 10mg',
      purchaseDate: '2026-09-02', quantity: 1, daysSupply: 10, finishDate: '2026-09-12', billId: 'bill2'
    }
  ];

  const reminders = [];

  DB.set('employees', employees);
  DB.set('medicines', medicines);
  DB.set('customers', customers);
  DB.set('bills', bills);
  DB.set('purchases', purchases);
  DB.set('reminders', reminders);
  DB.setConfig('initialized', true);
  DB.setConfig('billCounter', 3);

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

