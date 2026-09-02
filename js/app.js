let currentUser = null;
let currentPage = 'dashboard';
let billItems = [];
let currentReminderTab = 'pending';
let currentWhatsAppReminder = null;

// ===================== LOGIN =====================
function initLogin() {
  const users = DB.get('employees');
  const sel = document.getElementById('loginUser');
  sel.innerHTML = '<option value="">-- Select User --</option>';
  users.forEach(u => {
    sel.innerHTML += `<option value="${u.id}">${u.name} (${u.designation})</option>`;
  });

  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const userId = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPassword').value;
    if (!userId) { showToast('Please select a user', 'error'); return; }
    if (password !== 'admin123') { showToast('Invalid password', 'error'); return; }

    const user = users.find(u => u.id === userId);
    currentUser = user;
    DB.setConfig('currentUser', user);

    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appLayout').style.display = 'flex';
    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('sidebarAvatar').textContent = user.name.charAt(0).toUpperCase();

    initApp();
  });
}

function logout() {
  showConfirm('Sign Out', 'Are you sure you want to sign out?', function() {
    currentUser = null;
    DB.setConfig('currentUser', null);
    document.getElementById('appLayout').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginUser').value = '';
    initLogin();
  });
}

// ===================== NAVIGATION =====================
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', "Welcome back! Here's your overview."],
    medicines: ['Medicines', 'Manage medicine inventory.'],
    customers: ['Customers', 'Manage customer records.'],
    billing: ['Billing & Sales', 'Create bills and process sales.'],
    history: ['Purchase History', 'View all medicine purchase records.'],
    reminders: ['Medicine Reminders', 'Manage patient medicine reminders.']
  };
  document.getElementById('pageTitle').textContent = titles[page][0];
  document.getElementById('pageSubtitle').textContent = titles[page][1];

  closeSidebar();
  refreshCurrentPage();
}

function refreshCurrentPage() {
  switch(currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'medicines': renderMedicines(); break;
    case 'customers': renderCustomers(); break;
    case 'billing': renderBilling(); break;
    case 'history': renderHistory(); break;
    case 'reminders': renderReminders(); break;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ===================== INIT =====================
function initApp() {
  autoGenerateReminders();
  refreshCurrentPage();
  updateBadges();
}

// ===================== DASHBOARD =====================
function renderDashboard() {
  const customers = DB.get('customers');
  const medicines = DB.get('medicines');
  const bills = DB.get('bills');
  const reminders = DB.get('reminders');
  const today = new Date().toISOString().split('T')[0];

  const lowStockMeds = medicines.filter(m => m.quantity <= (m.lowStockThreshold || 10));
  const expiringSoon = medicines.filter(m => {
    const days = daysUntil(m.expiryDate);
    return days <= 90 && days >= 0;
  });
  const todaySales = bills.filter(b => b.date === today);
  const todayRevenue = todaySales.reduce((s, b) => s + b.total, 0);

  document.getElementById('statCustomers').textContent = customers.length;
  document.getElementById('statMedicines').textContent = medicines.length;
  document.getElementById('statLowStock').textContent = lowStockMeds.length;
  document.getElementById('statExpiring').textContent = expiringSoon.length;
  document.getElementById('statTodaySales').textContent = '₹' + todayRevenue.toLocaleString('en-IN');

  // Upcoming reminders
  const pendingReminders = reminders.filter(r => r.status === 'pending').sort((a, b) => new Date(a.finishDate) - new Date(b.finishDate));
  const dashRem = document.getElementById('dashReminders');
  if (pendingReminders.length === 0) {
    dashRem.innerHTML = '<div class="empty-state" style="padding:20px;"><p>No pending reminders</p></div>';
  } else {
    dashRem.innerHTML = pendingReminders.slice(0, 5).map(r => `
      <div class="reminder-item">
        <div class="reminder-icon pending">&#9857;</div>
        <div class="reminder-info">
          <h4>${r.customerName}</h4>
          <p>${r.medicineName}</p>
        </div>
        <div class="reminder-date">${formatDate(r.finishDate)}</div>
      </div>
    `).join('');
  }

  // Low stock
  const dashLowStock = document.getElementById('dashLowStock');
  if (lowStockMeds.length === 0) {
    dashLowStock.innerHTML = '<div class="empty-state" style="padding:20px;"><p>All medicines well stocked</p></div>';
  } else {
    dashLowStock.innerHTML = lowStockMeds.slice(0, 5).map(m => `
      <div class="reminder-item">
        <div class="reminder-icon ${m.quantity === 0 ? 'failed' : 'pending'}">&#9888;</div>
        <div class="reminder-info">
          <h4>${m.name}</h4>
          <p>${m.company}</p>
        </div>
        <div class="reminder-date"><span class="badge ${m.quantity === 0 ? 'badge-danger' : 'badge-warning'}">${m.quantity} left</span></div>
      </div>
    `).join('');
  }

  // Recent sales
  const recentSales = document.getElementById('dashRecentSales');
  const recentBills = [...bills].reverse().slice(0, 5);
  if (recentBills.length === 0) {
    recentSales.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">No recent sales</td></tr>';
  } else {
    recentSales.innerHTML = recentBills.map(b => {
      const cust = DB.get('customers').find(c => c.id === b.customerId);
      return `<tr>
        <td><strong>${b.billNumber}</strong></td>
        <td>${cust ? cust.name : 'N/A'}</td>
        <td><strong>₹${b.total.toLocaleString('en-IN')}</strong></td>
        <td>${formatDate(b.date)}</td>
      </tr>`;
    }).join('');
  }

  // Expiring
  const dashExpiring = document.getElementById('dashExpiring');
  if (expiringSoon.length === 0) {
    dashExpiring.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">No medicines expiring soon</td></tr>';
  } else {
    dashExpiring.innerHTML = expiringSoon.slice(0, 5).map(m => {
      const days = daysUntil(m.expiryDate);
      return `<tr class="${days <= 30 ? 'expired' : ''}">
        <td>${m.name}</td>
        <td>${formatDate(m.expiryDate)}</td>
        <td>${m.quantity}</td>
        <td><span class="badge ${days <= 30 ? 'badge-danger' : 'badge-warning'}">${days} days</span></td>
      </tr>`;
    }).join('');
  }
}



// ===================== MEDICINES =====================
function renderMedicines() {
  populateMedCategoryFilter();
  const search = document.getElementById('medSearch').value.toLowerCase();
  const category = document.getElementById('medCategoryFilter').value;
  const stockFilter = document.getElementById('medStockFilter').value;

  let medicines = DB.get('medicines');
  if (search) {
    medicines = medicines.filter(m =>
      m.name.toLowerCase().includes(search) ||
      m.company.toLowerCase().includes(search) ||
      m.category.toLowerCase().includes(search)
    );
  }
  if (category) {
    medicines = medicines.filter(m => m.category === category);
  }
  if (stockFilter) {
    medicines = medicines.filter(m => {
      if (stockFilter === 'low') return m.quantity > 0 && m.quantity <= (m.lowStockThreshold || 10);
      if (stockFilter === 'out') return m.quantity === 0;
      if (stockFilter === 'in') return m.quantity > (m.lowStockThreshold || 10);
      return true;
    });
  }

  // Alerts
  const allMedicines = DB.get('medicines');
  const lowStock = allMedicines.filter(m => m.quantity <= (m.lowStockThreshold || 10));
  const expiring = allMedicines.filter(m => daysUntil(m.expiryDate) <= 90 && daysUntil(m.expiryDate) >= 0);
  const alertsDiv = document.getElementById('medAlerts');

  let alerts = [];
  if (lowStock.length > 0) {
    alerts.push(`<div class="alert alert-warning">&#9888; ${lowStock.length} medicine${lowStock.length > 1 ? 's' : ''} running low on stock.</div>`);
  }
  if (expiring.length > 0) {
    alerts.push(`<div class="alert alert-danger">&#9200; ${expiring.length} medicine${expiring.length > 1 ? 's' : ''} expiring within 90 days.</div>`);
  }
  alertsDiv.innerHTML = alerts.join('');
  alertsDiv.style.display = alerts.length > 0 ? 'block' : 'none';

  const table = document.getElementById('medicineTable');
  if (medicines.length === 0) {
    table.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">&#9764;</div><h3>No medicines found</h3></td></tr>';
    return;
  }

  table.innerHTML = medicines.map(m => {
    const days = daysUntil(m.expiryDate);
    const isLow = m.quantity <= (m.lowStockThreshold || 10);
    const isExpired = days < 0;
    const isExpiringSoon = days >= 0 && days <= 90;
    let statusBadge = '';
    if (isExpired) statusBadge = '<span class="badge badge-danger">Expired</span>';
    else if (m.quantity === 0) statusBadge = '<span class="badge badge-danger">Out of Stock</span>';
    else if (isLow) statusBadge = '<span class="badge badge-warning">Low Stock</span>';
    else if (isExpiringSoon) statusBadge = '<span class="badge badge-warning">Expiring Soon</span>';
    else statusBadge = '<span class="badge badge-success">In Stock</span>';

    return `<tr class="${isLow || isExpired ? (isExpired ? 'expired' : 'low-stock') : ''}">
      <td><strong>${m.name}</strong></td>
      <td>${m.company}</td>
      <td><span class="badge badge-neutral">${m.category}</span></td>
      <td>₹${m.price}</td>
      <td>${m.quantity}</td>
      <td>${formatDate(m.expiryDate)}${isExpiringSoon && !isExpired ? ` <span style="color:var(--warning);font-size:11px;">(${days}d)</span>` : ''}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-edit" onclick="editMedicine('${m.id}')" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" onclick="deleteMedicine('${m.id}')" title="Delete">&#128465;</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateMedCategoryFilter() {
  const medicines = DB.get('medicines');
  const categories = [...new Set(medicines.map(m => m.category))].sort();
  const sel = document.getElementById('medCategoryFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    categories.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

function openMedicineModal(id) {
  document.getElementById('medicineForm').reset();
  document.getElementById('medEditId').value = '';
  document.getElementById('medModalTitle').textContent = 'Add Medicine';
  document.getElementById('medLowStock').value = 10;
  if (id) {
    const med = DB.get('medicines').find(m => m.id === id);
    if (med) {
      document.getElementById('medEditId').value = med.id;
      document.getElementById('medModalTitle').textContent = 'Edit Medicine';
      document.getElementById('medName').value = med.name;
      document.getElementById('medCompany').value = med.company;
      document.getElementById('medCategory').value = med.category;
      document.getElementById('medPrice').value = med.price;
      document.getElementById('medQuantity').value = med.quantity;
      document.getElementById('medExpiryDate').value = med.expiryDate;
      document.getElementById('medLowStock').value = med.lowStockThreshold || 10;
    }
  }
  document.getElementById('medicineModal').classList.add('active');
}

function editMedicine(id) { openMedicineModal(id); }

function saveMedicine(e) {
  e.preventDefault();
  const editId = document.getElementById('medEditId').value;
  const medData = {
    name: document.getElementById('medName').value.trim(),
    company: document.getElementById('medCompany').value.trim(),
    category: document.getElementById('medCategory').value,
    price: parseFloat(document.getElementById('medPrice').value),
    quantity: parseInt(document.getElementById('medQuantity').value),
    expiryDate: document.getElementById('medExpiryDate').value,
    lowStockThreshold: parseInt(document.getElementById('medLowStock').value) || 10
  };

  let medicines = DB.get('medicines');
  if (editId) {
    const idx = medicines.findIndex(m => m.id === editId);
    if (idx !== -1) medicines[idx] = { ...medicines[idx], ...medData };
    showToast('Medicine updated successfully', 'success');
  } else {
    medData.id = DB.generateId();
    medicines.push(medData);
    showToast('Medicine added successfully', 'success');
  }

  DB.set('medicines', medicines);
  closeModal('medicineModal');
  renderMedicines();
  updateBadges();
}

function deleteMedicine(id) {
  showConfirm('Delete Medicine', 'Are you sure you want to delete this medicine? This action cannot be undone.', function() {
    let medicines = DB.get('medicines');
    medicines = medicines.filter(m => m.id !== id);
    DB.set('medicines', medicines);
    showToast('Medicine deleted', 'success');
    renderMedicines();
    updateBadges();
  });
}

// ===================== CUSTOMERS =====================
function renderCustomers() {
  const search = document.getElementById('custSearch').value.toLowerCase();
  let customers = DB.get('customers');
  const purchases = DB.get('purchases');

  if (search) {
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.mobile.includes(search)
    );
  }

  const table = document.getElementById('customerTable');
  if (customers.length === 0) {
    table.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-icon">&#9823;</div><h3>No customers found</h3></td></tr>';
    return;
  }

  table.innerHTML = customers.map(c => {
    const purchaseCount = purchases.filter(p => p.customerId === c.id).length;
    return `<tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.mobile}</td>
      <td>${c.address || '-'}</td>
      <td><span class="badge badge-info">${purchaseCount} purchases</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-view" onclick="viewCustomerHistory('${c.id}')" title="View History">&#128065;</button>
          <button class="btn-icon btn-edit" onclick="editCustomer('${c.id}')" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" onclick="deleteCustomer('${c.id}')" title="Delete">&#128465;</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openCustomerModal(id) {
  document.getElementById('customerForm').reset();
  document.getElementById('custEditId').value = '';
  document.getElementById('custModalTitle').textContent = 'Add Customer';
  if (id) {
    const cust = DB.get('customers').find(c => c.id === id);
    if (cust) {
      document.getElementById('custEditId').value = cust.id;
      document.getElementById('custModalTitle').textContent = 'Edit Customer';
      document.getElementById('custName').value = cust.name;
      document.getElementById('custMobile').value = cust.mobile;
      document.getElementById('custAddress').value = cust.address || '';
    }
  }
  document.getElementById('customerModal').classList.add('active');
}

function editCustomer(id) { openCustomerModal(id); }

function saveCustomer(e) {
  e.preventDefault();
  const editId = document.getElementById('custEditId').value;
  const custData = {
    name: document.getElementById('custName').value.trim(),
    mobile: document.getElementById('custMobile').value.trim(),
    address: document.getElementById('custAddress').value.trim()
  };

  let customers = DB.get('customers');
  if (editId) {
    const idx = customers.findIndex(c => c.id === editId);
    if (idx !== -1) customers[idx] = { ...customers[idx], ...custData };
    showToast('Customer updated successfully', 'success');
  } else {
    custData.id = DB.generateId();
    customers.push(custData);
    showToast('Customer added successfully', 'success');
  }

  DB.set('customers', customers);
  closeModal('customerModal');
  renderCustomers();
}

function deleteCustomer(id) {
  showConfirm('Delete Customer', 'Are you sure you want to delete this customer? Their purchase history will also be removed.', function() {
    let customers = DB.get('customers');
    customers = customers.filter(c => c.id !== id);
    DB.set('customers', customers);
    let purchases = DB.get('purchases');
    purchases = purchases.filter(p => p.customerId !== id);
    DB.set('purchases', purchases);
    showToast('Customer deleted', 'success');
    renderCustomers();
    updateBadges();
  });
}

function viewCustomerHistory(customerId) {
  const customer = DB.get('customers').find(c => c.id === customerId);
  if (!customer) return;

  const purchases = DB.get('purchases').filter(p => p.customerId === customerId);
  document.getElementById('custHistoryTitle').textContent = `Purchase History - ${customer.name}`;

  const content = document.getElementById('custHistoryContent');
  if (purchases.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128196;</div><h3>No purchases yet</h3><p>This customer has no purchase records.</p></div>';
  } else {
    content.innerHTML = `
      <div style="margin-bottom:16px;">
        <p><strong>Customer:</strong> ${customer.name}</p>
        <p><strong>Mobile:</strong> ${customer.mobile}</p>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Medicine</th><th>Qty</th><th>Purchase Date</th><th>Days Supply</th><th>Finish Date</th><th>Status</th></tr></thead>
          <tbody>
            ${purchases.map(p => {
              const daysLeft = daysUntil(p.finishDate);
              let status = '';
              if (daysLeft < 0) status = '<span class="badge badge-danger">Completed</span>';
              else if (daysLeft <= 3) status = '<span class="badge badge-warning">Finishing Soon</span>';
              else status = '<span class="badge badge-success">Active</span>';
              return `<tr>
                <td>${p.medicineName}</td>
                <td>${p.quantity}</td>
                <td>${formatDate(p.purchaseDate)}</td>
                <td>${p.daysSupply} days</td>
                <td>${formatDate(p.finishDate)}</td>
                <td>${status}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  document.getElementById('custHistoryModal').classList.add('active');
}

// ===================== BILLING =====================
function renderBilling() {
  populateBillCustomer();
  populateBillMedicine();
}

function populateBillCustomer() {
  const customers = DB.get('customers');
  const sel = document.getElementById('billCustomer');
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select Customer --</option>' +
    customers.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${c.name} (${c.mobile})</option>`).join('');
}

function populateBillMedicine() {
  const medicines = DB.get('medicines').filter(m => m.quantity > 0);
  const sel = document.getElementById('billMedicine');
  sel.innerHTML = '<option value="">-- Select Medicine --</option>' +
    medicines.map(m => `<option value="${m.id}" data-price="${m.price}" data-qty="${m.quantity}">${m.name} - ₹${m.price} (${m.quantity} in stock)</option>`).join('');
}

function onBillMedicineSelect() {
  const sel = document.getElementById('billMedicine');
  const opt = sel.options[sel.selectedIndex];
  if (opt.value) {
    document.getElementById('billQty').value = 1;
    document.getElementById('billDays').value = 30;
  }
}

function addBillItem() {
  const medSel = document.getElementById('billMedicine');
  const medId = medSel.value;
  if (!medId) { showToast('Please select a medicine', 'error'); return; }

  const qty = parseInt(document.getElementById('billQty').value);
  const days = parseInt(document.getElementById('billDays').value);
  if (!qty || qty <= 0) { showToast('Invalid quantity', 'error'); return; }
  if (!days || days <= 0) { showToast('Invalid days supply', 'error'); return; }

  const med = DB.get('medicines').find(m => m.id === medId);
  if (!med) return;
  if (qty > med.quantity) {
    showToast(`Only ${med.quantity} units available`, 'error');
    return;
  }

  const existingIdx = billItems.findIndex(i => i.medicineId === medId);
  if (existingIdx !== -1) {
    const newQty = billItems[existingIdx].quantity + qty;
    if (newQty > med.quantity) {
      showToast(`Only ${med.quantity} units available (already ${billItems[existingIdx].quantity} in bill)`, 'error');
      return;
    }
    billItems[existingIdx].quantity = newQty;
    billItems[existingIdx].daysSupply = days;
    billItems[existingIdx].total = newQty * med.price;
  } else {
    billItems.push({
      medicineId: medId,
      name: med.name,
      price: med.price,
      quantity: qty,
      daysSupply: days,
      total: qty * med.price
    });
  }

  renderBillItems();
  medSel.value = '';
  document.getElementById('billQty').value = 1;
  document.getElementById('billDays').value = 30;
}

function removeBillItem(index) {
  billItems.splice(index, 1);
  renderBillItems();
}

function renderBillItems() {
  const container = document.getElementById('billItems');
  if (billItems.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:16px;">No items added yet.</p>';
  } else {
    container.innerHTML = billItems.map((item, idx) => `
      <div class="bill-medicine-item">
        <div class="medicine-details" style="flex:1;">
          <h4>${item.name}</h4>
          <p>₹${item.price} x ${item.quantity} = ₹${item.total} | ${item.daysSupply} days</p>
        </div>
        <button class="btn-icon btn-delete" onclick="removeBillItem(${idx})" style="background:var(--danger-bg);color:var(--danger);border:none;width:28px;height:28px;border-radius:6px;cursor:pointer;">&times;</button>
      </div>
    `).join('');
  }

  const total = billItems.reduce((s, i) => s + i.total, 0);
  document.getElementById('billTotal').textContent = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function resetBill() {
  billItems = [];
  document.getElementById('billCustomer').value = '';
  document.getElementById('billPaymentMode').value = 'Cash';
  renderBillItems();
}

function generateBill() {
  const customerId = document.getElementById('billCustomer').value;
  const paymentMode = document.getElementById('billPaymentMode').value;
  if (!customerId) { showToast('Please select a customer', 'error'); return; }
  if (billItems.length === 0) { showToast('Please add at least one medicine', 'error'); return; }

  const total = billItems.reduce((s, i) => s + i.total, 0);
  let counter = DB.getConfig('billCounter') || 1;
  const billNumber = 'CNC-' + String(counter).padStart(4, '0');

  const bill = {
    id: DB.generateId(),
    billNumber,
    customerId,
    employeeId: currentUser ? currentUser.id : '',
    date: new Date().toISOString().split('T')[0],
    items: [...billItems],
    total,
    paymentMode
  };

  let bills = DB.get('bills');
  bills.push(bill);
  DB.set('bills', bills);
  DB.setConfig('billCounter', counter + 1);

  // Reduce stock
  let medicines = DB.get('medicines');
  billItems.forEach(item => {
    const idx = medicines.findIndex(m => m.id === item.medicineId);
    if (idx !== -1) {
      medicines[idx].quantity = Math.max(0, medicines[idx].quantity - item.quantity);
    }
  });
  DB.set('medicines', medicines);

  // Create purchase records
  const customer = DB.get('customers').find(c => c.id === customerId);
  let purchases = DB.get('purchases');
  billItems.forEach(item => {
    const purchaseDate = bill.date;
    const finishDate = new Date(purchaseDate);
    finishDate.setDate(finishDate.getDate() + item.daysSupply);

    purchases.push({
      id: DB.generateId(),
      customerId,
      medicineId: item.medicineId,
      medicineName: item.name,
      purchaseDate,
      quantity: item.quantity,
      daysSupply: item.daysSupply,
      finishDate: finishDate.toISOString().split('T')[0],
      billId: bill.id
    });
  });
  DB.set('purchases', purchases);

  // Auto-generate reminders
  autoGenerateReminders();

  // Show bill preview
  showBillPreview(bill, customer);
  showToast(`Bill ${billNumber} generated successfully!`, 'success');

  resetBill();
  updateBadges();
}

function showBillPreview(bill, customer) {
  const preview = document.getElementById('billPreview');
  preview.innerHTML = `
    <div class="bill-preview">
      <div class="bill-header-section">
        <h2>Care N Cure</h2>
        <p>Medical Shop Management System</p>
      </div>
      <div class="bill-info">
        <div><span>Bill No:</span> <strong>${bill.billNumber}</strong></div>
        <div><span>Date:</span> <strong>${formatDate(bill.date)}</strong></div>
        <div><span>Customer:</span> <strong>${customer ? customer.name : 'N/A'}</strong></div>
        <div><span>Payment:</span> <strong>${bill.paymentMode}</strong></div>
      </div>
      <table class="bill-items-table">
        <thead>
          <tr><th>Medicine</th><th>Price</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${bill.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>₹${item.price}</td>
              <td>${item.quantity}</td>
              <td>₹${item.total}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="bill-total">Grand Total: ₹${bill.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
      <p style="text-align:center;margin-top:16px;font-size:12px;color:var(--text-muted);">Thank you for your purchase!</p>
    </div>
  `;
}

// ===================== PURCHASE HISTORY =====================
function renderHistory() {
  const search = document.getElementById('histSearch').value.toLowerCase();
  const custFilter = document.getElementById('histCustomerFilter').value;

  populateHistoryCustomerFilter();

  let purchases = DB.get('purchases');
  if (search) {
    purchases = purchases.filter(p =>
      p.medicineName.toLowerCase().includes(search) ||
      (DB.get('customers').find(c => c.id === p.customerId)?.name || '').toLowerCase().includes(search)
    );
  }
  if (custFilter) {
    purchases = purchases.filter(p => p.customerId === custFilter);
  }

  purchases = purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

  const table = document.getElementById('historyTable');
  if (purchases.length === 0) {
    table.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">&#128196;</div><h3>No purchase records</h3></td></tr>';
    return;
  }

  table.innerHTML = purchases.map(p => {
    const customer = DB.get('customers').find(c => c.id === p.customerId);
    const bill = DB.get('bills').find(b => b.id === p.billId);
    const daysLeft = daysUntil(p.finishDate);
    let status = '';
    if (daysLeft < 0) status = '<span class="badge badge-neutral">Completed</span>';
    else if (daysLeft <= 3) status = '<span class="badge badge-warning">Finishing Soon</span>';
    else status = '<span class="badge badge-success">Active</span>';

    return `<tr>
      <td>${customer ? customer.name : 'N/A'}</td>
      <td>${p.medicineName}</td>
      <td>${p.quantity}</td>
      <td>${formatDate(p.purchaseDate)}</td>
      <td>${p.daysSupply} days</td>
      <td>${formatDate(p.finishDate)} ${status}</td>
      <td>${bill ? bill.billNumber : '-'}</td>
      <td><button class="btn-icon btn-whatsapp" onclick="openWhatsAppReminder('${p.customerId}', '${p.medicineId}', '${p.finishDate}')" title="Send WhatsApp Reminder">&#128172;</button></td>
    </tr>`;
  }).join('');
}

function populateHistoryCustomerFilter() {
  const customers = DB.get('customers');
  const sel = document.getElementById('histCustomerFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Customers</option>' +
    customers.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${c.name}</option>`).join('');
}

// ===================== REMINDERS =====================
function autoGenerateReminders() {
  const purchases = DB.get('purchases');
  const customers = DB.get('customers');
  let reminders = DB.get('reminders');

  purchases.forEach(p => {
    const existing = reminders.find(r => r.medicineId === p.medicineId && r.customerId === p.customerId && r.finishDate === p.finishDate);
    if (!existing) {
      const customer = customers.find(c => c.id === p.customerId);
      const med = DB.get('medicines').find(m => m.id === p.medicineId);
      if (customer && med) {
        reminders.push({
          id: DB.generateId(),
          customerId: p.customerId,
          customerName: customer.name,
          customerMobile: customer.mobile,
          medicineId: p.medicineId,
          medicineName: p.medicineName,
          finishDate: p.finishDate,
          status: 'pending',
          createdAt: new Date().toISOString().split('T')[0]
        });
      }
    }
  });

  DB.set('reminders', reminders);
}

function switchReminderTab(tab) {
  currentReminderTab = tab;
  document.querySelectorAll('#page-reminders .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderReminders();
}

function renderReminders() {
  let reminders = DB.get('reminders');
  reminders = reminders.filter(r => r.status === currentReminderTab);
  reminders.sort((a, b) => new Date(a.finishDate) - new Date(b.finishDate));

  const container = document.getElementById('reminderList');
  if (reminders.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128172;</div><h3>No ${currentReminderTab} reminders</h3><p>${currentReminderTab === 'pending' ? 'Reminders will be auto-generated when customers purchase medicines.' : 'No reminders in this category yet.'}</p></div>`;
    return;
  }

  container.innerHTML = reminders.map(r => {
    const daysLeft = daysUntil(r.finishDate);
    let actionBtns = '';
    if (r.status === 'pending') {
      actionBtns = `
        <button class="btn btn-success btn-sm" onclick="openWhatsAppReminder('${r.customerId}', '${r.medicineId}', '${r.finishDate}')">&#128172; Send</button>
      `;
    }
    return `
      <div class="reminder-item">
        <div class="reminder-icon ${r.status}">${r.status === 'pending' ? '&#9857;' : r.status === 'sent' ? '&#10003;' : '&#10007;'}</div>
        <div class="reminder-info">
          <h4>${r.customerName} - ${r.medicineName}</h4>
          <p>Mobile: ${r.customerMobile} | Finish: ${formatDate(r.finishDate)}${daysLeft >= 0 ? ` (${daysLeft} days left)` : ' (Overdue)'}</p>
        </div>
        <div class="reminder-date">
          ${actionBtns}
          <span class="badge badge-${r.status === 'pending' ? 'warning' : r.status === 'sent' ? 'success' : 'danger'}" style="margin-top:4px;">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ===================== WHATSAPP REMINDER =====================
function openWhatsAppReminder(customerId, medicineId, finishDate) {
  const customer = DB.get('customers').find(c => c.id === customerId);
  const med = DB.get('medicines').find(m => m.id === medicineId);
  if (!customer || !med) return;

  const message = `Hello ${customer.name}, your ${med.name} tablets are about to finish. Please purchase your next medicine on time. Thank you.`;

  currentWhatsAppReminder = { customerId, medicineId, finishDate };

  document.getElementById('whatsappRecipient').textContent = `${customer.name} (${customer.mobile})`;
  document.getElementById('whatsappMessage').textContent = message;
  document.getElementById('whatsappModal').classList.add('active');
}

function sendWhatsAppReminder() {
  if (!currentWhatsAppReminder) return;

  const customer = DB.get('customers').find(c => c.id === currentWhatsAppReminder.customerId);
  const med = DB.get('medicines').find(m => m.id === currentWhatsAppReminder.medicineId);
  if (!customer || !med) return;

  const message = `Hello ${customer.name}, your ${med.name} tablets are about to finish. Please purchase your next medicine on time. Thank you.`;
  const phone = customer.mobile.startsWith('+91') ? customer.mobile : '+91' + customer.mobile;
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  // Update reminder status
  let reminders = DB.get('reminders');
  const reminder = reminders.find(r =>
    r.customerId === currentWhatsAppReminder.customerId &&
    r.medicineId === currentWhatsAppReminder.medicineId &&
    r.finishDate === currentWhatsAppReminder.finishDate
  );

  try {
    window.open(whatsappUrl, '_blank');
    if (reminder) {
      reminder.status = 'sent';
      reminder.sentAt = new Date().toISOString();
    }
    showToast('WhatsApp reminder sent!', 'success');
  } catch (e) {
    if (reminder) {
      reminder.status = 'failed';
    }
    showToast('Failed to send WhatsApp reminder', 'error');
  }

  DB.set('reminders', reminders);
  closeModal('whatsappModal');
  currentWhatsAppReminder = null;
  renderReminders();
  updateBadges();
}

// ===================== BADGES =====================
function updateBadges() {
  const medicines = DB.get('medicines');
  const reminders = DB.get('reminders');
  const lowStock = medicines.filter(m => m.quantity <= (m.lowStockThreshold || 10)).length;
  const pendingReminders = reminders.filter(r => r.status === 'pending').length;

  const medBadge = document.getElementById('navMedAlerts');
  const remBadge = document.getElementById('navRemAlerts');
  const headerStock = document.getElementById('headerStockBadge');
  const headerRem = document.getElementById('headerRemBadge');

  if (lowStock > 0) {
    medBadge.style.display = 'inline';
    medBadge.textContent = lowStock;
    headerStock.style.display = 'flex';
    headerStock.textContent = lowStock;
  } else {
    medBadge.style.display = 'none';
    headerStock.style.display = 'none';
  }

  if (pendingReminders > 0) {
    remBadge.style.display = 'inline';
    remBadge.textContent = pendingReminders;
    headerRem.style.display = 'flex';
    headerRem.textContent = pendingReminders;
  } else {
    remBadge.style.display = 'none';
    headerRem.style.display = 'none';
  }
}

// ===================== UTILITIES =====================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function closeModalOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '&#10003;', error: '&#10007;', warning: '&#9888;' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmModal').classList.add('active');
  document.getElementById('confirmAction').onclick = function() {
    closeModal('confirmModal');
    callback();
  };
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', function() {
  const savedUser = DB.getConfig('currentUser');
  if (savedUser) {
    currentUser = savedUser;
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appLayout').style.display = 'flex';
    document.getElementById('sidebarUserName').textContent = savedUser.name;
    document.getElementById('sidebarAvatar').textContent = savedUser.name.charAt(0).toUpperCase();
    initApp();
  } else {
    initLogin();
  }
});
