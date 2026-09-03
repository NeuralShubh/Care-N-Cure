// v19.0.0 - Care N Cure App Logic
let currentUser = null;
let currentPage = 'dashboard';
let billItems = [];
let currentReminderTab = 'pending';
let currentWhatsAppReminder = null;

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const userSelect = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPassword');

  const userId = userSelect ? userSelect.value : '';
  const password = passInput ? passInput.value : '';

  if (!userId) {
    showToast('Please select a user', 'error');
    return false;
  }
  if (password !== 'admin123') {
    showToast('Invalid password. Default is admin123', 'error');
    return false;
  }

  let users = DB.get('employees');
  if (!Array.isArray(users) || users.length === 0) {
    users = [
      { id: 'emp1', name: 'Dr. Rajesh Kumar', mobile: '9876543210', address: '123 Medical Lane, Mumbai', designation: 'Owner', joiningDate: '2023-01-15', salary: 50000, isOwner: true },
      { id: 'emp2', name: 'Priya Sharma', mobile: '9876543211', address: '456 Health St, Mumbai', designation: 'Pharmacist', joiningDate: '2023-06-01', salary: 25000, isOwner: false },
      { id: 'emp3', name: 'Amit Patel', mobile: '9876543212', address: '789 Care Ave, Mumbai', designation: 'Cashier', joiningDate: '2024-01-10', salary: 20000, isOwner: false }
    ];
    DB.set('employees', users);
  }

  const user = users.find(u => u.id === userId) || users[0];
  currentUser = user;
  DB.setConfig('currentUser', user);

  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appLayout').style.display = 'flex';

  const nameElem = document.getElementById('sidebarUserName');
  if (nameElem) nameElem.textContent = user.name;
  const avatarElem = document.getElementById('sidebarAvatar');
  if (avatarElem) avatarElem.textContent = user.name.charAt(0).toUpperCase();

  initApp();
  return false;
}

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
  if (sel && sel.options.length <= 1) {
    sel.innerHTML = '<option value="">-- Select User --</option>' +
      users.map(u => `<option value="${u.id}">${u.name} (${u.designation})</option>`).join('');
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
  if (page === 'reminders') page = 'marketing';
  currentPage = page;
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`page-${page}`) || document.getElementById('page-marketing') || document.getElementById('page-reminders');
  if (sec) sec.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`) || document.querySelector(`.nav-item[data-page="reminders"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', "Welcome back! Here's your overview."],
    medicines: ['Medicines', 'Manage medicine inventory.'],
    customers: ['Customers', 'Manage customer records.'],
    marketing: ['Marketing', 'Manage marketing & follow-up messages for customers.'],
    reminders: ['Marketing', 'Manage marketing & follow-up messages for customers.'],
    messages: ['Messages', 'Create and manage reusable marketing message templates.']
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
    case 'marketing':
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
  navigateTo('dashboard');
  autoGenerateReminders();
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

        // Deduct medicine stock
        med.quantity = Math.max(0, med.quantity - qty);
      }
    });

    DB.set('purchases', purchases);
    DB.set('medicines', medicines);
  }

  syncCustomerReminders();
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
    let reminders = DB.get('reminders') || [];
    reminders = reminders.filter(r => r.customerId !== id);
    DB.set('reminders', reminders);
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
  const rems = (DB.get('reminders') || []).filter(r => r.customerId === customerId);

  document.getElementById('custHistoryTitle').textContent = `Customer Details`;
  const content = document.getElementById('custHistoryContent');

  const customerHeaderHtml = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border-color, #e5e7eb); flex-wrap:wrap; gap:12px;">
      <div>
        <h3 style="margin:0 0 6px 0; font-size:18px; color:var(--text-primary); font-weight:700;">${customer.name}</h3>
        <p style="margin:0 0 4px 0; color:var(--text-secondary); font-size:14px;"><strong>Mobile:</strong> ${customer.mobile}</p>
        <p style="margin:0; color:var(--text-secondary); font-size:14px;"><strong>Address:</strong> ${customer.address || 'N/A'}</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="closeModal('custHistoryModal'); openAddReminderModal('${customer.id}')" title="Add Marketing Follow-up">
          + Add Marketing
        </button>
        <button class="btn btn-success btn-sm" onclick="openCustomerWhatsApp('${customer.id}', event)" title="Chat on WhatsApp">
          &#128172; WhatsApp
        </button>
        <button class="btn btn-outline btn-sm" onclick="closeModal('custHistoryModal'); editCustomer('${customer.id}')" title="Edit Customer">
          &#9998; Edit
        </button>
        <button class="btn btn-danger btn-sm" onclick="closeModal('custHistoryModal'); deleteCustomer('${customer.id}')" title="Delete Customer">
          &#128465; Delete
        </button>
      </div>
    </div>
  `;

  let purchaseTableHtml = '';
  if (purchases.length === 0) {
    purchaseTableHtml = '<div class="empty-state" style="padding:16px;"><div class="empty-icon">&#128196;</div><h4>No purchase history</h4></div>';
  } else {
    purchaseTableHtml = `
      <h4 style="margin:0 0 10px 0; font-size:15px; color:var(--text-primary); font-weight:700;">Purchase History</h4>
      <div class="table-container" style="margin-bottom:20px;">
        <table class="data-table">
          <thead><tr><th>Medicine</th><th>Qty</th><th>Purchase Date</th><th>Finish Date</th></tr></thead>
          <tbody>
            ${purchases.map(p => `<tr>
              <td><strong>${p.medicineName}</strong></td>
              <td>${p.quantity}</td>
              <td>${formatDate(p.purchaseDate)}</td>
              <td>${formatDate(p.finishDate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  let remTableHtml = '';
  if (rems.length === 0) {
    remTableHtml = '<div class="empty-state" style="padding:16px;"><div class="empty-icon">&#128100;</div><h4>No marketing follow-ups scheduled</h4></div>';
  } else {
    remTableHtml = `
      <h4 style="margin:16px 0 10px 0; font-size:15px; color:var(--text-primary); font-weight:700;">Marketing & Follow-up History</h4>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${rems.map(r => `<tr>
              <td><strong>${formatDate(r.finishDate)}</strong></td>
              <td><span class="badge badge-${r.status === 'completed' ? 'success' : r.status === 'sent' ? 'info' : 'warning'}">${r.status.toUpperCase()}</span></td>
              <td>
                <button class="btn btn-sm btn-success" onclick="closeModal('custHistoryModal'); sendWhatsAppReminderDirect('${r.id}')">&#128172; Send</button>
              </td>
            </tr>`).join('')}
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

  content.innerHTML = customerHeaderHtml + purchaseTableHtml + remTableHtml + modalFooterHtml;
  document.getElementById('custHistoryModal').classList.add('active');
}



// ===================== MARKETING / REMINDERS =====================
function syncCustomerReminders() {
  const customers = DB.get('customers') || [];
  const purchases = DB.get('purchases') || [];
  let reminders = DB.get('reminders') || [];

  let changed = false;

  customers.forEach(c => {
    const custPurchases = purchases.filter(p => p.customerId === c.id);

    if (custPurchases.length > 0) {
      custPurchases.forEach(p => {
        let existing = reminders.find(r => r.customerId === c.id && (r.medicineId === p.medicineId || r.medicineName === p.medicineName));
        if (!existing) {
          const defaultDateStr = p.finishDate || (function() {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            return d.toISOString().split('T')[0];
          })();
          const defaultMsg = `Hello ${c.name}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️ – Care N Cure`;

          reminders.push({
            id: DB.generateId(),
            customerId: c.id,
            customerName: c.name,
            customerMobile: c.mobile,
            medicineId: p.medicineId,
            medicineName: p.medicineName,
            finishDate: defaultDateStr,
            customMessage: defaultMsg,
            isCustomMessage: false,
            status: 'pending',
            createdAt: new Date().toISOString().split('T')[0]
          });
          changed = true;
        } else {
          if (existing.customerName !== c.name || existing.customerMobile !== c.mobile) {
            existing.customerName = c.name;
            existing.customerMobile = c.mobile;
            changed = true;
          }
        }
      });
    } else {
      let existing = reminders.find(r => r.customerId === c.id);
      if (!existing) {
        const defaultDateStr = (function() {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          return d.toISOString().split('T')[0];
        })();
        const defaultMsg = `Hello ${c.name}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️ – Care N Cure`;

        reminders.push({
          id: DB.generateId(),
          customerId: c.id,
          customerName: c.name,
          customerMobile: c.mobile,
          medicineId: '',
          medicineName: 'Marketing Follow-up',
          finishDate: defaultDateStr,
          customMessage: defaultMsg,
          isCustomMessage: false,
          status: 'pending',
          createdAt: new Date().toISOString().split('T')[0]
        });
        changed = true;
      } else {
        if (existing.customerName !== c.name || existing.customerMobile !== c.mobile) {
          existing.customerName = c.name;
          existing.customerMobile = c.mobile;
          changed = true;
        }
      }
    }
  });

  if (changed) {
    DB.set('reminders', reminders);
  }
}

function autoGenerateReminders() {
  syncCustomerReminders();
}

function addMarketingDateInput() {
  const container = document.getElementById('marketingDateInputsContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.style.alignItems = 'center';
  const defaultDateStr = new Date().toISOString().split('T')[0];
  div.innerHTML = `
    <input type="date" class="form-control marketing-date-picker" value="${defaultDateStr}" required>
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" title="Remove Date">&times;</button>
  `;
  container.appendChild(div);
}

function openAddReminderModal(presetCustId = null) {
  const form = document.getElementById('addReminderForm');
  if (form) form.reset();

  const container = document.getElementById('marketingDateInputsContainer');
  if (container) {
    const defaultDateStr = new Date().toISOString().split('T')[0];
    container.innerHTML = `<input type="date" class="form-control marketing-date-picker" value="${defaultDateStr}" required>`;
  }

  const custSel = document.getElementById('addRemCustomer');
  const custs = DB.get('customers') || [];
  if (custSel) {
    custSel.innerHTML = '<option value="">Select Customer</option>' +
      custs.map(c => `<option value="${c.id}">${c.name} (${c.mobile})</option>`).join('');
    if (presetCustId) custSel.value = presetCustId;
  }

  document.getElementById('addReminderModal').classList.add('active');
}

function saveNewReminder(e) {
  e.preventDefault();
  const custId = document.getElementById('addRemCustomer').value;
  const datePickers = document.querySelectorAll('#marketingDateInputsContainer .marketing-date-picker');

  const customers = DB.get('customers') || [];
  const customer = customers.find(c => c.id === custId);

  if (!customer) {
    showToast('Please select a valid customer', 'error');
    return;
  }

  const dates = [];
  datePickers.forEach(input => {
    if (input.value) dates.push(input.value);
  });

  if (dates.length === 0) {
    showToast('Please select at least one date', 'error');
    return;
  }

  let reminders = DB.get('reminders') || [];
  const tpls = getMarketingTemplates();
  const defaultTpl = tpls[0] ? tpls[0].message : 'Hello {customerName}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️';

  dates.forEach(finishDate => {
    const defaultMsg = defaultTpl.replace(/{customerName}/g, customer.name);
    reminders.push({
      id: DB.generateId(),
      customerId: customer.id,
      customerName: customer.name,
      customerMobile: customer.mobile,
      medicineId: '',
      medicineName: 'Marketing Follow-up',
      finishDate: finishDate,
      customMessage: defaultMsg,
      isCustomMessage: false,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0]
    });
  });

  DB.set('reminders', reminders);
  closeModal('addReminderModal');
  updateBadges();
  renderReminders();
  showToast(`${dates.length} marketing follow-up(s) added successfully`, 'success');
}

function toggleReminderCompleted(remId, e) {
  if (e) e.stopPropagation();
  let reminders = DB.get('reminders') || [];
  const rem = reminders.find(r => r.id === remId);
  if (!rem) return;

  if (rem.status === 'completed') {
    rem.status = 'pending';
    showToast('Marked as Pending', 'info');
  } else {
    rem.status = 'completed';
    rem.completedAt = new Date().toISOString();
    showToast('Marked as Completed', 'success');
  }

  DB.set('reminders', reminders);
  updateBadges();
  renderReminders();
}

function callCustomer(mobile, e) {
  if (e) e.stopPropagation();
  const cleanMobile = (mobile || '').replace(/\D/g, '');
  if (!cleanMobile) {
    showToast('Invalid mobile number', 'error');
    return;
  }
  window.location.href = `tel:${cleanMobile}`;
}

function toggleMarketingRow(remId) {
  const panel = document.getElementById(`marketingPanel_${remId}`);
  const icon = document.getElementById(`toggleIcon_${remId}`);
  if (panel) {
    panel.classList.toggle('open');
    if (icon) {
      icon.innerHTML = panel.classList.contains('open') ? '&#9650;' : '&#9660;';
    }
  }
}

function applyTemplateToReminder(remId, tplIndex) {
  const tpls = getMarketingTemplates();
  const selectedTpl = tpls[tplIndex];
  let reminders = DB.get('reminders') || [];
  const rem = reminders.find(r => r.id === remId);

  if (!selectedTpl || !rem) return;

  const formattedMsg = selectedTpl.message.replace(/{customerName}/g, rem.customerName);
  rem.customMessage = formattedMsg;
  rem.isCustomMessage = true;
  DB.set('reminders', reminders);

  const textarea = document.getElementById(`remMsgInput_${remId}`);
  if (textarea) textarea.value = formattedMsg;

  showToast(`Applied template: "${selectedTpl.title}"`, 'info');
}

function onReminderDateChange(remId, newDateStr) {
  let reminders = DB.get('reminders') || [];
  const rem = reminders.find(r => r.id === remId);
  if (!rem) return;

  rem.finishDate = newDateStr;

  if (!rem.isCustomMessage) {
    const tpls = getMarketingTemplates();
    const defaultTpl = tpls[0] ? tpls[0].message : 'Hello {customerName}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️';
    rem.customMessage = defaultTpl.replace(/{customerName}/g, rem.customerName);
  }

  DB.set('reminders', reminders);
  renderReminders();
  showToast('Date updated', 'info');
}

function onReminderMessageInput(remId, newText) {
  let reminders = DB.get('reminders') || [];
  const rem = reminders.find(r => r.id === remId);
  if (!rem) return;

  rem.customMessage = newText;
  rem.isCustomMessage = true;
  DB.set('reminders', reminders);
}

function saveReminderMessage(remId) {
  const input = document.getElementById(`remMsgInput_${remId}`);
  if (input) {
    onReminderMessageInput(remId, input.value);
    showToast('Message saved successfully', 'success');
  }
}

function sendWhatsAppReminderDirect(remId, e) {
  if (e) e.stopPropagation();
  let reminders = DB.get('reminders') || [];
  const rem = reminders.find(r => r.id === remId);
  if (!rem) return;

  const msgInput = document.getElementById(`remMsgInput_${remId}`);
  let messageText = '';

  if (rem.isCustomMessage && rem.customMessage) {
    messageText = rem.customMessage;
  } else if (msgInput && msgInput.value.trim() && rem.isCustomMessage) {
    messageText = msgInput.value.trim();
  } else {
    const activeTpl = getActiveMarketingTemplate();
    messageText = activeTpl.message.replace(/{customerName}/g, rem.customerName || 'Customer');
  }

  const cleanMobile = (rem.customerMobile || '').replace(/\D/g, '');
  if (!cleanMobile) {
    showToast('Invalid mobile number', 'error');
    return;
  }
  const phone = cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile;
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;

  window.open(whatsappUrl, '_blank');

  rem.status = 'sent';
  rem.sentAt = new Date().toISOString();
  DB.set('reminders', reminders);

  updateBadges();
  renderReminders();
  showToast('WhatsApp opened with active marketing message', 'success');
}

function deleteReminder(id, e) {
  if (e) e.stopPropagation();
  showConfirm('Delete Follow-up', 'Are you sure you want to delete this marketing follow-up?', function() {
    let reminders = DB.get('reminders') || [];
    reminders = reminders.filter(r => r.id !== id);
    DB.set('reminders', reminders);
    showToast('Follow-up deleted successfully', 'success');
    updateBadges();
    renderReminders();
  });
}

function switchReminderTab(tab) {
  currentReminderTab = tab;
  document.querySelectorAll('#page-marketing .tab, #page-reminders .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderReminders();
}

function renderReminders() {
  syncCustomerReminders();
  const searchInput = document.getElementById('remSearch');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let reminders = DB.get('reminders') || [];
  reminders = reminders.filter(r => r.status === currentReminderTab);

  if (search) {
    reminders = reminders.filter(r =>
      (r.customerName && r.customerName.toLowerCase().includes(search)) ||
      (r.medicineName && r.medicineName.toLowerCase().includes(search)) ||
      (r.customerMobile && r.customerMobile.includes(search))
    );
  }

  // Recent upside (newest first)
  reminders.sort((a, b) => new Date(b.createdAt || b.finishDate) - new Date(a.createdAt || a.finishDate));

  const container = document.getElementById('reminderList');
  if (!container) return;

  if (reminders.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128100;</div><h3>No ${currentReminderTab} marketing follow-ups</h3><p>Click "+ Add Marketing Follow-up" button above to add dates for customer follow-up.</p></div>`;
    return;
  }

  const templates = getMarketingTemplates();

  container.innerHTML = reminders.map(r => {
    const daysLeft = daysUntil(r.finishDate);
    let dateBadgeClass = 'badge-info';
    let dateBadgeText = `${daysLeft} days left`;
    if (daysLeft < 0) {
      dateBadgeClass = 'badge-danger';
      dateBadgeText = `${Math.abs(daysLeft)} days overdue`;
    } else if (daysLeft === 0) {
      dateBadgeClass = 'badge-warning';
      dateBadgeText = `Due Today`;
    }

    const currentMsg = r.customMessage || `Hello ${r.customerName}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️`;
    const isChecked = r.status === 'completed';

    const tplOptions = templates.map((t, idx) => `<option value="${idx}">${t.title}</option>`).join('');

    return `
      <div class="marketing-item-card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          
          <!-- Left: Completed Toggle Checkbox & Customer Name / Mobile -->
          <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:240px;">
            <button class="completed-check-btn ${isChecked ? 'checked' : ''}" onclick="toggleReminderCompleted('${r.id}', event)" title="${isChecked ? 'Mark as Pending' : 'Mark as Completed'}">
              ${isChecked ? '&#10003;' : ''}
            </button>
            <div>
              <h4 style="margin:0 0 2px 0; font-size:16px; color:var(--text-primary); font-weight:700;">
                ${r.customerName}
                ${r.medicineName && r.medicineName !== 'Marketing Follow-up' ? `<span style="font-size:13px; font-weight:500; color:var(--primary); margin-left:6px;">(${r.medicineName})</span>` : ''}
              </h4>
              <p style="margin:0; font-size:13px; color:var(--text-secondary);">
                <strong>Mobile:</strong> ${r.customerMobile} | <strong>Date:</strong> ${formatDate(r.finishDate)}
              </p>
            </div>
          </div>

          <!-- Right: WhatsApp Icon, Call Icon, Status Badge & Action Toggle -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <button class="icon-btn-whatsapp" onclick="sendWhatsAppReminderDirect('${r.id}', event)" title="Send WhatsApp Message">
              &#128172;
            </button>
            <button class="icon-btn-call" onclick="callCustomer('${r.customerMobile}', event)" title="Call Customer">
              &#128222;
            </button>
            <span class="badge ${dateBadgeClass}" style="font-size:12px; padding:6px 10px;">${dateBadgeText}</span>
            <button class="btn btn-outline btn-sm" onclick="toggleMarketingRow('${r.id}')" style="padding:5px 10px; font-size:12px;">
              <span id="toggleIcon_${r.id}">&#9660;</span> Actions
            </button>
          </div>
        </div>

        <!-- Expandable Actions & Message Section -->
        <div id="marketingPanel_${r.id}" class="marketing-expanded-panel">
          <div style="background:var(--body-bg); padding:12px; border-radius:8px; border:1px solid var(--border-light); margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <label style="font-size:12px; font-weight:700; color:var(--text-primary);">Select Message Template:</label>
              <select class="form-control" style="font-size:12px; width:auto; padding:4px 8px;" onchange="applyTemplateToReminder('${r.id}', this.value)">
                <option value="">-- Apply Template --</option>
                ${tplOptions}
              </select>
            </div>
            <textarea id="remMsgInput_${r.id}" class="form-control" rows="3" style="font-size:13px; resize:vertical;" oninput="onReminderMessageInput('${r.id}', this.value)" placeholder="Enter marketing message...">${currentMsg}</textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">Set Date:</label>
              <input type="date" value="${r.finishDate}" class="form-control" style="font-size:12px; padding:4px 8px; width:auto;" onchange="onReminderDateChange('${r.id}', this.value)">
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm" onclick="saveReminderMessage('${r.id}')">&#128190; Save Message</button>
              <button class="btn btn-success btn-sm" onclick="sendWhatsAppReminderDirect('${r.id}', event)">&#128172; Send WhatsApp</button>
              <button class="btn btn-outline btn-sm" onclick="viewCustomerDetails('${r.customerId}')">&#128100; Details</button>
              <button class="btn btn-danger btn-sm" onclick="deleteReminder('${r.id}', event)" title="Delete Follow-up">&#128465; Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===================== MESSAGES SECTION =====================
function getMarketingTemplates() {
  let tpls = DB.get('marketingTemplates');
  if (!Array.isArray(tpls) || tpls.length === 0) {
    tpls = [
      {
        id: 'tpl1',
        title: 'General Greeting',
        message: 'Hello {customerName}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️ – Care N Cure'
      },
      {
        id: 'tpl2',
        title: 'Health & Wellness Checkup',
        message: 'Hello {customerName}, we hope you are doing well. Care N Cure is always here for your healthcare & medicine needs. Stay healthy! ❤️'
      },
      {
        id: 'tpl3',
        title: 'Special Discount Offer',
        message: 'Hello {customerName}, special health discounts are live at Care N Cure today! Visit us or call for fast delivery. 🏥 – Care N Cure'
      }
    ];
    DB.set('marketingTemplates', tpls);
  }
  return tpls;
}

function getActiveMarketingTemplateId() {
  let activeId = DB.getConfig('activeMarketingTemplateId');
  const tpls = getMarketingTemplates();
  if (!activeId || !tpls.some(t => t.id === activeId)) {
    activeId = tpls[0] ? tpls[0].id : '';
    DB.setConfig('activeMarketingTemplateId', activeId);
  }
  return activeId;
}

function setActiveMarketingTemplate(id) {
  DB.setConfig('activeMarketingTemplateId', id);
  renderMessages();
  if (currentPage === 'marketing' || currentPage === 'reminders') {
    renderReminders();
  }
  const tpls = getMarketingTemplates();
  const tpl = tpls.find(t => t.id === id);
  const title = tpl ? tpl.title : 'Selected template';
  showToast(`Selected "${title}" for Marketing WhatsApp messages`, 'success');
}

function getActiveMarketingTemplate() {
  const tpls = getMarketingTemplates();
  const activeId = getActiveMarketingTemplateId();
  const active = tpls.find(t => t.id === activeId);
  return active || tpls[0] || { id: 'default', title: 'Default Offer', message: 'Hello {customerName}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️ – Care N Cure' };
}

function renderMessages() {
  const container = document.getElementById('marketingTemplatesList');
  if (!container) return;

  const tpls = getMarketingTemplates();
  const activeId = getActiveMarketingTemplateId();

  if (tpls.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">&#128172;</div>
        <h3>No message templates found</h3>
        <p>Click "+ Add Message Template" to create a new reusable template.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tpls.map(t => {
    const isActive = t.id === activeId;
    return `
      <div class="card" style="margin:0; border:${isActive ? '2px solid #0ea5e9' : '1px solid var(--border-color, #e2e8f0)'}; transition:all 0.2s ease; box-shadow:${isActive ? '0 4px 14px rgba(14, 165, 233, 0.15)' : 'none'};">
        <div class="card-body" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="text" id="tplTitle_${t.id}" class="form-control" value="${t.title}" style="font-weight:700; font-size:15px; background:var(--body-bg, #f8fafc);" placeholder="Template Title">
            <button class="btn btn-sm btn-danger" onclick="deleteMessageTemplateItem('${t.id}')" title="Delete Template" style="padding:5px 10px; border-radius:6px;">&#128465;</button>
          </div>
          
          <div style="margin-bottom:14px;">
            <textarea id="tplMsg_${t.id}" class="form-control" rows="4" style="font-size:13px; resize:vertical; background:var(--body-bg, #f8fafc); line-height:1.5;" placeholder="Enter template message...">${t.message}</textarea>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            ${isActive ? `
              <span class="badge badge-success" style="padding:6px 12px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px; background:#22c55e; color:#fff;">
                &#10003; Selected for Marketing
              </span>
            ` : `
              <button class="btn btn-sm btn-outline" onclick="setActiveMarketingTemplate('${t.id}')" style="font-weight:600; font-size:12px;">
                Select for Marketing
              </button>
            `}
            <button class="btn btn-sm btn-primary" onclick="saveMessageTemplateItem('${t.id}')" style="font-weight:600; font-size:12px;">
              &#128190; Save Template
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddMessageTemplateModal() {
  const form = document.getElementById('addMessageTemplateForm');
  if (form) form.reset();
  document.getElementById('addMessageTemplateModal').classList.add('active');
}

function saveNewMessageTemplate(e) {
  e.preventDefault();
  const title = document.getElementById('newTplTitle').value.trim();
  const message = document.getElementById('newTplMessage').value.trim();

  if (!title || !message) {
    showToast('Please enter both title and message content', 'error');
    return;
  }

  let tpls = getMarketingTemplates();
  const newId = DB.generateId();
  tpls.push({
    id: newId,
    title: title,
    message: message
  });

  DB.set('marketingTemplates', tpls);
  if (tpls.length === 1) {
    DB.setConfig('activeMarketingTemplateId', newId);
  }

  closeModal('addMessageTemplateModal');
  renderMessages();
  showToast('New message template created', 'success');
}

function saveMessageTemplateItem(id) {
  const titleInput = document.getElementById(`tplTitle_${id}`);
  const msgInput = document.getElementById(`tplMsg_${id}`);

  if (!titleInput || !msgInput) return;

  let tpls = getMarketingTemplates();
  const tpl = tpls.find(t => t.id === id);
  if (tpl) {
    tpl.title = titleInput.value.trim();
    tpl.message = msgInput.value.trim();
    DB.set('marketingTemplates', tpls);
    showToast('Template saved successfully', 'success');
  }
}

function deleteMessageTemplateItem(id) {
  showConfirm('Delete Template', 'Are you sure you want to delete this message template?', function() {
    let tpls = getMarketingTemplates();
    tpls = tpls.filter(t => t.id !== id);
    DB.set('marketingTemplates', tpls);
    const activeId = DB.getConfig('activeMarketingTemplateId');
    if (activeId === id && tpls.length > 0) {
      DB.setConfig('activeMarketingTemplateId', tpls[0].id);
    }
    renderMessages();
    showToast('Template deleted', 'success');
  });
}

// ===================== WHATSAPP REMINDER =====================
function openWhatsAppReminder(customerId, medicineId, finishDate) {
  const customer = DB.get('customers').find(c => c.id === customerId);
  if (!customer) return;

  const defaultMessage = `Hello ${customer.name}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️ – Care N Cure`;

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
  if (!customer) return;

  const msgInput = document.getElementById('whatsappMessageText');
  const message = (msgInput && msgInput.value.trim()) ? msgInput.value.trim() : `Hello ${customer.name}, greetings from Care N Cure! How can we assist you today? Stay healthy! ❤️`;
  
  const cleanMobile = customer.mobile.replace(/\D/g, '');
  const phone = cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile;
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  let reminders = DB.get('reminders');
  const reminder = reminders.find(r =>
    r.customerId === currentWhatsAppReminder.customerId
  );

  try {
    window.open(whatsappUrl, '_blank');
    if (reminder) {
      reminder.status = 'sent';
      reminder.sentAt = new Date().toISOString();
    }
    showToast('WhatsApp message sent!', 'success');
  } catch (e) {
    if (reminder) {
      reminder.status = 'failed';
    }
    showToast('Failed to send WhatsApp message', 'error');
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
    if (medBadge) { medBadge.style.display = 'inline'; medBadge.textContent = lowStock; }
    if (headerStock) { headerStock.style.display = 'flex'; headerStock.textContent = lowStock; }
  } else {
    if (medBadge) medBadge.style.display = 'none';
    if (headerStock) headerStock.style.display = 'none';
  }

  if (pendingReminders > 0) {
    if (remBadge) { remBadge.style.display = 'inline'; remBadge.textContent = pendingReminders; }
    if (headerRem) { headerRem.style.display = 'flex'; headerRem.textContent = pendingReminders; }
  } else {
    if (remBadge) remBadge.style.display = 'none';
    if (headerRem) headerRem.style.display = 'none';
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
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function closeModalOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
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
