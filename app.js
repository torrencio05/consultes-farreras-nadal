/* ============================================================
   FARRERAS NADAL — Shared JavaScript
   ============================================================ */

// ── Config ──────────────────────────────────────────────────
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyBAbGXriiaIADc_wzSKUd-dEpalgSRc14uHautrzw4mSRJTGPBCX1qHYYjqDUVA-LuBQ/exec',
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg','image/png','image/gif','image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
};

// ── URL params ───────────────────────────────────────────────
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key) || '';
}

// ── Fetch helpers ────────────────────────────────────────────
async function apiGet(params = {}) {
  const url = new URL(CONFIG.GAS_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  return data;
}

async function apiPost(payload) {
  const res = await fetch(CONFIG.GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'default', duration = 3500) {
  const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.default}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Modal helpers ────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Tabs ─────────────────────────────────────────────────────
function initTabs(containerSelector = '.tabs-bar') {
  document.querySelectorAll(containerSelector).forEach(bar => {
    const groupEl   = bar.closest('[data-tab-group]');
    const groupName = groupEl ? groupEl.dataset.tabGroup : null;

    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        if (groupName) {
          document.querySelectorAll(`.tab-content[data-tab-group="${groupName}"]`)
            .forEach(c => c.classList.remove('active'));
        }
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');
        // Re-apply search on tab switch so the filter works on the newly visible tab
        applySearch();
      });
    });
  });
}

// ── File upload ──────────────────────────────────────────────
const fileStores = {};

function initFileUpload(areaId) {
  fileStores[areaId] = [];
  const area = document.getElementById(areaId);
  if (!area) return;
  const input = area.querySelector('input[type="file"]');
  const list  = area.querySelector('.file-list');

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files, areaId, list);
  });
  input.addEventListener('change', () => { handleFiles(input.files, areaId, list); input.value = ''; });
}

function handleFiles(fileList, areaId, listEl) {
  Array.from(fileList).forEach(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`L'arxiu "${file.name}" supera els ${CONFIG.MAX_FILE_SIZE_MB} MB.`, 'error'); return;
    }
    if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
      showToast(`Tipus d'arxiu no permès: ${file.type || 'desconegut'}`, 'error'); return;
    }
    fileStores[areaId].push(file);
    renderFileList(areaId, listEl);
  });
}

function renderFileList(areaId, listEl) {
  if (!listEl) return;
  listEl.innerHTML = fileStores[areaId].map((f, i) => `
    <div class="file-item">
      <span class="file-item-name">📎 ${escHtml(f.name)}</span>
      <span style="display:flex;align-items:center;gap:.5rem">
        <span class="file-item-size">${formatBytes(f.size)}</span>
        <button class="file-item-remove" onclick="removeFile('${areaId}', ${i})" title="Eliminar">✕</button>
      </span>
    </div>`).join('');
}

function removeFile(areaId, idx) {
  fileStores[areaId].splice(idx, 1);
  const area = document.getElementById(areaId);
  renderFileList(areaId, area?.querySelector('.file-list'));
}

async function getFilesAsBase64(areaId) {
  const files = fileStores[areaId] || [];
  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve({ nom: file.name, base64: reader.result.split(',')[1], mime: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

// ── Consulta card toggle ─────────────────────────────────────
function initConsultaCards() {
  document.addEventListener('click', e => {
    const header = e.target.closest('.consulta-card-header');
    if (!header) return;
    const card = header.closest('.consulta-card');
    if (card) card.classList.toggle('expanded');
  });
}

// ── Search filter ────────────────────────────────────────────
// applySearch: filters cards inside the currently active tab.
// Called on input, on tab switch, and after every render.
function applySearch() {
  const input = document.getElementById('searchInput');
  const q = input ? input.value.toLowerCase().trim() : '';
  document.querySelectorAll('.tab-content.active .consulta-card').forEach(card => {
    card.style.display = q === '' || card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// initSearch: wires the input once (guards against double-binding on re-render).
function initSearch(inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.searchReady) return;
  input.dataset.searchReady = '1';
  input.addEventListener('input', applySearch);
}

// ── Formatters ───────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function val(v) { return escHtml(v || '—'); }

function parseArxius(str) {
  if (!str) return [];
  return str.split('|||').map(s => s.trim()).filter(Boolean);
}

function badgeHtml(row) {
  const estat = (row.estat || '').toLowerCase();
  const assignat = (row.assignat || '').toLowerCase();
  let html = '';
  if (estat === 'respos') html += '<span class="badge badge-respos">✓ Respost</span>';
  else html += '<span class="badge badge-pendent">⏳ Pendent</span>';
  if (assignat && estat !== 'respos') html += `<span class="badge badge-${assignat}">${cap(assignat)}</span>`;
  return html;
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

function arxiusHtml(arxiusStr, label = 'Arxius adjunts') {
  const urls = parseArxius(arxiusStr);
  if (!urls.length) return '';
  const links = urls.map((url, i) =>
    `<a class="arxiu-btn" href="${escHtml(url)}" target="_blank" rel="noopener">⬇ Arxiu ${i + 1}</a>`
  ).join('');
  return `<div class="arxius-section">
    <div class="arxius-label">📎 ${label}</div>
    <div class="arxius-list">${links}</div>
  </div>`;
}

// ── LocalStorage hidden IDs ───────────────────────────────────
function getHidden(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function hideItem(key, id) {
  const list = getHidden(key);
  if (!list.includes(id)) list.push(id);
  localStorage.setItem(key, JSON.stringify(list));
}

// ── Detail rows builder ───────────────────────────────────────
function detailGrid(items) {
  return `<div class="consulta-details-grid">` + items.map(([lbl, v]) =>
    `<div class="detail-item"><label>${lbl}</label><p>${val(v)}</p></div>`
  ).join('') + `</div>`;
}

// ── Init all shared UI ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initConsultaCards();
});
