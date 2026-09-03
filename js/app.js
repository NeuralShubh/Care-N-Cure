// v12.0.0 - Care N Cure App Logic
let currentUser = null;
let currentPage = 'dashboard';
let billItems = [];
let currentReminderTab = 'pending';
let currentWhatsAppReminder = null;

// ===================== LOGIN =====================
function initLogin() {
  if (typeof seedData === 'function') seedData();
  let users = DB.get('employees');
  if (!Array.isArray(users) || users.length === 0) {
    users = [
      { id: 'emp1', name: 'Dr. Rajesh Kumar', mobile: '9876543210', address: '123 Medical Lane, Mumbai', designation: 'Owner', joiningDate: '2023-01-15', salary: 50000, isOwner: true },
      { id: 'emp2', name: 'Priya Sharma', mobile: '9876543211', address: '456 Health St, Mumbai', designation: 'Pharmacist', joiningDate: '2023-06-01', salary: 25000, isOwner: false },
      { id: 'emp3', name: 'Amit Patel', mobile: '9876543212', address: '789 Care Ave, Mumbai', designation: 'Cashier', joiningDate: '2024-01-10', salary: 20000, isOwner: false }
    ];
    DB.set('employees', users);
  }

  const sel = document.getElementById('loginUser');
  if (sel) {
    sel.innerHTML = '<option value="">-- Select User --</option>' +
      users.map(u => `<option value="${u.id}">${u.name} (${u.designation})</option>`).join('');
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.onsubmit = function(e) {
      e.preventDefault();
      const currentUsers = DB.get('employees') || users;
      const userId = document.getElementById('loginUser').value;
      const password = document.getElementById('loginPassword').value;
      if (!userId) { showToast('Please select a user', 'error'); return; }
      if (password !== 'admin123') { showToast('Invalid password', 'error'); return; }

      const user = currentUsers.find(u => u.id === userId) || currentUsers[0];
      currentUser = user;
      DB.setConfig('currentUser', user);

      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('appLayout').style.display = 'flex';
      document.getElementById('sidebarUserName').textContent = user.name;
      document.getElementById('sidebarAvatar').textContent = user.name.charAt(0).toUpperCase();

      initApp();
    };
  }
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
    reminders: ['Reminders', 'Manage patient reminders.'],
    messages: ['Messages', 'Manage and customize message templates.']
  };
  if (titles[page]) {
    document.getElementById('pageTitle').textContent = titles[page][0];
    document.getElementById('pageSubtitle').textContent = titles[page][1];
  }

  closeSidebar();
  refreshCurrentPage();
}

function refreshCurrentPage() {
  switch(currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'medicines': renderMedicines(); break;
    case 'customers': renderCustomers(); break;
    case 'reminders': renderReminders(); break;
    case 'messages': renderMessages(); break;
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
  const reminders = DB.get('reminders');

  const lowStockMeds = medicines.filter(m => m.quantity <= (m.lowStockThreshold || 10));
  const expiringSoon = medicines.filter(m => {
    const days = daysUntil(m.expiryDate);
    return days <= 90 && days >= 0;
  });

  const statCust = document.getElementById('statCustomers');
  if (statCust) statCust.textContent = customers.length;
  const statMed = document.getElementById('statMedicines');
  if (statMed) statMed.textContent = medicines.length;
  const statLow = document.getElementById('statLowStock');
  if (statLow) statLow.textContent = lowStockMeds.length;
  const statExp = document.getElementById('statExpiring');
  if (statExp) statExp.textContent = expiringSoon.length;

  // Upcoming reminders
  const pendingReminders = reminders.filter(r => r.status === 'pending').sort((a, b) => new Date(a.finishDate) - new Date(b.finishDate));
  const dashRem = document.getElementById('dashReminders');
  if (dashRem) {
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
  }

  // Low stock
  const dashLowStock = document.getElementById('dashLowStock');
  if (dashLowStock) {
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
  }

  // Expiring
  const dashExpiring = document.getElementById('dashExpiring');
  if (dashExpiring) {
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
}



// ===================== MEDICINES =====================
function renderMedicines() {
  populateMedCategoryFilter();
  const search = document.getElementById('medSearch').value.toLowerCase();
  const category = document.getElementById('medCategoryFilter').value;
  const stockFilterElem = document.getElementById('medStockFilter');
  const stockFilter = stockFilterElem ? stockFilterElem.value : '';

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
    table.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-icon">&#9764;</div><h3>No medicines found</h3></td></tr>';
    return;
  }

  table.innerHTML = medicines.map(m => {
    return `<tr>
      <td><strong>${m.name}</strong></td>
      <td><span class="badge badge-neutral">${m.category}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-edit" onclick="editMedicine('${m.id}')" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" onclick="deleteMedicine('${m.id}')" title="Delete">&#128465;</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function getCategories() {
  const defaultCats = ['Analgesic', 'Antibiotic', 'Antihistamine', 'Antidiabetic', 'Antacid', 'Cardiovascular', 'Vitamin', 'Other'];
  const customCats = DB.get('customCategories') || [];
  const medicines = DB.get('medicines') || [];
  const medCats = medicines.map(m => m.category).filter(Boolean);
  const set = new Set([...defaultCats, ...customCats, ...medCats]);
  return Array.from(set).sort();
}

function populateMedCategoryFilter() {
  const categories = getCategories();
  const sel = document.getElementById('medCategoryFilter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    categories.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

function populateMedCategoryDropdown(selectedVal = '') {
  const categories = getCategories();
  const sel = document.getElementById('medCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Category</option>' +
    categories.map(c => `<option value="${c}" ${c === selectedVal ? 'selected' : ''}>${c}</option>`).join('') +
    '<option value="__add_new__" style="font-weight:600; color:var(--primary);">+ Add New Category...</option>' +
    '<option value="__delete_cat__" style="font-weight:600; color:var(--danger);">&#128465; Delete Category...</option>';
}

function toggleAddCategoryInput(show) {
  const container = document.getElementById('newCategoryContainer');
  if (!container) return;
  const isHidden = container.style.display === 'none' || !container.style.display;
  const shouldShow = show !== undefined ? show : isHidden;
  container.style.display = shouldShow ? 'flex' : 'none';
  if (shouldShow) {
    const input = document.getElementById('newCategoryName');
    if (input) { input.value = ''; input.focus(); }
  }
}

function handleCategorySelectChange(selectElem) {
  if (selectElem.value === '__add_new__') {
    selectElem.value = '';
    toggleAddCategoryInput(true);
  } else if (selectElem.value === '__delete_cat__') {
    selectElem.value = '';
    openDeleteCategoryModal();
  }
}

function openDeleteCategoryModal() {
  const container = document.getElementById('deleteCategoryList');
  if (!container) return;
  const categories = getCategories();
  
  if (categories.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:12px;">No categories available</div>';
  } else {
    container.innerHTML = categories.map(cat => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--body-bg); border-radius:6px; border:1px solid var(--border-light);">
        <span style="font-weight:600; font-size:14px; color:var(--text-primary);">${cat}</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="deleteCategory('${cat}')" style="padding:4px 10px; font-size:12px;">
          &#128465; Delete
        </button>
      </div>
    `).join('');
  }

  document.getElementById('deleteCategoryModal').classList.add('active');
}

function deleteCategory(catName) {
  closeModal('deleteCategoryModal');
  showConfirm('Delete Category', `Are you sure you want to delete the category "${catName}"?`, function() {
    let customCats = DB.get('customCategories') || [];
    customCats = customCats.filter(c => c !== catName);
    DB.set('customCategories', customCats);

    let medicines = DB.get('medicines') || [];
    let updated = false;
    medicines.forEach(m => {
      if (m.category === catName) {
        m.category = 'Other';
        updated = true;
      }
    });
    if (updated) DB.set('medicines', medicines);

    populateMedCategoryDropdown();
    populateMedCategoryFilter();
    renderMedicines();
    showToast(`Category "${catName}" deleted`, 'success');
  });
}

function addNewCategory() {
  const input = document.getElementById('newCategoryName');
  if (!input) return;
  const newCat = input.value.trim();
  if (!newCat) {
    showToast('Please enter a category name', 'error');
    return;
  }

  let customCats = DB.get('customCategories') || [];
  const allCats = getCategories();
  const existingMatch = allCats.find(c => c.toLowerCase() === newCat.toLowerCase());

  if (existingMatch) {
    populateMedCategoryDropdown(existingMatch);
    populateMedCategoryFilter();
    toggleAddCategoryInput(false);
    showToast(`Category "${existingMatch}" selected`, 'info');
    return;
  }

  customCats.push(newCat);
  DB.set('customCategories', customCats);

  populateMedCategoryDropdown(newCat);
  populateMedCategoryFilter();
  toggleAddCategoryInput(false);
  showToast(`Category "${newCat}" added successfully`, 'success');
}

function openMedicineModal(id) {
  document.getElementById('medicineForm').reset();
  document.getElementById('medEditId').value = '';
  document.getElementById('medModalTitle').textContent = 'Add Medicine';
  toggleAddCategoryInput(false);

  const deleteBtn = document.getElementById('medDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = id ? 'inline-flex' : 'none';

  let selectedCat = '';
  if (id) {
    const med = DB.get('medicines').find(m => m.id === id);
    if (med) {
      document.getElementById('medEditId').value = med.id;
      document.getElementById('medModalTitle').textContent = 'Edit Medicine';
      document.getElementById('medName').value = med.name;
      selectedCat = med.category;
    }
  }
  populateMedCategoryDropdown(selectedCat);
  document.getElementById('medicineModal').classList.add('active');
}

function editMedicine(id) { openMedicineModal(id); }

function deleteCurrentEditMedicine() {
  const editId = document.getElementById('medEditId').value;
  if (editId) {
    deleteMedicine(editId);
  }
}

function saveMedicine(e) {
  e.preventDefault();
  const editId = document.getElementById('medEditId').value;
  const nameVal = document.getElementById('medName').value.trim();
  const catVal = document.getElementById('medCategory').value;

  let medicines = DB.get('medicines');
  if (editId) {
    const idx = medicines.findIndex(m => m.id === editId);
    if (idx !== -1) {
      medicines[idx] = {
        ...medicines[idx],
        name: nameVal,
        category: catVal
      };
    }
    showToast('Medicine updated successfully', 'success');
  } else {
    const medData = {
      id: DB.generateId(),
      name: nameVal,
      category: catVal,
      company: '',
      price: 0,
      quantity: 100,
      expiryDate: '2028-12-31',
      lowStockThreshold: 10
    };
    medicines.push(medData);
    showToast('Medicine added successfully', 'success');
  }

  DB.set('medicines', medicines);
  closeModal('medicineModal');
  renderMedicines();
  populateCustMedicineDropdown();
  updateBadges();
}

function deleteMedicine(id) {
  closeModal('medicineModal');
  showConfirm('Delete Medicine', 'Are you sure you want to delete this medicine? This action cannot be undone.', function() {
    let medicines = DB.get('medicines');
    medicines = medicines.filter(m => m.id !== id);
    DB.set('medicines', medicines);
    showToast('Medicine deleted', 'success');
    renderMedicines();
    populateCustMedicineDropdown();
    updateBadges();
  });
}

// ===================== CUSTOMERS =====================
let selectedCustMedicines = {};

function toggleCustMedDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('custMedDropdown');
  if (!dropdown) return;
  const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
  dropdown.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    document.getElementById('custMedSearch').value = '';
    filterCustMedOptions();
  }
}

function clearCustMedSelection(e) {
  if (e) e.stopPropagation();
  selectedCustMedicines = {};
  updateCustMedUI();
}

function saveCustMedSelection(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('custMedDropdown');
  if (dropdown) dropdown.style.display = 'none';
  updateCustMedUI();
}

function filterCustMedOptions() {
  const query = (document.getElementById('custMedSearch').value || '').toLowerCase();
  const options = document.querySelectorAll('#custMedOptionsList .multi-select-option');
  options.forEach(opt => {
    const text = opt.textContent.toLowerCase();
    opt.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

function toggleCustMedSelection(medId, e) {
  if (e) e.stopPropagation();
  const medicines = DB.get('medicines') || [];
  const med = medicines.find(m => m.id === medId);
  if (!med) return;

  if (selectedCustMedicines[medId]) {
    delete selectedCustMedicines[medId];
  } else {
    selectedCustMedicines[medId] = {
      id: med.id,
      name: med.name,
      company: med.company || '',
      price: med.price || 0,
      quantity: 1,
      daysSupply: 7
    };
  }

  updateCustMedUI();
}

function removeCustMed(medId, e) {
  if (e) e.stopPropagation();
  delete selectedCustMedicines[medId];
  updateCustMedUI();
}

function updateCustMedConfig(medId, field, val) {
  if (selectedCustMedicines[medId]) {
    selectedCustMedicines[medId][field] = Math.max(1, parseInt(val) || 1);
  }
}

function updateCustMedUI() {
  const checkboxes = document.querySelectorAll('#custMedOptionsList input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = !!selectedCustMedicines[cb.value];
  });

  const chipsContainer = document.getElementById('custMedSelectedChips');
  if (!chipsContainer) return;
  const selectedList = Object.values(selectedCustMedicines);
  const count = selectedList.length;

  if (count === 0) {
    chipsContainer.innerHTML = '<span class="placeholder-text">-- Select Medicines (Optional) --</span>';
  } else if (count <= 3) {
    chipsContainer.innerHTML = selectedList.map(m => `
      <span class="chip">
        ${m.name}
        <span class="chip-remove" onclick="removeCustMed('${m.id}', event)">&times;</span>
      </span>
    `).join('');
  } else {
    const firstTwo = selectedList.slice(0, 2);
    chipsContainer.innerHTML = firstTwo.map(m => `
      <span class="chip">
        ${m.name}
        <span class="chip-remove" onclick="removeCustMed('${m.id}', event)">&times;</span>
      </span>
    `).join('') + `<span class="badge badge-primary" style="font-size:12px;">+${count - 2} more (${count} selected)</span>`;
  }

  const configList = document.getElementById('custSelectedMedsList');
  if (configList) {
    configList.style.display = 'none';
    configList.innerHTML = '';
  }
}

function populateCustMedicineDropdown() {
  const optionsList = document.getElementById('custMedOptionsList');
  if (!optionsList) return;

  try {
    let medicines = DB.get('medicines');
    if (!Array.isArray(medicines) || medicines.length === 0) {
      medicines = [
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
      DB.set('medicines', medicines);
    }

    const validMedicines = medicines.filter(m => m && m.id && m.name);
    validMedicines.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    optionsList.innerHTML = validMedicines.map(m => {
      const isChecked = !!selectedCustMedicines[m.id];
      return `
        <label class="multi-select-option" onclick="toggleCustMedSelection('${m.id}', event)">
          <input type="checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleCustMedSelection('${m.id}', event)">
          <span>${m.name}</span>
        </label>
      `;
    }).join('');

    updateCustMedUI();
  } catch (err) {
    console.error('Error populating customer medicine dropdown:', err);
  }
}

document.addEventListener('click', function(e) {
  const container = document.getElementById('custMedSelectContainer');
  if (container && !container.contains(e.target)) {
    const dropdown = document.getElementById('custMedDropdown');
    if (dropdown) dropdown.style.display = 'none';
  }
});

function openCustomerWhatsApp(customerId, e) {
  if (e) e.stopPropagation();
  const cust = (DB.get('customers') || []).find(c => c.id === customerId);
  if (!cust || !cust.mobile) {
    showToast('Customer mobile number not available', 'error');
    return;
  }
  const cleanMobile = cust.mobile.replace(/\D/g, '');
  if (!cleanMobile) {
    showToast('Invalid mobile number', 'error');
    return;
  }
  const phone = cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile;

  // Capitalize customer name (e.g. "taniya" -> "Taniya")
  const formattedName = (cust.name || '').trim().replace(/\b\w/g, l => l.toUpperCase());

  // Dynamically fetch medicine name(s) purchased by this customer
  const purchases = DB.get('purchases') || [];
  const reminders = DB.get('reminders') || [];

  const custPurchases = purchases.filter(p => p.customerId === customerId);
  const custReminders = reminders.filter(r => r.customerId === customerId);

  const purMedNames = custPurchases.map(p => p.medicineName).filter(Boolean);
  const remMedNames = custReminders.map(r => r.medicineName).filter(Boolean);

  const allMedNames = [...new Set([...purMedNames, ...remMedNames])];

  const medsString = allMedNames.length > 0 ? allMedNames.join(', ') : 'medicines';

  const messageText = `Hello ${formattedName}, we hope you are doing well. You recently purchased ${medsString} from Care N Cure. Please take your medicine as advised and take good care of yourself. If you need any medicines or healthcare assistance, we are always here for you. Stay healthy! ❤️ – Care N Cure`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`, '_blank');
}

function renderCustomers() {
  populateCustMedicineDropdown();
  const search = document.getElementById('custSearch').value.toLowerCase();
  let customers = DB.get('customers');

  if (search) {
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.mobile.includes(search) ||
      (c.address && c.address.toLowerCase().includes(search))
    );
  }

  const table = document.getElementById('customerTable');
  if (customers.length === 0) {
    table.innerHTML = '<tr><td colspan="4" class="empty-state"><div class="empty-icon">&#9823;</div><h3>No customers found</h3></td></tr>';
    return;
  }

  const waIconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.89 5.83L2.5 21.5l3.82-1.35C7.9 21.32 9.89 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.47 14.38c-.2.57-1.02 1.1-1.63 1.23-.42.09-.97.16-2.82-.6-2.36-.97-3.88-3.37-4-3.53-.12-.16-.97-1.29-.97-2.46 0-1.17.61-1.74.83-1.98.22-.24.48-.3.64-.3s.33 0 .47.01c.15.01.35-.06.55.42.2.48.69 1.68.75 1.8.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.25.25-.11.49.14.24.63 1.04 1.35 1.68.93.83 1.71 1.09 1.95 1.21.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.14 1.15z"/></svg>`;

  table.innerHTML = customers.map(c => {
    return `<tr onclick="viewCustomerHistory('${c.id}')" style="cursor:pointer;" title="Click to view details and actions">
      <td><strong>${c.name}</strong></td>
      <td>${c.address || '-'}</td>
      <td>${c.mobile}</td>
      <td onclick="event.stopPropagation()">
        <button class="whatsapp-link-btn" onclick="openCustomerWhatsApp('${c.id}', event)" title="Chat with ${c.name} on WhatsApp">
          ${waIconSvg}
        </button>
      </td>
    </tr>`;
  }).join('');
}

function openCustomerModal(id) {
  document.getElementById('customerForm').reset();
  document.getElementById('custEditId').value = '';
  document.getElementById('custModalTitle').textContent = 'Add Customer';
  selectedCustMedicines = {};

  populateCustMedicineDropdown();
  const dropdown = document.getElementById('custMedDropdown');
  if (dropdown) dropdown.style.display = 'none';

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
  let customerId = editId;
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
    customerId = DB.generateId();
    custData.id = customerId;
    customers.push(custData);
    showToast('Customer added successfully', 'success');
  }

  DB.set('customers', customers);

  // Save ALL selected medicines for this customer
  const selectedMeds = Object.values(selectedCustMedicines);
  if (selectedMeds.length > 0) {
    let medicines = DB.get('medicines');
    let purchases = DB.get('purchases');
    let reminders = DB.get('reminders');
    const todayStr = new Date().toISOString().split('T')[0];

    selectedMeds.forEach(medConfig => {
      const med = medicines.find(m => m.id === medConfig.id);
      if (med) {
        const qty = parseInt(medConfig.quantity) || 1;
        const days = parseInt(medConfig.daysSupply) || 7;

        const finishDateObj = new Date();
        finishDateObj.setDate(finishDateObj.getDate() + days);
        const finishDateStr = finishDateObj.toISOString().split('T')[0];

        // Add purchase record
        purchases.push({
          id: DB.generateId(),
          customerId: customerId,
          medicineId: med.id,
          medicineName: med.name,
          purchaseDate: todayStr,
          quantity: qty,
          daysSupply: days,
          finishDate: finishDateStr,
          billId: ''
        });

        // Add reminder
        reminders.push({
          id: DB.generateId(),
          customerId: customerId,
          customerName: custData.name,
          customerMobile: custData.mobile,
          medicineId: med.id,
          medicineName: med.name,
          finishDate: finishDateStr,
          status: 'pending',
          createdAt: todayStr
        });

        // Deduct medicine stock
        med.quantity = Math.max(0, med.quantity - qty);
      }
    });

    DB.set('purchases', purchases);
    DB.set('reminders', reminders);
    DB.set('medicines', medicines);
  }

  selectedCustMedicines = {};
  closeModal('customerModal');
  renderCustomers();
  updateBadges();
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

function viewCustomerDetails(customerId) { viewCustomerHistory(customerId); }

function viewCustomerHistory(customerId) {
  const customer = DB.get('customers').find(c => c.id === customerId);
  if (!customer) return;

  const purchases = DB.get('purchases').filter(p => p.customerId === customerId);
  document.getElementById('custHistoryTitle').textContent = `Customer Details`;

  const content = document.getElementById('custHistoryContent');
  
  const customerHeaderHtml = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border-color, #e5e7eb); flex-wrap:wrap; gap:12px;">
      <div>
        <h3 style="margin:0 0 6px 0; font-size:18px; color:var(--text-primary); font-weight:700;">${customer.name}</h3>
        <p style="margin:0 0 4px 0; color:var(--text-secondary); font-size:14px;"><strong>Mobile:</strong> ${customer.mobile}</p>
        <p style="margin:0; color:var(--text-secondary); font-size:14px;"><strong>Address:</strong> ${customer.address || 'N/A'}</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="btn btn-success btn-sm" onclick="openCustomerWhatsApp('${customer.id}', event)" title="Chat on WhatsApp">
          &#128172; WhatsApp
        </button>
        <button class="btn btn-primary btn-sm" onclick="closeModal('custHistoryModal'); editCustomer('${customer.id}')" title="Edit Customer">
          &#9998; Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="closeModal('custHistoryModal'); deleteCustomer('${customer.id}')" title="Delete Customer">
          &#128465; Delete
        </button>
        <button class="btn btn-outline btn-sm" onclick="closeModal('custHistoryModal')" title="Close">
          Close
        </button>
      </div>
    </div>
  `;

  let purchaseTableHtml = '';
  if (purchases.length === 0) {
    purchaseTableHtml = '<div class="empty-state" style="padding:20px;"><div class="empty-icon">&#128196;</div><h3>No purchase history</h3><p>This customer has not purchased any medicines yet.</p></div>';
  } else {
    purchaseTableHtml = `
      <h4 style="margin:0 0 12px 0; font-size:15px; color:var(--text-primary);">Purchase History</h4>
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
                <td><strong>${p.medicineName}</strong></td>
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

  const modalFooterHtml = `
    <div style="display:flex; justify-content:flex-end; margin-top:20px; padding-top:16px; border-top:1px solid var(--border-color, #e5e7eb);">
      <button class="btn btn-outline" onclick="closeModal('custHistoryModal')">Close</button>
    </div>
  `;

  content.innerHTML = customerHeaderHtml + purchaseTableHtml + modalFooterHtml;
  document.getElementById('custHistoryModal').classList.add('active');
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

function openAddReminderModal() {
  const form = document.getElementById('addReminderForm');
  if (form) form.reset();

  const custSel = document.getElementById('addRemCustomer');
  const custs = DB.get('customers') || [];
  if (custSel) {
    custSel.innerHTML = '<option value="">Select Customer</option>' +
      custs.map(c => `<option value="${c.id}">${c.name} (${c.mobile})</option>`).join('');
  }

  const medSel = document.getElementById('addRemMedicine');
  const meds = DB.get('medicines') || [];
  if (medSel) {
    medSel.innerHTML = '<option value="">Select Medicine</option>' +
      meds.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }

  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  const dateInput = document.getElementById('addRemFinishDate');
  if (dateInput) dateInput.value = defaultDate.toISOString().split('T')[0];

  document.getElementById('addReminderModal').classList.add('active');
}

function saveNewReminder(e) {
  e.preventDefault();
  const custId = document.getElementById('addRemCustomer').value;
  const medId = document.getElementById('addRemMedicine').value;
  const finishDate = document.getElementById('addRemFinishDate').value;

  const customers = DB.get('customers') || [];
  const medicines = DB.get('medicines') || [];

  const customer = customers.find(c => c.id === custId);
  const med = medicines.find(m => m.id === medId);

  if (!customer || !med) {
    showToast('Please select valid customer and medicine', 'error');
    return;
  }

  let reminders = DB.get('reminders') || [];
  reminders.push({
    id: DB.generateId(),
    customerId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    medicineId: med.id,
    medicineName: med.name,
    finishDate: finishDate,
    status: 'pending',
    createdAt: new Date().toISOString().split('T')[0]
  });

  DB.set('reminders', reminders);
  closeModal('addReminderModal');
  updateBadges();
  renderReminders();
  showToast('Reminder added successfully', 'success');
}

function switchReminderTab(tab) {
  currentReminderTab = tab;
  document.querySelectorAll('#page-reminders .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderReminders();
}

function renderReminders() {
  const searchInput = document.getElementById('remSearch');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let reminders = DB.get('reminders');
  reminders = reminders.filter(r => r.status === currentReminderTab);

  if (search) {
    reminders = reminders.filter(r =>
      (r.customerName && r.customerName.toLowerCase().includes(search)) ||
      (r.medicineName && r.medicineName.toLowerCase().includes(search)) ||
      (r.customerMobile && r.customerMobile.includes(search))
    );
  }

  reminders.sort((a, b) => new Date(a.finishDate) - new Date(b.finishDate));

  const container = document.getElementById('reminderList');
  if (reminders.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128172;</div><h3>No ${currentReminderTab} reminders found</h3><p>${currentReminderTab === 'pending' ? 'Reminders will be auto-generated when customers purchase medicines.' : 'No reminders in this category.'}</p></div>`;
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
    const defaultMsg = `Hello ${r.customerName}, your ${r.medicineName} tablets are about to finish. Please purchase your next medicine on time. Thank you.`;
    return `
      <div class="reminder-item" style="padding:16px; border-bottom:1px solid var(--border-light); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
        <div style="display:flex; align-items:flex-start; gap:12px; flex:1; min-width:260px;">
          <div class="reminder-icon ${r.status}" style="margin-top:2px;">${r.status === 'pending' ? '&#9857;' : r.status === 'sent' ? '&#10003;' : '&#10007;'}</div>
          <div class="reminder-info">
            <h4 style="margin:0 0 4px 0; font-size:15px; color:var(--text-primary); font-weight:600;">${r.customerName} - ${r.medicineName}</h4>
            <p style="margin:0 0 6px 0; font-size:13px; color:var(--text-secondary);">Mobile: ${r.customerMobile} | Finish: ${formatDate(r.finishDate)}${daysLeft >= 0 ? ` (${daysLeft} days left)` : ' (Overdue)'}</p>
            <div class="message-preview-box" style="font-size:12px; color:var(--text-secondary); background:var(--body-bg); padding:6px 10px; border-radius:6px; border:1px solid var(--border-light);">
              <strong style="color:var(--text-primary);">Message Section:</strong> "${defaultMsg}"
            </div>
          </div>
        </div>
        <div class="reminder-date" style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          ${actionBtns}
          <span class="badge badge-${r.status === 'pending' ? 'warning' : r.status === 'sent' ? 'success' : 'danger'}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
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

  const defaultMessage = `Hello ${customer.name}, your ${med.name} tablets are about to finish. Please purchase your next medicine on time. Thank you.`;

  currentWhatsAppReminder = { customerId, medicineId, finishDate };

  const recipientElem = document.getElementById('whatsappRecipient');
  if (recipientElem) recipientElem.textContent = `${customer.name} (${customer.mobile})`;

  const msgInput = document.getElementById('whatsappMessageText');
  if (msgInput) msgInput.value = defaultMessage;

  document.getElementById('whatsappModal').classList.add('active');
}

function sendWhatsAppReminder() {
  if (!currentWhatsAppReminder) return;

  const customer = DB.get('customers').find(c => c.id === currentWhatsAppReminder.customerId);
  const med = DB.get('medicines').find(m => m.id === currentWhatsAppReminder.medicineId);
  if (!customer || !med) return;

  const msgInput = document.getElementById('whatsappMessageText');
  const message = (msgInput && msgInput.value.trim()) ? msgInput.value.trim() : `Hello ${customer.name}, your ${med.name} tablets are about to finish. Please purchase your next medicine on time. Thank you.`;
  
  const cleanMobile = customer.mobile.replace(/\D/g, '');
  const phone = cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile;
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

// ===================== MESSAGES =====================
function renderMessages() {
  const reminderTemplateInput = document.getElementById('msgTemplateReminder');
  const caringTemplateInput = document.getElementById('msgTemplateCaring');

  const templates = DB.get('messageTemplates') || {
    reminder: 'Hello {customerName}, your {medicineName} tablets are about to finish. Please purchase your next medicine on time. Thank you.',
    caring: 'Hello {customerName}, we hope you are doing well. You recently purchased {medicineName} from Care N Cure. Please take your medicine as advised and take good care of yourself. If you need any medicines or healthcare assistance, we are always here for you. Stay healthy! ❤️ – Care N Cure'
  };

  if (reminderTemplateInput) reminderTemplateInput.value = templates.reminder || '';
  if (caringTemplateInput) caringTemplateInput.value = templates.caring || '';
}

function saveMessageSectionTemplates() {
  const reminderTemplateInput = document.getElementById('msgTemplateReminder');
  const caringTemplateInput = document.getElementById('msgTemplateCaring');

  const templates = {
    reminder: reminderTemplateInput ? reminderTemplateInput.value.trim() : '',
    caring: caringTemplateInput ? caringTemplateInput.value.trim() : ''
  };

  DB.set('messageTemplates', templates);
  showToast('Message templates saved successfully', 'success');
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
