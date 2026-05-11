/* ============================================================
   FARRERAS NADAL — Responsable shared logic
   Requires globals set before this script:
     RESPONSABLE      "nadia" | "josep" | "fina"
     LIST_PENDENT     id of pending list container
     LIST_RESPOST     id of responded list container
   ============================================================ */

let allRows = [];

// ── Load ──────────────────────────────────────────────────────
async function load() {
  document.getElementById(LIST_PENDENT).innerHTML =
    '<div class="loading-state"><div class="spinner"></div>Carregant…</div>';
  try {
    const data = await apiGet({ responsable: RESPONSABLE });
    allRows = Array.isArray(data) ? data : (data.rows || []);
    render();
  } catch(err) {
    document.getElementById(LIST_PENDENT).innerHTML = errHtml(err.message);
  }
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const hiddenKey = `${RESPONSABLE}-hidden`;
  const hidden    = getHidden(hiddenKey);
  const rows      = allRows.filter(r => !hidden.includes(String(r.id)));
  const pendents  = rows.filter(r => (r.estat||'').toLowerCase() !== 'respos');
  const respostes = rows.filter(r => (r.estat||'').toLowerCase() === 'respos');

  document.getElementById('statPendent').textContent  = pendents.length;
  document.getElementById('statRespost').textContent  = respostes.length;
  document.getElementById('statTotal').textContent    = rows.length;
  document.getElementById('badgePendent').textContent = pendents.length;
  document.getElementById('badgeRespost').textContent = respostes.length;

  document.getElementById(LIST_PENDENT).innerHTML = pendents.length
    ? pendents.map(r  => cardHtml(r)).join('') : emptyHtml('cap consulta assignada', '📭');
  document.getElementById(LIST_RESPOST).innerHTML = respostes.length
    ? respostes.map(r => cardHtml(r)).join('') : emptyHtml('cap consulta resposta', '✅');

  // Re-apply existing search text after re-render
  applySearch();
}

// ── Card ──────────────────────────────────────────────────────
function cardHtml(r) {
  const arxiusCom  = arxiusHtml(r.arxius, 'Arxius del comercial');
  const arxiusResp = arxiusHtml(r.arxius_resposta, 'Arxius de resposta');
  const respostaSec = r.comentari_intern ? `
    <div class="resposta-box">
      <div class="resposta-label">📨 Resposta enviada</div>
      <div class="resposta-text">${escHtml(r.comentari_intern)}</div>
    </div>` : '';

  const isRespost = (r.estat||'').toLowerCase() === 'respos';
  const actions = isRespost ? `
    <div class="consulta-actions">
      <button class="btn btn-sm btn-amber" onclick="printCard(${r.id})">🖨️ Imprimir</button>
    </div>` : `
    <div class="consulta-actions">
      <button class="btn btn-sm btn-primary" onclick="startRespond(${r.id})">✏️ Respondre</button>
      <button class="btn btn-sm btn-amber"   onclick="printCard(${r.id})">🖨️ Imprimir</button>
    </div>`;

  return `
  <div class="consulta-card" id="card-${r.id}">
    <div class="consulta-card-header">
      <span class="consulta-id">#${val(r.id)}</span>
      <div class="consulta-info">
        <div class="consulta-ref">${val(r.referencia)} — ${val(r.nom_client)}</div>
        <div class="consulta-meta">
          <span>👤 ${val(r.nom_comercial)}</span>
          <span>📅 ${formatDate(r.data_entrada)}</span>
          <span>📋 ${val(r.tipus)}</span>
        </div>
      </div>
      <div class="consulta-badges">${badgeHtml(r)}</div>
      <span class="consulta-chevron">▼</span>
      <button class="card-hide-btn" onclick="event.stopPropagation();hideCard(${r.id})" title="Eliminar consulta">✕</button>
    </div>
    <div class="consulta-card-body">
      ${detailGrid([
        ['Comercial', r.nom_comercial],
        ['Correu', r.correu_comercial],
        ['Referència', r.referencia],
        ['Codi client', r.codi_client],
        ['Nom client', r.nom_client],
        ['Data consulta', formatDate(r.data_consulta)],
        ['Tipus', r.tipus],
        ['Material', r.material],
        ['Mides', r.mides],
        ['Qualitat', r.qualitat],
        ['Nº entregues', r.entregues],
        ['Data entrega', formatDate(r.data_entrega)],
        ['Competència', r.competencia],
      ])}
      ${r.comentaris ? `<div class="consulta-comentari">${escHtml(r.comentaris)}</div>` : ''}
      ${arxiusCom}
      ${respostaSec}
      ${arxiusResp}
      ${actions}
    </div>
  </div>`;
}

// ── Respond ───────────────────────────────────────────────────
let respondingId = null;

function startRespond(id) {
  respondingId = id;
  document.getElementById('respondText').value = '';
  fileStores['uploadRespond'] = [];
  const list = document.querySelector('#uploadRespond .file-list');
  if (list) list.innerHTML = '';
  openModal('modalRespond');
}

document.getElementById('btnSendRespond').addEventListener('click', async () => {
  const text = document.getElementById('respondText').value.trim();
  if (!text) { showToast('Cal escriure una resposta.', 'error'); return; }
  const btn = document.getElementById('btnSendRespond');
  btn.disabled = true; btn.classList.add('btn-loading');
  try {
    const arxius = await getFilesAsBase64('uploadRespond');
    const res = await apiPost({
      accio: 'resposta_responsable',
      id: respondingId,
      responsable: RESPONSABLE,
      comentari: text,
      arxius,
    });
    if (res.ok) {
      showToast('Resposta enviada correctament!', 'success');
      closeModal('modalRespond');
      hideItem(`${RESPONSABLE}-hidden`, String(respondingId));
      load();
    } else throw new Error(res.error || 'Error');
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.classList.remove('btn-loading');
  }
});

// ── Helpers ───────────────────────────────────────────────────
function hideCard(id) {
  hideItem(`${RESPONSABLE}-hidden`, String(id));
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.style.transition = 'opacity .2s, transform .2s';
    card.style.opacity = '0'; card.style.transform = 'translateX(20px)';
    setTimeout(() => card.remove(), 220);
  }
}

function printCard(id) {
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <title>Consulta #${id} — Farreras Nadal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="shared.css" />
    </head><body style="padding:2rem">
    <h2 style="margin-bottom:1.5rem">Farreras Nadal — Consulta #${id}</h2>
    ${card.querySelector('.consulta-card-body').innerHTML}
    </body></html>`);
  w.document.close(); w.print();
}

function emptyHtml(text, icon) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div>
    <h3>No hi ha ${text}</h3><p>Les consultes assignades apareixeran aquí.</p></div>`;
}
function errHtml(msg) {
  return `<div class="empty-state"><div class="empty-state-icon">⚠️</div>
    <h3>Error de connexió</h3><p>${escHtml(msg)}</p></div>`;
}

// ── Boot ─────────────────────────────────────────────────────
initFileUpload('uploadRespond');
initSearch('searchInput');
document.getElementById('btnRefresh').addEventListener('click', load);
load();
