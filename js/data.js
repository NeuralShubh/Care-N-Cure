const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(`cnc_${key}`)) || []; }
    catch { return []; }
  },
  set(key, data) {
    localStorage.setItem(`cnc_${key}`, JSON.stringify(data));
  },
  getConfig(key) {
    try { return JSON.parse(localStorage.getItem(`cnc_cfg_${key}`)); }
    catch { return null; }
  },
  setConfig(key, value) {
    localStorage.setItem(`cnc_cfg_${key}`, JSON.stringify(value));
  },
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
};

function seedData() {
  const existingEmployees = DB.get('employees');
  if (!Array.isArray(existingEmployees) || existingEmployees.length === 0) {
    const defaultEmps = [
      { id: 'emp1', name: 'Dr. Rajesh Kumar', mobile: '9876543210', address: '123 Medical Lane, Mumbai', designation: 'Owner', joiningDate: '2023-01-15', salary: 50000, isOwner: true },
      { id: 'emp2', name: 'Priya Sharma', mobile: '9876543211', address: '456 Health St, Mumbai', designation: 'Pharmacist', joiningDate: '2023-06-01', salary: 25000, isOwner: false },
      { id: 'emp3', name: 'Amit Patel', mobile: '9876543212', address: '789 Care Ave, Mumbai', designation: 'Cashier', joiningDate: '2024-01-10', salary: 20000, isOwner: false }
    ];
    DB.set('employees', defaultEmps);
  }

  if (DB.getConfig('initialized')) return;

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
}

seedData();
