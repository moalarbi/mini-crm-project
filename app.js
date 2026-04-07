// ==========================================
// Mini CRM — app.js
// Arabic RTL | Vanilla JS
// ==========================================

// ---- Configuration ----
// ⚠️ استبدل هذا الرابط بعد نشر Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzbIeV6iN9GCbz5J5IX7qXdBxac2xX8rh-zft_Xw73c-fQJachZfkD8YAxC2mqXrvlygQ/exec';

// ---- App State ----
const state = {
  projects:    [],
  filtered:    [],
  searchQuery: '',
  activeFilter:'all',
  editingId:   null,
  isLoading:   false,
};

// ---- Status Config ----
const STATUS_CONFIG = {
  pending:    { label: 'انتظار',   class: 'badge-pending',    icon: '⏳' },
  inprogress: { label: 'جاري',     class: 'badge-inprogress', icon: '🔄' },
  review:     { label: 'مراجعة',   class: 'badge-review',     icon: '🔍' },
  completed:  { label: 'مكتمل',    class: 'badge-completed',  icon: '✅' },
  paused:     { label: 'موقوف',    class: 'badge-paused',     icon: '⏸️' },
};

const SERVICE_OPTIONS = [
  'تصميم متجر سلة',
  'تصميم متجر زد',
  'إعلانات سناب شات',
  'إعلانات تيك توك',
  'إعلانات ميتا',
  'إعلانات جوجل',
  'SEO وتحسين محركات البحث',
  'تصميم هوية بصرية',
  'إنتاج محتوى',
  'إدارة سوشيال ميديا',
  'تصميم موقع ويب',
  'أخرى',
];

// ---- DOM Helpers ----
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  buildServiceOptions();
  bindFormToggle();
  bindSearch();
  bindFilters();
  bindFormSubmit();
  loadProjects();
});

// ---- API Calls ----
async function apiCall(action, data = {}) {
  const payload  = JSON.stringify({ action, ...data });
  const url      = `${API_URL}?payload=${encodeURIComponent(payload)}`;

  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) throw new Error(`خطأ في الشبكة: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'خطأ غير معروف');
  return json;
}

// ---- Load Projects ----
async function loadProjects() {
  showLoading(true);
  try {
    const res = await apiCall('getProjects');
    state.projects = res.data || [];
    applyFilters();
    updateStats();
    toast('تم تحميل البيانات', 'success');
  } catch (err) {
    toast(err.message, 'error');
    // Demo data when no API yet
    state.projects = getDemoData();
    applyFilters();
    updateStats();
  } finally {
    showLoading(false);
  }
}

// ---- Stats ----
function updateStats() {
  const today = todayStr();
  const all   = state.projects;

  const totalProjects = all.length;
  const totalPaid     = all.reduce((s, p) => s + (parseFloat(p.paid) || 0), 0);
  const totalRemaining= all.reduce((s, p) => s + (parseFloat(p.remaining) || 0), 0);
  const lateCount     = all.filter(p => isLate(p)).length;

  $('#stat-projects').textContent  = totalProjects;
  $('#stat-paid').textContent      = formatMoney(totalPaid);
  $('#stat-remaining').textContent = formatMoney(totalRemaining);
  $('#stat-late').textContent      = lateCount;
}

// ---- Filters & Search ----
function bindSearch() {
  const input = $('#search-input');
  input.addEventListener('input', () => {
    state.searchQuery = input.value.trim().toLowerCase();
    applyFilters();
  });
}

function bindFilters() {
  $$('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });
}

function applyFilters() {
  const today  = todayStr();
  let list     = [...state.projects];

  // Search
  if (state.searchQuery) {
    list = list.filter(p =>
      norm(p.client_name).includes(state.searchQuery) ||
      norm(p.project_name).includes(state.searchQuery) ||
      norm(p.whatsapp).includes(state.searchQuery)
    );
  }

  // Filter chips
  switch (state.activeFilter) {
    case 'inprogress': list = list.filter(p => p.status === 'inprogress'); break;
    case 'completed':  list = list.filter(p => p.status === 'completed');  break;
    case 'pending':    list = list.filter(p => p.status === 'pending');    break;
    case 'late':       list = list.filter(p => isLate(p));                 break;
    case 'unpaid':     list = list.filter(p => (parseFloat(p.remaining)||0) > 0 && p.status !== 'completed'); break;
  }

  state.filtered = list;
  renderTable();
}

// ---- Render Table ----
function renderTable() {
  const tbody = $('#projects-tbody');
  const count = state.filtered.length;

  $('#table-count').textContent = count;

  if (count === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <div class="empty-icon">📂</div>
          <div class="empty-text">لا توجد مشاريع</div>
          <div class="empty-sub">
            ${state.searchQuery || state.activeFilter !== 'all'
              ? 'لم يتطابق أي مشروع مع البحث أو الفلتر'
              : 'اضغط "مشروع جديد" لإضافة أول مشروع'}
          </div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = state.filtered.map(p => buildRow(p)).join('');

  // Animate rows
  $$('tbody tr[data-id]').forEach((row, i) => {
    row.style.opacity = '0';
    row.style.transform = 'translateY(8px)';
    setTimeout(() => {
      row.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      row.style.opacity = '1';
      row.style.transform = 'none';
    }, i * 30);
  });
}

function buildRow(p) {
  const late       = isLate(p);
  const nearDue    = isNearDeadline(p);
  const done       = p.status === 'completed';
  const rowClass   = late ? 'row-late' : (done ? 'row-done' : (nearDue ? 'row-near' : ''));
  const statusConf = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
  const paid       = parseFloat(p.paid)      || 0;
  const remaining  = parseFloat(p.remaining) || 0;
  const price      = parseFloat(p.price)     || 0;
  const progress   = parseInt(p.progress)    || 0;

  const delivLabel = late  ? '<span class="delivery-badge delivery-late">متأخر</span>'
                   : nearDue ? '<span class="delivery-badge delivery-near">قريب</span>'
                   : done    ? '<span class="delivery-badge delivery-ok">مكتمل</span>'
                   : '';

  const waBtn = p.whatsapp
    ? `<a href="https://wa.me/${clean(p.whatsapp)}" target="_blank" class="btn-icon wa" title="واتساب">💬</a>`
    : '';

  const invLink = p.invoice_link
    ? `<a href="${p.invoice_link}" target="_blank" class="invoice-link">🔗 فاتورة</a>`
    : '<span style="color:var(--text-muted);font-size:12px">—</span>';

  return `
    <tr class="${rowClass}" data-id="${p.id}">
      <td data-label="العميل">
        <div class="td-client">
          <div class="client-name">${esc(p.client_name)}</div>
          <div class="client-date">${p.date_added || ''}</div>
        </div>
      </td>
      <td data-label="المشروع">
        <div class="td-project">
          <div class="project-name">${esc(p.project_name)}</div>
          <div class="project-service">${esc(p.service)}</div>
        </div>
      </td>
      <td data-label="واتساب">${waBtn}</td>
      <td data-label="الحالة">
        <span class="badge ${statusConf.class}">${statusConf.label}</span>
      </td>
      <td data-label="التقدم">
        <div class="progress-wrap">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:${progress}%"></div>
          </div>
          <span class="progress-label">${progress}%</span>
        </div>
      </td>
      <td data-label="الدفع">
        <div class="td-payment">
          <div class="pay-row">
            <span class="pay-paid">${formatMoney(paid)}</span>
            <span class="pay-sep">/</span>
            <span style="color:var(--text-muted)">${formatMoney(price)}</span>
          </div>
          ${remaining > 0 ? `<div style="font-size:11px;color:var(--amber)">متبقي ${formatMoney(remaining)}</div>` : ''}
        </div>
      </td>
      <td data-label="موعد التسليم">
        <div class="delivery-wrap">
          <span class="delivery-date">${p.delivery_date || '—'}</span>
          ${delivLabel}
        </div>
      </td>
      <td data-label="الفاتورة">${invLink}</td>
      <td class="td-actions" data-label="إجراءات">
        <div class="actions-wrap">
          ${waBtn ? '' : ''}
          <button class="btn-icon edit"   title="تعديل"       onclick="openEdit('${p.id}')">✏️</button>
          <button class="btn-icon pay"    title="إضافة دفعة"  onclick="openPayment('${p.id}')">💰</button>
          <button class="btn-icon delete" title="حذف"         onclick="confirmDelete('${p.id}', '${esc(p.client_name)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
}

// ---- Form Panel Toggle ----
function bindFormToggle() {
  $('#form-toggle-btn').addEventListener('click', () => {
    const panel = $('#form-panel');
    const icon  = $('#form-toggle-icon');
    panel.classList.toggle('collapsed');
    icon.textContent = panel.classList.contains('collapsed') ? '▼' : '▲';
  });

  $('#btn-add-project').addEventListener('click', () => {
    openAddForm();
  });

  $('#form-cancel').addEventListener('click', resetForm);
}

function openAddForm() {
  state.editingId = null;
  resetForm();
  const panel = $('#form-panel');
  panel.classList.remove('collapsed');
  $('#form-panel-header-title').textContent = '➕ إضافة مشروع جديد';
  $('#form-submit-btn').textContent = '💾 حفظ المشروع';
  window.scrollTo({ top: $('#form-panel').offsetTop - 80, behavior: 'smooth' });
  setTimeout(() => $('#field-client-name').focus(), 300);
}

function openEdit(id) {
  const p = state.projects.find(x => String(x.id) === String(id));
  if (!p) return;

  state.editingId = id;
  const panel = $('#form-panel');
  panel.classList.remove('collapsed');
  $('#form-panel-header-title').textContent = '✏️ تعديل المشروع';
  $('#form-submit-btn').textContent = '💾 حفظ التعديلات';

  $('#field-client-name').value    = p.client_name    || '';
  $('#field-project-name').value   = p.project_name   || '';
  $('#field-whatsapp').value       = p.whatsapp       || '';
  $('#field-service-details').value= p.service_details|| '';
  $('#field-invoice-link').value   = p.invoice_link   || '';
  $('#field-price').value          = p.price          || '';
  $('#field-paid').value           = p.paid           || '';
  $('#field-delivery-date').value  = p.delivery_date  || '';
  $('#field-status').value         = p.status         || 'pending';
  $('#field-progress').value       = p.progress       || '0';
  $('#progress-display').textContent = (p.progress || 0) + '%';

  // Service dropdown
  const sel = $('#field-service');
  const custom = $('#field-service-custom');
  if ([...sel.options].some(o => o.value === p.service)) {
    sel.value = p.service;
    custom.classList.add('hidden');
  } else {
    sel.value = 'أخرى';
    custom.classList.remove('hidden');
    custom.value = p.service;
  }

  window.scrollTo({ top: panel.offsetTop - 80, behavior: 'smooth' });
}

function resetForm() {
  state.editingId = null;
  $('#project-form').reset();
  $('#progress-display').textContent = '0%';
  $('#field-service-custom').classList.add('hidden');
  $('#form-panel-header-title').textContent = '➕ إضافة مشروع جديد';
  $('#form-submit-btn').textContent = '💾 حفظ المشروع';
}

// ---- Build Service Options ----
function buildServiceOptions() {
  const sel = $('#field-service');
  SERVICE_OPTIONS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    const custom = $('#field-service-custom');
    custom.classList.toggle('hidden', sel.value !== 'أخرى');
  });

  $('#field-progress').addEventListener('input', e => {
    $('#progress-display').textContent = e.target.value + '%';
  });
}

// ---- Form Submit ----
function bindFormSubmit() {
  $('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#form-submit-btn');

    const serviceSelect = $('#field-service').value;
    const serviceValue  = serviceSelect === 'أخرى'
      ? $('#field-service-custom').value.trim()
      : serviceSelect;

    const data = {
      client_name:    $('#field-client-name').value.trim(),
      project_name:   $('#field-project-name').value.trim(),
      whatsapp:       $('#field-whatsapp').value.trim().replace(/\D/g, ''),
      service:        serviceValue,
      service_details:$('#field-service-details').value.trim(),
      invoice_link:   $('#field-invoice-link').value.trim(),
      price:          $('#field-price').value,
      paid:           $('#field-paid').value,
      delivery_date:  $('#field-delivery-date').value,
      status:         $('#field-status').value,
      progress:       $('#field-progress').value,
    };

    if (!data.client_name) { toast('اسم العميل مطلوب', 'error'); return; }
    if (!data.project_name) { toast('اسم المشروع مطلوب', 'error'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ جاري الحفظ...';
    showLoading(true);

    try {
      if (state.editingId) {
        await apiCall('updateProject', { id: state.editingId, ...data });
        toast('تم تحديث المشروع بنجاح ✓', 'success');
      } else {
        await apiCall('addProject', data);
        toast('تم إضافة المشروع بنجاح ✓', 'success');
      }
      resetForm();
      $('#form-panel').classList.add('collapsed');
      $('#form-toggle-icon').textContent = '▼';
      await loadProjects();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = state.editingId ? '💾 حفظ التعديلات' : '💾 حفظ المشروع';
      showLoading(false);
    }
  });
}

// ---- Delete ----
function confirmDelete(id, name) {
  const modal = $('#confirm-modal');
  $('#confirm-project-name').textContent = name;
  modal.classList.add('open');

  // Remove old listeners
  const btnConfirm = $('#confirm-delete-btn');
  const newBtn = btnConfirm.cloneNode(true);
  btnConfirm.replaceWith(newBtn);

  newBtn.addEventListener('click', async () => {
    closeModal('confirm-modal');
    showLoading(true);
    try {
      await apiCall('deleteProject', { id });
      toast('تم حذف المشروع', 'success');
      await loadProjects();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      showLoading(false);
    }
  });
}

// ---- Add Payment ----
function openPayment(id) {
  const p = state.projects.find(x => String(x.id) === String(id));
  if (!p) return;

  const modal = $('#payment-modal');
  $('#payment-client-name').textContent  = p.client_name;
  $('#payment-project-name').textContent = p.project_name;
  $('#payment-current-paid').textContent = formatMoney(parseFloat(p.paid) || 0);
  $('#payment-remaining').textContent    = formatMoney(parseFloat(p.remaining) || 0);
  $('#payment-amount').value = '';
  modal.classList.add('open');
  setTimeout(() => $('#payment-amount').focus(), 100);

  const btnSave = $('#payment-save-btn');
  const newBtn  = btnSave.cloneNode(true);
  btnSave.replaceWith(newBtn);

  newBtn.addEventListener('click', async () => {
    const amount = parseFloat($('#payment-amount').value);
    if (!amount || amount <= 0) { toast('أدخل مبلغ صحيح', 'error'); return; }

    newBtn.disabled = true;
    newBtn.textContent = '⏳...';
    showLoading(true);

    try {
      const res = await apiCall('addPayment', { id, amount });
      closeModal('payment-modal');
      toast(`تم إضافة ${formatMoney(amount)} ✓`, 'success');
      await loadProjects();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      newBtn.disabled = false;
      newBtn.textContent = '💰 تأكيد الدفعة';
      showLoading(false);
    }
  });
}

// ---- Modals ----
$$('.modal-close, .modal-cancel').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.closest('.modal-overlay').id;
    closeModal(modalId);
  });
});

$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

function closeModal(id) {
  $(`#${id}`).classList.remove('open');
}

// ---- Helpers ----
function isLate(p) {
  return p.delivery_date &&
    p.delivery_date < todayStr() &&
    p.status !== 'completed';
}

function isNearDeadline(p) {
  if (!p.delivery_date || p.status === 'completed') return false;
  const diff = daysUntil(p.delivery_date);
  return diff >= 0 && diff <= 3;
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d     = new Date(dateStr);
  return Math.ceil((d - today) / 86400000);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatMoney(n) {
  if (isNaN(n)) return '0 ر.س';
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ر.س';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function norm(str) {
  return String(str || '').toLowerCase();
}

function clean(str) {
  return String(str || '').replace(/\D/g, '');
}

// ---- Toast ----
function toast(msg, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ---- Loading ----
function showLoading(show) {
  state.isLoading = show;
  $('#loading-overlay').classList.toggle('hidden', !show);
}

// ---- Refresh Button ----
document.getElementById('btn-refresh').addEventListener('click', loadProjects);

// ---- Demo Data (shown when API not configured) ----
function getDemoData() {
  const today = todayStr();
  const add = (d) => {
    const dt = new Date(); dt.setDate(dt.getDate() + d);
    return dt.toISOString().split('T')[0];
  };
  return [
    {
      id: '1001',
      client_name: 'أحمد المطيري',
      project_name: 'متجر ملابس سلة',
      whatsapp: '966501234567',
      service: 'تصميم متجر سلة',
      service_details: 'تصميم وإعداد المتجر كاملاً مع المنتجات',
      invoice_link: '',
      price: 3500,
      paid: 2000,
      remaining: 1500,
      date_added: add(-15),
      delivery_date: add(-3),   // Late!
      status: 'inprogress',
      progress: 65,
      last_payment_date: add(-10),
    },
    {
      id: '1002',
      client_name: 'نورة العتيبي',
      project_name: 'حملة سناب شات',
      whatsapp: '966559876543',
      service: 'إعلانات سناب شات',
      service_details: 'إدارة حملة إعلانية شهرية',
      invoice_link: 'https://example.com/inv001',
      price: 2200,
      paid: 2200,
      remaining: 0,
      date_added: add(-30),
      delivery_date: add(-5),
      status: 'completed',
      progress: 100,
      last_payment_date: add(-8),
    },
    {
      id: '1003',
      client_name: 'محمد الزهراني',
      project_name: 'هوية بصرية كاملة',
      whatsapp: '966543216789',
      service: 'تصميم هوية بصرية',
      service_details: 'شعار + ألوان + خطوط + تطبيقات',
      invoice_link: '',
      price: 1800,
      paid: 0,
      remaining: 1800,
      date_added: add(-2),
      delivery_date: add(10),
      status: 'pending',
      progress: 0,
      last_payment_date: '',
    },
    {
      id: '1004',
      client_name: 'سارة القحطاني',
      project_name: 'إدارة إنستقرام',
      whatsapp: '966512345678',
      service: 'إدارة سوشيال ميديا',
      service_details: 'نشر يومي + تصاميم + تفاعل',
      invoice_link: 'https://example.com/inv002',
      price: 1200,
      paid: 600,
      remaining: 600,
      date_added: add(-7),
      delivery_date: add(2),    // Near deadline
      status: 'inprogress',
      progress: 45,
      last_payment_date: add(-7),
    },
  ];
}
