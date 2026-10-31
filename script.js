/* =========================================================
   Student Finance Tracker — script.js
   Vanilla JS • LocalStorage • Chart.js
   ========================================================= */

'use strict';

// =========================================================
// 1. CONSTANTS & DATA
// =========================================================

const STORAGE_KEY = 'sft_transactions';

/** Kategori pemasukan */
const INCOME_CATEGORIES = [
  'Uang Saku', 'Beasiswa', 'Freelance', 'Gaji', 'Lainnya'
];

/** Kategori pengeluaran */
const EXPENSE_CATEGORIES = [
  'Makanan', 'Transportasi', 'Pendidikan', 'Kos',
  'Kebutuhan Pribadi', 'Hiburan', 'Internet', 'Lainnya'
];

/** Format mata uang Rupiah */
const formatRupiah = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

/** Format tanggal ke lokal Indonesia */
const formatDate = (dateStr) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

// =========================================================
// 2. LOCALSTORAGE HELPERS
// =========================================================

/** Ambil semua transaksi dari LocalStorage */
function getTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Simpan array transaksi ke LocalStorage */
function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// =========================================================
// 3. DOM REFERENCES
// =========================================================

// Dashboard
const elTotalBalance  = document.getElementById('totalBalance');
const elTotalIncome   = document.getElementById('totalIncome');
const elTotalExpense  = document.getElementById('totalExpense');
const elTotalCount    = document.getElementById('totalCount');

// Table
const elTransactionBody = document.getElementById('transactionBody');
const elEmptyState      = document.getElementById('emptyState');

// Filter inputs
const elSearchInput    = document.getElementById('searchInput');
const elFilterType     = document.getElementById('filterType');
const elFilterCategory = document.getElementById('filterCategory');
const elFilterDateFrom = document.getElementById('filterDateFrom');
const elFilterDateTo   = document.getElementById('filterDateTo');
const elBtnResetFilter = document.getElementById('btnResetFilter');

// Buttons
const elBtnAddTransaction   = document.getElementById('btnAddTransaction');
const elBtnSaveTransaction  = document.getElementById('btnSaveTransaction');
const elBtnClearAll         = document.getElementById('btnClearAll');
const elBtnConfirmDelete    = document.getElementById('btnConfirmDelete');

// Modal form fields
const elFormId       = document.getElementById('formId');
const elFormDesc     = document.getElementById('formDesc');
const elFormAmount   = document.getElementById('formAmount');
const elFormCategory = document.getElementById('formCategory');
const elFormDate     = document.getElementById('formDate');
const elFormType     = () => document.querySelector('input[name="formType"]:checked');

// Modals (Bootstrap instances)
const transactionModalEl = document.getElementById('transactionModal');
const confirmDeleteModalEl = document.getElementById('confirmDeleteModal');
const transactionModal = new bootstrap.Modal(transactionModalEl);
const confirmDeleteModal = new bootstrap.Modal(confirmDeleteModalEl);

// Chart canvases
const ctxIncomeExpense     = document.getElementById('chartIncomeExpense').getContext('2d');
const ctxExpenseCategory   = document.getElementById('chartExpenseCategory').getContext('2d');
const ctxMonthlyTrend      = document.getElementById('chartMonthlyTrend').getContext('2d');

// =========================================================
// 4. CHART INSTANCES
// =========================================================

/** Chart instances — kept in module scope so they can be destroyed/rebuilt */
let chartIncomeExpense   = null;
let chartExpenseCategory = null;
let chartMonthlyTrend    = null;

// =========================================================
// 5. CATEGORY HELPERS
// =========================================================

/**
 * Populate the form's category <select> based on the selected transaction type.
 * @param {'income'|'expense'} type
 * @param {string} [selected] - Pre-selected category value (for edit mode)
 */
function populateFormCategories(type, selected = '') {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  elFormCategory.innerHTML = '<option value="" disabled selected>-- Pilih kategori --</option>';
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selected) opt.selected = true;
    elFormCategory.appendChild(opt);
  });
}

/**
 * Populate the filter category <select> with all unique categories from transactions,
 * plus static combined lists so users can filter even without prior data.
 */
function populateFilterCategories() {
  const all = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  const unique = [...new Set(all)];
  elFilterCategory.innerHTML = '<option value="all">Semua</option>';
  unique.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    elFilterCategory.appendChild(opt);
  });
}

// =========================================================
// 6. DASHBOARD CALCULATION
// =========================================================

/**
 * Recalculate and render dashboard summary cards.
 * @param {Array} transactions - Full or filtered list (use full list for totals)
 */
function renderDashboard(transactions) {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  elTotalBalance.textContent = formatRupiah(balance);
  elTotalIncome.textContent  = formatRupiah(income);
  elTotalExpense.textContent = formatRupiah(expense);
  elTotalCount.textContent   = transactions.length;

  // Color saldo: merah jika negatif
  elTotalBalance.classList.toggle('text-danger', balance < 0);
  elTotalBalance.classList.toggle('text-success', balance > 0);
  elTotalBalance.classList.remove('text-primary');
}

// =========================================================
// 7. TRANSACTION TABLE RENDERING
// =========================================================

/**
 * Render a single transaction row.
 * Uses textContent to prevent XSS.
 * @param {Object} t - Transaction object
 * @returns {HTMLTableRowElement}
 */
function createTransactionRow(t) {
  const tr = document.createElement('tr');

  // Tanggal
  const tdDate = document.createElement('td');
  tdDate.classList.add('ps-3', 'text-muted', 'small');
  tdDate.textContent = formatDate(t.date);

  // Deskripsi
  const tdDesc = document.createElement('td');
  tdDesc.classList.add('fw-semibold');
  tdDesc.textContent = t.description;

  // Kategori
  const tdCat = document.createElement('td');
  const badgeCat = document.createElement('span');
  badgeCat.classList.add('badge-category');
  badgeCat.textContent = t.category;
  tdCat.appendChild(badgeCat);

  // Jenis
  const tdType = document.createElement('td');
  const badgeType = document.createElement('span');
  if (t.type === 'income') {
    badgeType.className = 'badge-income';
    badgeType.innerHTML = '<i class="bi bi-arrow-down-circle me-1"></i>Pemasukan';
  } else {
    badgeType.className = 'badge-expense';
    badgeType.innerHTML = '<i class="bi bi-arrow-up-circle me-1"></i>Pengeluaran';
  }
  tdType.appendChild(badgeType);

  // Nominal
  const tdAmount = document.createElement('td');
  tdAmount.classList.add('text-end', 'fw-bold');
  tdAmount.classList.add(t.type === 'income' ? 'amount-income' : 'amount-expense');
  tdAmount.textContent = (t.type === 'income' ? '+' : '-') + formatRupiah(t.amount);

  // Aksi
  const tdAction = document.createElement('td');
  tdAction.classList.add('text-center', 'pe-3');

  const btnEdit = document.createElement('button');
  btnEdit.className = 'btn-action btn-action-edit me-1';
  btnEdit.title = 'Edit';
  btnEdit.innerHTML = '<i class="bi bi-pencil-square"></i>';
  btnEdit.addEventListener('click', () => openEditModal(t.id));

  const btnDelete = document.createElement('button');
  btnDelete.className = 'btn-action btn-action-delete';
  btnDelete.title = 'Hapus';
  btnDelete.innerHTML = '<i class="bi bi-trash3"></i>';
  btnDelete.addEventListener('click', () => openDeleteConfirm(t.id, t.description));

  tdAction.appendChild(btnEdit);
  tdAction.appendChild(btnDelete);

  tr.appendChild(tdDate);
  tr.appendChild(tdDesc);
  tr.appendChild(tdCat);
  tr.appendChild(tdType);
  tr.appendChild(tdAmount);
  tr.appendChild(tdAction);

  return tr;
}

/**
 * Render all filtered transactions into the table.
 * @param {Array} transactions
 */
function renderTable(transactions) {
  elTransactionBody.innerHTML = '';

  if (transactions.length === 0) {
    elEmptyState.classList.remove('d-none');
    return;
  }
  elEmptyState.classList.add('d-none');

  // Sort by date descending
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.forEach((t) => {
    elTransactionBody.appendChild(createTransactionRow(t));
  });
}

// =========================================================
// 8. FILTER & SEARCH LOGIC
// =========================================================

/**
 * Get current filter state from the DOM.
 */
function getFilters() {
  return {
    search:   elSearchInput.value.trim().toLowerCase(),
    type:     elFilterType.value,
    category: elFilterCategory.value,
    dateFrom: elFilterDateFrom.value,
    dateTo:   elFilterDateTo.value,
  };
}

/**
 * Apply active filters to the full transactions array.
 * @param {Array} transactions
 * @returns {Array}
 */
function applyFilters(transactions) {
  const { search, type, category, dateFrom, dateTo } = getFilters();

  return transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search)) return false;
    if (type !== 'all' && t.type !== type) return false;
    if (category !== 'all' && t.category !== category) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo   && t.date > dateTo)   return false;
    return true;
  });
}

/**
 * Master refresh: read from storage, apply filters, re-render all UI.
 */
function refreshUI() {
  const all      = getTransactions();
  const filtered = applyFilters(all);

  renderDashboard(all);      // Dashboard always shows totals of ALL transactions
  renderTable(filtered);     // Table shows filtered subset
  renderCharts(all);         // Charts use full dataset
}

// =========================================================
// 9. CHARTS
// =========================================================

/** Chart.js global defaults */
Chart.defaults.font.family = '-apple-system, "Segoe UI", system-ui, sans-serif';
Chart.defaults.font.size   = 12;

/**
 * Destroy a chart instance safely.
 */
function destroyChart(instance) {
  if (instance) instance.destroy();
}

/**
 * Build and render all three charts.
 * @param {Array} transactions
 */
function renderCharts(transactions) {
  renderIncomeExpenseChart(transactions);
  renderExpenseCategoryChart(transactions);
  renderMonthlyTrendChart(transactions);
}

/* ---- 9a. Income vs Expense Bar Chart ---- */
function renderIncomeExpenseChart(transactions) {
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  destroyChart(chartIncomeExpense);
  chartIncomeExpense = new Chart(ctxIncomeExpense, {
    type: 'bar',
    data: {
      labels: ['Pemasukan', 'Pengeluaran'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['rgba(22, 163, 74, 0.8)', 'rgba(220, 38, 38, 0.8)'],
        borderColor:     ['#16a34a', '#dc2626'],
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + formatRupiah(ctx.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' },
          grid: { color: '#f1f5f9' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ---- 9b. Expense by Category Doughnut ---- */
function renderExpenseCategoryChart(transactions) {
  const expenses = transactions.filter(t => t.type === 'expense');

  // Aggregate by category
  const categoryMap = {};
  expenses.forEach(({ category, amount }) => {
    categoryMap[category] = (categoryMap[category] || 0) + amount;
  });

  const labels = Object.keys(categoryMap);
  const data   = Object.values(categoryMap);

  const palette = [
    '#3b82f6','#f97316','#16a34a','#dc2626',
    '#8b5cf6','#0ea5e9','#d97706','#ec4899'
  ];

  destroyChart(chartExpenseCategory);
  chartExpenseCategory = new Chart(ctxExpenseCategory, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, padding: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatRupiah(ctx.parsed)}`
          }
        }
      }
    }
  });
}

/* ---- 9c. Monthly Balance Trend Line Chart ---- */
function renderMonthlyTrendChart(transactions) {
  // Group by YYYY-MM and calculate net balance per month
  const monthMap = {};

  [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(({ date, type, amount }) => {
      const key = date.substring(0, 7); // YYYY-MM
      if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0 };
      if (type === 'income') monthMap[key].income += amount;
      else                   monthMap[key].expense += amount;
    });

  const labels = Object.keys(monthMap).map((key) => {
    const [y, m] = key.split('-');
    return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  });

  const incomeData  = Object.values(monthMap).map(v => v.income);
  const expenseData = Object.values(monthMap).map(v => v.expense);

  destroyChart(chartMonthlyTrend);
  chartMonthlyTrend = new Chart(ctxMonthlyTrend, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, padding: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatRupiah(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => 'Rp ' + (v / 1000).toLocaleString('id-ID') + 'k' },
          grid: { color: '#f1f5f9' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// =========================================================
// 10. FORM HELPERS
// =========================================================

/** Set today's date as the default in the form date field */
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  elFormDate.value = today;
}

/** Clear all form validation states */
function clearFormValidation() {
  [elFormDesc, elFormAmount, elFormCategory, elFormDate].forEach(el => {
    el.classList.remove('is-invalid', 'is-valid');
  });
}

/** Reset form to blank add-new state */
function resetForm() {
  document.getElementById('transactionForm').reset();
  elFormId.value = '';
  clearFormValidation();
  // Default to income
  document.getElementById('typeIncome').checked = true;
  populateFormCategories('income');
  setDefaultDate();
}

/**
 * Validate form inputs.
 * @returns {boolean} true if valid
 */
function validateForm() {
  let valid = true;

  // Type
  if (!elFormType()) {
    document.getElementById('typeError').style.display = 'block';
    valid = false;
  } else {
    document.getElementById('typeError').style.display = 'none';
  }

  // Description
  if (!elFormDesc.value.trim()) {
    elFormDesc.classList.add('is-invalid');
    valid = false;
  } else {
    elFormDesc.classList.remove('is-invalid');
  }

  // Amount
  const amount = parseFloat(elFormAmount.value);
  if (!elFormAmount.value || isNaN(amount) || amount <= 0) {
    elFormAmount.classList.add('is-invalid');
    valid = false;
  } else {
    elFormAmount.classList.remove('is-invalid');
  }

  // Category
  if (!elFormCategory.value) {
    elFormCategory.classList.add('is-invalid');
    valid = false;
  } else {
    elFormCategory.classList.remove('is-invalid');
  }

  // Date
  if (!elFormDate.value) {
    elFormDate.classList.add('is-invalid');
    valid = false;
  } else {
    elFormDate.classList.remove('is-invalid');
  }

  return valid;
}

// =========================================================
// 11. CRUD OPERATIONS
// =========================================================

/** Open modal in CREATE mode */
function openAddModal() {
  resetForm();
  document.getElementById('transactionModalLabel').textContent = 'Tambah Transaksi';
  transactionModal.show();
}

/**
 * Open modal in EDIT mode, pre-filling form with existing transaction data.
 * @param {string} id - Transaction ID
 */
function openEditModal(id) {
  const transactions = getTransactions();
  const t = transactions.find(tx => tx.id === id);
  if (!t) return;

  resetForm();
  document.getElementById('transactionModalLabel').textContent = 'Edit Transaksi';

  elFormId.value       = t.id;
  elFormDesc.value     = t.description;
  elFormAmount.value   = t.amount;
  elFormDate.value     = t.date;

  // Set radio
  const radioEl = document.querySelector(`input[name="formType"][value="${t.type}"]`);
  if (radioEl) radioEl.checked = true;

  // Populate & select category
  populateFormCategories(t.type, t.category);

  transactionModal.show();
}

/** Save transaction (add or update) from the form */
function saveTransaction() {
  if (!validateForm()) return;

  const id          = elFormId.value;
  const type        = elFormType().value;
  const description = elFormDesc.value.trim();
  const amount      = Math.abs(parseFloat(elFormAmount.value));
  const category    = elFormCategory.value;
  const date        = elFormDate.value;

  let transactions = getTransactions();

  if (id) {
    // Update existing
    transactions = transactions.map(t =>
      t.id === id ? { ...t, type, description, amount, category, date } : t
    );
  } else {
    // Add new
    const newTransaction = {
      id: crypto.randomUUID(),
      type,
      description,
      amount,
      category,
      date,
      createdAt: new Date().toISOString(),
    };
    transactions.push(newTransaction);
  }

  saveTransactions(transactions);
  transactionModal.hide();
  refreshUI();
}

// =========================================================
// 12. DELETE LOGIC
// =========================================================

/** ID pending deletion — set when delete button is clicked */
let pendingDeleteId = null;
/** Flag to distinguish single delete vs clear all */
let isClearAll = false;

/**
 * Open the delete confirmation modal for a single transaction.
 * @param {string} id
 * @param {string} description
 */
function openDeleteConfirm(id, description) {
  pendingDeleteId = id;
  isClearAll = false;
  document.getElementById('confirmDeleteTitle').textContent = 'Hapus Transaksi?';
  document.getElementById('confirmDeleteMessage').textContent =
    `"${description}" akan dihapus secara permanen.`;
  confirmDeleteModal.show();
}

/** Open clear-all confirmation */
function openClearAllConfirm() {
  pendingDeleteId = null;
  isClearAll = true;
  document.getElementById('confirmDeleteTitle').textContent = 'Hapus Semua Data?';
  document.getElementById('confirmDeleteMessage').textContent =
    'Seluruh riwayat transaksi akan dihapus secara permanen.';
  confirmDeleteModal.show();
}

/** Execute the confirmed delete action */
function executeDelete() {
  if (isClearAll) {
    saveTransactions([]);
  } else if (pendingDeleteId) {
    const updated = getTransactions().filter(t => t.id !== pendingDeleteId);
    saveTransactions(updated);
    pendingDeleteId = null;
  }
  confirmDeleteModal.hide();
  refreshUI();
}

// =========================================================
// 13. EVENT LISTENERS
// =========================================================

// Open add modal
elBtnAddTransaction.addEventListener('click', openAddModal);

// Save (add / edit)
elBtnSaveTransaction.addEventListener('click', saveTransaction);

// Confirm delete
elBtnConfirmDelete.addEventListener('click', executeDelete);

// Clear all
elBtnClearAll.addEventListener('click', openClearAllConfirm);

// Dynamic category update when transaction type radio changes
document.querySelectorAll('input[name="formType"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    populateFormCategories(radio.value);
  });
});

// Filters — live update on any change
[elSearchInput, elFilterType, elFilterCategory, elFilterDateFrom, elFilterDateTo].forEach(el => {
  el.addEventListener('input', refreshUI);
  el.addEventListener('change', refreshUI);
});

// Reset filters
elBtnResetFilter.addEventListener('click', () => {
  elSearchInput.value    = '';
  elFilterType.value     = 'all';
  elFilterCategory.value = 'all';
  elFilterDateFrom.value = '';
  elFilterDateTo.value   = '';
  refreshUI();
});

// Reset form validation on modal close
transactionModalEl.addEventListener('hidden.bs.modal', () => {
  clearFormValidation();
});

// =========================================================
// 14. INITIALISATION
// =========================================================

function init() {
  populateFilterCategories();
  refreshUI();
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
