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
  initAIAssistant();
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);

// =========================================================
// 15. AI SMART FINANCE ASSISTANT
// =========================================================

/**
 * Endpoint of the PHP backend proxy.
 * All requests to OpenAI are routed through this file
 * so the API key never appears in front-end JS.
 */
const AI_PROXY_URL = 'api/chat.php';

/** In-memory chat history for multi-turn context (user+assistant pairs) */
let chatHistory = [];

/** Suggested quick-question list */
const SUGGESTED_QUESTIONS = [
  'Berapa total pengeluaran saya bulan ini?',
  'Kategori apa yang paling banyak menghabiskan uang?',
  'Apakah pengeluaran saya bulan ini terlalu besar?',
  'Berikan tips agar saya bisa lebih hemat.',
  'Buatkan ringkasan kondisi keuangan saya.',
];

// ---- DOM references for AI section ----
const elChatMessages     = document.getElementById('chatMessages');
const elChatInput        = document.getElementById('chatInput');
const elBtnSendChat      = document.getElementById('btnSendChat');
const elBtnClearChat     = document.getElementById('btnClearChat');
const elTypingIndicator  = document.getElementById('typingIndicator');
const elAiStatusText     = document.getElementById('aiStatusText');
const elSuggestedQs      = document.getElementById('suggestedQuestions');
const elAiQuickSummary   = document.getElementById('aiQuickSummary');

// =========================================================
// 15a. FINANCIAL CONTEXT BUILDER
// =========================================================

/**
 * Build a structured financial context string from the user's transactions.
 * This is injected into the AI system prompt so the model reasons on real data.
 * @returns {string}
 */
function buildFinancialContext() {
  const transactions = getTransactions();

  if (transactions.length === 0) {
    return 'Pengguna belum memiliki data transaksi yang tersimpan.';
  }

  // Aggregate totals
  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;
  const count        = transactions.length;

  // Expense by category
  const catMap = {};
  transactions.filter(t => t.type === 'expense').forEach(({ category, amount }) => {
    catMap[category] = (catMap[category] || 0) + amount;
  });
  const catLines = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0.0';
      return `  - ${cat}: ${formatRupiah(amt)} (${pct}%)`;
    })
    .join('\n');

  // Current month stats
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter(t => t.date.startsWith(thisMonth));
  const monthIncome  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Last 10 transactions as sample
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(t => `  - [${t.date}] ${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} | ${t.category} | ${t.description} | ${formatRupiah(t.amount)}`)
    .join('\n');

  return `DATA KEUANGAN PENGGUNA (real-time dari aplikasi):
Total Transaksi: ${count}
Total Pemasukan (semua waktu): ${formatRupiah(totalIncome)}
Total Pengeluaran (semua waktu): ${formatRupiah(totalExpense)}
Saldo Saat Ini: ${formatRupiah(balance)}

Bulan Ini (${thisMonth}):
  Pemasukan: ${formatRupiah(monthIncome)}
  Pengeluaran: ${formatRupiah(monthExpense)}
  Saldo Bulan Ini: ${formatRupiah(monthIncome - monthExpense)}

Pengeluaran per Kategori (semua waktu):
${catLines || '  (tidak ada pengeluaran)'}

10 Transaksi Terakhir:
${recent}`;
}

// =========================================================
// 15b. AI QUICK SUMMARY (sidebar)
// =========================================================

/**
 * Render the sidebar quick-summary card with key financial metrics.
 * Called on init and after each transaction change (via refreshUI → renderAiSummary).
 */
function renderAiSummary() {
  const transactions = getTransactions();

  if (transactions.length === 0) {
    elAiQuickSummary.innerHTML =
      '<p class="text-muted small mb-0">Belum ada data transaksi. Tambahkan transaksi untuk melihat ringkasan.</p>';
    return;
  }

  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const ratio   = income > 0 ? ((expense / income) * 100).toFixed(0) : '—';

  // Top expense category
  const catMap = {};
  transactions.filter(t => t.type === 'expense').forEach(({ category, amount }) => {
    catMap[category] = (catMap[category] || 0) + amount;
  });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  // Health indicator
  let healthLabel = '🟢 Sehat';
  let healthClass = 'text-success';
  if (income > 0) {
    const r = expense / income;
    if (r > 0.9)      { healthLabel = '🔴 Kritis';  healthClass = 'text-danger'; }
    else if (r > 0.7) { healthLabel = '🟡 Waspadai'; healthClass = 'text-warning'; }
  }

  const items = [
    { label: 'Saldo',            value: formatRupiah(balance),    cls: balance >= 0 ? 'text-success' : 'text-danger' },
    { label: 'Total Pemasukan',  value: formatRupiah(income),     cls: 'text-success' },
    { label: 'Total Pengeluaran',value: formatRupiah(expense),    cls: 'text-danger'  },
    { label: 'Rasio Belanja',    value: `${ratio}%`,              cls: '' },
    { label: 'Terbesar',         value: topCat ? topCat[0] : '—', cls: '' },
    { label: 'Kondisi',          value: healthLabel,              cls: healthClass },
  ];

  elAiQuickSummary.innerHTML = items.map(({ label, value, cls }) => `
    <div class="ai-summary-item">
      <span class="label">${label}</span>
      <span class="value ${cls}">${value}</span>
    </div>`).join('');
}

// =========================================================
// 15c. CHAT MESSAGE RENDERING
// =========================================================

/**
 * Append a message bubble to the chat window.
 * Uses textContent / safe DOM methods to prevent XSS.
 * @param {'user'|'ai'} role
 * @param {string} text
 */
function appendMessage(role, text) {
  const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const row = document.createElement('div');
  row.className = `chat-row ${role}`;

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = `bubble-avatar ${role}`;
  avatar.innerHTML = role === 'ai' ? '<i class="bi bi-robot"></i>' : '<i class="bi bi-person-fill"></i>';

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  // Text (safe)
  const textNode = document.createElement('span');
  textNode.textContent = text;
  bubble.appendChild(textNode);

  // Timestamp
  const time = document.createElement('span');
  time.className = 'chat-time';
  time.textContent = now;
  bubble.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(bubble);
  elChatMessages.appendChild(row);

  // Scroll to bottom
  elChatMessages.scrollTop = elChatMessages.scrollHeight;
}

/**
 * Show or hide the typing indicator and update status text.
 * @param {boolean} show
 */
function setTyping(show) {
  elTypingIndicator.classList.toggle('d-none', !show);
  elBtnSendChat.disabled = show;
  elChatInput.disabled   = show;

  const dot = elAiStatusText.querySelector('.status-dot');
  if (dot) {
    dot.className = `status-dot ${show ? 'busy' : 'online'}`;
  }
  // Replace text node safely
  const textNodes = [...elAiStatusText.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
  textNodes.forEach(n => n.remove());
  elAiStatusText.appendChild(
    document.createTextNode(show ? 'Sedang menganalisis…' : 'Siap membantu kamu')
  );

  if (show) elChatMessages.scrollTop = elChatMessages.scrollHeight;
}

// =========================================================
// 15d. AI API CALL (via PHP proxy)
// =========================================================

/**
 * Send a question to the PHP backend proxy which forwards it to OpenAI.
 * The system message always contains fresh financial context data.
 * @param {string} userMessage
 */
async function sendToAI(userMessage) {
  setTyping(true);

  // Add user message to history
  chatHistory.push({ role: 'user', content: userMessage });

  // System prompt with real financial context
  const systemPrompt = `Kamu adalah Fin, asisten keuangan mahasiswa yang cerdas, ramah, dan berbicara dalam Bahasa Indonesia yang santai namun profesional.

Tugasmu:
1. Menganalisis data keuangan pengguna dan memberikan insight yang relevan.
2. Memberikan rekomendasi penghematan yang realistis untuk mahasiswa.
3. Menjawab pertanyaan keuangan berdasarkan data transaksi aktual yang diberikan.
4. Jika data belum cukup untuk menjawab, sampaikan dengan jujur.
5. JANGAN mengarang nominal, tanggal, atau kategori yang tidak ada di data.
6. Gunakan format yang mudah dibaca: gunakan bullet point atau baris baru jika perlu.

${buildFinancialContext()}`;

  const payload = {
    systemPrompt,
    messages: chatHistory,
  };

  try {
    const res = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Try to parse a JSON error body from our PHP proxy
      const errData = await res.json().catch(() => ({}));
      const serverMsg = errData.error || null;

      // Map each HTTP status to a human-readable explanation.
      // For statuses that carry a meaningful server message (serverMsg), prefer it —
      // our PHP already formats them well. For statuses where PHP is never reached
      // (405 from Live Server, 404 from wrong path) use a hardcoded guide.
      const staticMessages = {
        404: '❌ Endpoint tidak ditemukan (HTTP 404).\nPastikan file api/chat.php ada dan URL sudah benar.\nJangan buka index.html lewat file:// atau Live Server — gunakan XAMPP/Laragon/PHP CLI.',
        405: '⚠️ Method tidak diizinkan (HTTP 405).\n\nIni terjadi karena kamu membuka project melalui VS Code Live Server atau browser langsung (file://).\nLive Server tidak dapat menjalankan PHP.\n\n✅ Solusi:\n1. Install XAMPP atau Laragon\n2. Salin folder project ke htdocs/ (XAMPP) atau www/ (Laragon)\n3. Buka http://localhost/ProjectIBM/\n\nAtau jalankan lewat terminal:\n  php -S localhost:8000\nlalu buka http://localhost:8000/',
        419: '❌ CSRF token tidak valid (HTTP 419).\nCoba refresh halaman, lalu kirim pesan kembali.',
      };

      // For all other statuses, prefer the rich message from our PHP proxy (serverMsg).
      // Fall back to a static message only if PHP returned nothing useful.
      const finalMsg = staticMessages[res.status]
        || serverMsg
        || `❌ Terjadi kesalahan HTTP ${res.status}. Periksa log server untuk detail.`;

      throw new Error(finalMsg);
    }

    const data = await res.json();
    const aiReply = data.reply || 'Maaf, terjadi kesalahan pada respons AI.';

    // Add AI response to history (keep last 20 messages to avoid token overflow)
    chatHistory.push({ role: 'assistant', content: aiReply });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    setTyping(false);
    appendMessage('ai', aiReply);

  } catch (err) {
    setTyping(false);

    // Network-level failure (no response at all — server not running)
    const isNetworkError = err.message.includes('Failed to fetch') ||
                           err.message.includes('NetworkError') ||
                           err.message.includes('net::');
    const errMsg = isNetworkError
      ? '⚠️ Tidak dapat terhubung ke server (network error).\n\nKemungkinan penyebab:\n• Project dibuka lewat VS Code Live Server (tidak bisa PHP)\n• PHP server belum dijalankan\n\n✅ Solusi:\n1. Gunakan XAMPP / Laragon / PHP CLI\n2. Jalankan: php -S localhost:8000\n3. Buka http://localhost:8000/'
      : err.message;

    appendMessage('ai', errMsg);
  }
}

// =========================================================
// 15e. CHAT INTERACTION HANDLERS
// =========================================================

/** Handle sending a user message */
function handleSendMessage() {
  const text = elChatInput.value.trim();
  if (!text) return;

  elChatInput.value = '';
  appendMessage('user', text);
  sendToAI(text);
}

/** Render suggested question buttons */
function renderSuggestedQuestions() {
  elSuggestedQs.innerHTML = '';
  SUGGESTED_QUESTIONS.forEach((q) => {
    const btn = document.createElement('button');
    btn.className = 'suggested-btn';
    btn.textContent = q;
    btn.addEventListener('click', () => {
      elChatInput.value = '';
      appendMessage('user', q);
      sendToAI(q);
    });
    elSuggestedQs.appendChild(btn);
  });
}

/** Show welcome message when chat is empty */
function showWelcomeMessage() {
  const transactions = getTransactions();
  const hasData = transactions.length > 0;
  const welcome = hasData
    ? `Halo! Aku Fin 👋, asisten keuangan AI kamu.\n\nAku sudah membaca ${transactions.length} transaksimu. Tanyakan apa saja tentang kondisi keuanganmu, atau pilih salah satu pertanyaan cepat di sebelah kanan!`
    : 'Halo! Aku Fin 👋, asisten keuangan AI kamu.\n\nKamu belum memiliki data transaksi. Silakan tambahkan beberapa transaksi terlebih dahulu, lalu aku bisa membantumu menganalisis keuanganmu!';
  appendMessage('ai', welcome);
}

/** Clear chat conversation */
function clearChat() {
  elChatMessages.innerHTML = '';
  chatHistory = [];
  showWelcomeMessage();
}

// =========================================================
// 15f. AI SECTION EVENT LISTENERS
// =========================================================

elBtnSendChat.addEventListener('click', handleSendMessage);
elChatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});
elBtnClearChat.addEventListener('click', clearChat);

// =========================================================
// 15g. AUTO-REFRESH AI SUMMARY ON DATA CHANGES
// =========================================================

/**
 * Use a storage event listener so that whenever saveTransactions() writes
 * to LocalStorage the AI Quick Summary card is automatically re-rendered.
 * This works within the same tab because we dispatch the event manually.
 */
function notifyAISummaryUpdate() {
  if (typeof renderAiSummary === 'function') renderAiSummary();
}

// Patch saveTransactions (defined at line ~47) to also trigger AI summary refresh.
// We do this by observing mutations on the totalBalance element — the simplest
// zero-duplication hook that fires after every refreshUI() call without touching
// any existing logic.
(function patchRefreshUIForAI() {
  const target = document.getElementById('totalBalance');
  if (!target) return;
  const observer = new MutationObserver(() => {
    notifyAISummaryUpdate();
  });
  observer.observe(target, { childList: true, subtree: true, characterData: true });
})();

// =========================================================
// 15h. AI ASSISTANT INITIALISATION
// =========================================================

// =========================================================
// 15i. ENVIRONMENT DETECTION
// =========================================================

/**
 * Detect whether the page is running on a static file server (Live Server,
 * file://, etc.) that cannot execute PHP, and display a warning banner.
 *
 * Known non-PHP environments:
 *   - VS Code Live Server  → port 5500 or 5501
 *   - file:// protocol
 *   - Any port that is NOT 80, 443, 8000, 8080, 8888 (common PHP ports)
 */
function detectEnvironment() {
  const { protocol, port, hostname } = window.location;
  const portNum = parseInt(port, 10) || (protocol === 'https:' ? 443 : 80);

  const isFileProtocol  = protocol === 'file:';
  const isLiveServer    = portNum === 5500 || portNum === 5501;
  const isKnownPHPPort  = [80, 443, 8000, 8080, 8888, 8888].includes(portNum);

  // Also flag any localhost port that is clearly not a PHP server
  const isUnknownPort   = hostname === 'localhost' && !isKnownPHPPort && !isLiveServer;

  const banner  = document.getElementById('envWarningBanner');
  const bannerText = document.getElementById('envWarningText');
  if (!banner || !bannerText) return;

  if (isFileProtocol || isLiveServer || isUnknownPort) {
    let msg = '';
    if (isFileProtocol) {
      msg = 'Kamu membuka file langsung dari browser (file://). PHP tidak berjalan di mode ini.';
    } else if (isLiveServer) {
      msg = `VS Code Live Server (port ${portNum}) terdeteksi. Live Server hanya bisa menyajikan file statis — PHP tidak dieksekusi, sehingga fitur AI Agent akan menghasilkan error HTTP 405.`;
    } else {
      msg = `Port ${portNum} terdeteksi. Pastikan PHP server aktif di port ini.`;
    }
    msg += ' Gunakan XAMPP, Laragon, atau perintah <code>php -S localhost:8000</code> lalu buka <strong>http://localhost:8000/</strong>.';

    bannerText.innerHTML = msg;
    banner.classList.remove('d-none');
  }
}

function initAIAssistant() {
  detectEnvironment();
  renderSuggestedQuestions();
  renderAiSummary();
  showWelcomeMessage();
}
