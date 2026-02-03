// State management
let consultations = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

// Service rates (must match server config)
const SERVICE_RATES = {
  'Initial Consultation': 100,
  'Consultation': 100,
  'Pathology Review': 85,
  'Follow-up Consultation': 50,
  'Repeat Script': 33
};

// LocalStorage key for approvals
const STORAGE_KEY = 'consultant_invoice_approvals';

// DOM Elements
const elements = {
  monthSelect: document.getElementById('monthSelect'),
  yearSelect: document.getElementById('yearSelect'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
  totalConsultations: document.getElementById('totalConsultations'),
  approvedCount: document.getElementById('approvedCount'),
  pendingCount: document.getElementById('pendingCount'),
  rejectedCount: document.getElementById('rejectedCount'),
  invoiceTotal: document.getElementById('invoiceTotal'),
  serviceTableBody: document.getElementById('serviceTableBody'),
  consultationsTableBody: document.getElementById('consultationsTableBody'),
  statusFilter: document.getElementById('statusFilter'),
  sourceFilter: document.getElementById('sourceFilter'),
  approveAll: document.getElementById('approveAll'),
  rejectAll: document.getElementById('rejectAll'),
  exportCSV: document.getElementById('exportCSV'),
  printSummary: document.getElementById('printSummary'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState')
};

// Initialize the application
function init() {
  populateDateSelectors();
  attachEventListeners();
  loadConsultations();
}

// Populate month and year dropdowns
function populateDateSelectors() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  elements.monthSelect.innerHTML = months
    .map((m, i) => `<option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>${m}</option>`)
    .join('');

  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    years.push(y);
  }
  elements.yearSelect.innerHTML = years
    .map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`)
    .join('');
}

// Attach event listeners
function attachEventListeners() {
  elements.monthSelect.addEventListener('change', handleDateChange);
  elements.yearSelect.addEventListener('change', handleDateChange);
  elements.prevMonth.addEventListener('click', goToPrevMonth);
  elements.nextMonth.addEventListener('click', goToNextMonth);
  elements.statusFilter.addEventListener('change', renderConsultationsTable);
  elements.sourceFilter.addEventListener('change', renderConsultationsTable);
  elements.approveAll.addEventListener('click', approveAllPending);
  elements.rejectAll.addEventListener('click', rejectAllPending);
  elements.exportCSV.addEventListener('click', exportToCSV);
  elements.printSummary.addEventListener('click', () => window.print());
}

// Handle date selection change
function handleDateChange() {
  currentMonth = parseInt(elements.monthSelect.value);
  currentYear = parseInt(elements.yearSelect.value);
  loadConsultations();
}

// Navigate to previous month
function goToPrevMonth() {
  if (currentMonth === 1) {
    currentMonth = 12;
    currentYear--;
  } else {
    currentMonth--;
  }
  elements.monthSelect.value = currentMonth;
  elements.yearSelect.value = currentYear;
  loadConsultations();
}

// Navigate to next month
function goToNextMonth() {
  if (currentMonth === 12) {
    currentMonth = 1;
    currentYear++;
  } else {
    currentMonth++;
  }
  elements.monthSelect.value = currentMonth;
  elements.yearSelect.value = currentYear;
  loadConsultations();
}

// Load consultations from API
async function loadConsultations() {
  showLoading(true);

  try {
    const response = await fetch(`/api/consultations?year=${currentYear}&month=${currentMonth}`);
    const data = await response.json();

    if (data.success) {
      consultations = data.consultations;
      applyStoredApprovals();
      updateUI();
    } else {
      showError(data.error || 'Failed to load consultations');
    }
  } catch (error) {
    console.error('Error loading consultations:', error);
    // For demo purposes, show mock data if API fails
    consultations = getMockData();
    applyStoredApprovals();
    updateUI();
  }

  showLoading(false);
}

// Apply stored approval statuses from localStorage
function applyStoredApprovals() {
  const stored = getStoredApprovals();
  const monthKey = `${currentYear}-${currentMonth}`;

  consultations = consultations.map(c => {
    const key = `${monthKey}_${c.id}`;
    if (stored[key]) {
      return { ...c, status: stored[key] };
    }
    return c;
  });
}

// Get stored approvals from localStorage
function getStoredApprovals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

// Save approval to localStorage
function saveApproval(consultationId, status) {
  const stored = getStoredApprovals();
  const monthKey = `${currentYear}-${currentMonth}`;
  const key = `${monthKey}_${consultationId}`;
  stored[key] = status;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// Update consultation status
function updateConsultationStatus(id, status) {
  const consultation = consultations.find(c => c.id === id);
  if (consultation) {
    consultation.status = status;
    saveApproval(id, status);
    updateUI();
  }
}

// Approve all pending consultations
function approveAllPending() {
  consultations.forEach(c => {
    if (c.status === 'pending') {
      c.status = 'approved';
      saveApproval(c.id, 'approved');
    }
  });
  updateUI();
}

// Reject all pending consultations
function rejectAllPending() {
  consultations.forEach(c => {
    if (c.status === 'pending') {
      c.status = 'rejected';
      saveApproval(c.id, 'rejected');
    }
  });
  updateUI();
}

// Update all UI components
function updateUI() {
  updateSummaryCards();
  updateServiceBreakdown();
  renderConsultationsTable();
}

// Update summary cards
function updateSummaryCards() {
  const approved = consultations.filter(c => c.status === 'approved');
  const pending = consultations.filter(c => c.status === 'pending');
  const rejected = consultations.filter(c => c.status === 'rejected');

  const total = approved.reduce((sum, c) => sum + c.calculatedAmount, 0);

  elements.totalConsultations.textContent = consultations.length;
  elements.approvedCount.textContent = approved.length;
  elements.pendingCount.textContent = pending.length;
  elements.rejectedCount.textContent = rejected.length;
  elements.invoiceTotal.textContent = formatCurrency(total);
}

// Update service breakdown table
function updateServiceBreakdown() {
  const approved = consultations.filter(c => c.status === 'approved');
  const breakdown = {};

  approved.forEach(c => {
    const type = c.serviceType || 'Consultation';
    if (!breakdown[type]) {
      breakdown[type] = { count: 0, rate: c.calculatedAmount, subtotal: 0 };
    }
    breakdown[type].count++;
    breakdown[type].subtotal += c.calculatedAmount;
  });

  elements.serviceTableBody.innerHTML = Object.entries(breakdown)
    .map(([type, data]) => `
      <tr>
        <td>${type}</td>
        <td>${formatCurrency(data.rate)}</td>
        <td>${data.count}</td>
        <td>${formatCurrency(data.subtotal)}</td>
      </tr>
    `)
    .join('');

  if (Object.keys(breakdown).length === 0) {
    elements.serviceTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-secondary);">
          No approved consultations yet
        </td>
      </tr>
    `;
  }
}

// Render consultations table with filters
function renderConsultationsTable() {
  const statusFilter = elements.statusFilter.value;
  const sourceFilter = elements.sourceFilter.value;

  let filtered = consultations;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(c => c.status === statusFilter);
  }

  if (sourceFilter !== 'all') {
    filtered = filtered.filter(c => c.source === sourceFilter);
  }

  if (filtered.length === 0) {
    elements.consultationsTableBody.innerHTML = '';
    elements.emptyState.style.display = 'block';
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.consultationsTableBody.innerHTML = filtered.map(c => `
    <tr>
      <td>${formatDate(c.date)}</td>
      <td>${escapeHtml(c.patientName)}</td>
      <td>${escapeHtml(c.serviceType)}</td>
      <td><span class="source-badge ${c.source}">${c.source}</span></td>
      <td>${formatCurrency(c.calculatedAmount)}</td>
      <td><span class="status-badge ${c.status}">${c.status}</span></td>
      <td>
        <div class="action-buttons">
          ${c.status !== 'approved' ? `
            <button class="btn btn-approve btn-sm" onclick="updateConsultationStatus('${c.id}', 'approved')">
              Approve
            </button>
          ` : ''}
          ${c.status !== 'rejected' ? `
            <button class="btn btn-reject btn-sm" onclick="updateConsultationStatus('${c.id}', 'rejected')">
              Reject
            </button>
          ` : ''}
          ${c.status !== 'pending' ? `
            <button class="btn btn-secondary btn-sm" onclick="updateConsultationStatus('${c.id}', 'pending')">
              Reset
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Export to CSV
function exportToCSV() {
  const approved = consultations.filter(c => c.status === 'approved');
  const headers = ['Date', 'Patient Name', 'Service Type', 'Source', 'Amount'];

  const rows = approved.map(c => [
    formatDate(c.date),
    c.patientName,
    c.serviceType,
    c.source,
    c.calculatedAmount.toFixed(2)
  ]);

  // Add summary
  const total = approved.reduce((sum, c) => sum + c.calculatedAmount, 0);
  rows.push([]);
  rows.push(['', '', '', 'Total:', total.toFixed(2)]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice_${currentYear}_${String(currentMonth).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showLoading(show) {
  elements.loadingState.style.display = show ? 'block' : 'none';
  if (show) {
    elements.consultationsTableBody.innerHTML = '';
    elements.emptyState.style.display = 'none';
  }
}

function showError(message) {
  alert('Error: ' + message);
}

// Mock data for demo/testing when API is not available
function getMockData() {
  return [
    {
      id: 'mock_1',
      source: 'stripe',
      patientName: 'John Smith',
      patientEmail: 'john@example.com',
      serviceType: 'Initial Consultation',
      amount: 100,
      calculatedAmount: 100,
      date: new Date(currentYear, currentMonth - 1, 5).toISOString(),
      status: 'pending'
    },
    {
      id: 'mock_2',
      source: 'stripe',
      patientName: 'Jane Doe',
      patientEmail: 'jane@example.com',
      serviceType: 'Follow-up Consultation',
      amount: 50,
      calculatedAmount: 50,
      date: new Date(currentYear, currentMonth - 1, 10).toISOString(),
      status: 'pending'
    },
    {
      id: 'mock_3',
      source: 'gohighlevel',
      patientName: 'Bob Wilson',
      patientEmail: 'bob@example.com',
      serviceType: 'Pathology Review',
      amount: 0,
      calculatedAmount: 85,
      date: new Date(currentYear, currentMonth - 1, 15).toISOString(),
      status: 'pending'
    },
    {
      id: 'mock_4',
      source: 'stripe',
      patientName: 'Alice Brown',
      patientEmail: 'alice@example.com',
      serviceType: 'Consultation',
      amount: 100,
      calculatedAmount: 100,
      date: new Date(currentYear, currentMonth - 1, 18).toISOString(),
      status: 'pending'
    },
    {
      id: 'mock_5',
      source: 'gohighlevel',
      patientName: 'Charlie Davis',
      patientEmail: 'charlie@example.com',
      serviceType: 'Repeat Script',
      amount: 0,
      calculatedAmount: 33,
      date: new Date(currentYear, currentMonth - 1, 22).toISOString(),
      status: 'pending'
    }
  ];
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Expose functions for inline event handlers
window.updateConsultationStatus = updateConsultationStatus;
