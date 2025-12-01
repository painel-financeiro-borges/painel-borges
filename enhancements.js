/* enhancements.js
   Adiciona:
   - Aba "Ativos & Passivos" (criar/editar/transações/grafico pequeno)
   - Aba "Lembretes" (alertas e lembretes)
   - Botões de ocultar por aba
   - Botões de ocultar áreas do Dashboard
   Design inalterado. Não destrutivo.
*/

(function () {
  // ---------- UTILITÁRIOS / FALBACKS ----------
  const has = (name) => typeof window[name] === 'function';
  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));
  const nowISO = () => (new Date()).toISOString();
  const uid = (prefix = 'id') => (prefix + '_' + Math.random().toString(36).slice(2, 10));
  const safeFormatMoney = (v) => (typeof formatMoney === 'function' ? formatMoney(v) : (typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : v));
  const safeShowModal = (title, html, cb) => {
    if (typeof showModal === 'function') return showModal(title, html, cb);
    // fallback: simple prompt-based edit (very small fallback)
    const ok = confirm(title + '\n\n' + (html || ''));
    if (ok && typeof cb === 'function') cb();
  };

  // Ensure global state exists
  if (!window.state) window.state = { reservas: [], transacoes: [], investimentos: [], fluxo: [], custo: [], planejamento: {}, caderno: [], settings: { hideValues: false } };

  if (!state.assets) state.assets = []; // where assets will be stored
  if (!state.alertas) state.alertas = []; // where alerts/reminders will be stored

  // Ensure saveLocal exists; if not provide safe fallback that stores to localStorage
  if (typeof saveLocal !== 'function') {
    window.saveLocal = function () {
      try { localStorage.setItem('borges_panel_3_v1', JSON.stringify(state)); } catch (e) { console.warn('saveLocal fallback failed', e); }
      if (typeof renderAll === 'function') renderAll();
    };
  }

  // ---------- HELPERS TO MANAGE HIDE STATE ----------
  if (!state.settings) state.settings = { hideValues: false };
  if (!state.settings.hiddenAreas) state.settings.hiddenAreas = {}; // { areaId: true }
  if (!state.settings.hiddenTabs) state.settings.hiddenTabs = {}; // { tabId: true }

  function toggleAreaHide(areaId) {
    state.settings.hiddenAreas[areaId] = !state.settings.hiddenAreas[areaId];
    saveLocal();
    applyAreaHides();
  }
  function toggleTabHide(tabId) {
    state.settings.hiddenTabs[tabId] = !state.settings.hiddenTabs[tabId];
    saveLocal();
    applyTabHides();
  }

  function applyAreaHides() {
    // mapping of known area ids to selectors — if the selectors exist, hide them
    const map = {
      'dash_top_stats': '#dash_top_stats',
      'dash_result': '#dash_result',
      'dash_summary': '#dash_summary',
      'dash_reservas': '#dash_reservas_total',
      'dash_invest': '#dash_invest_total'
    };
    Object.keys(map).forEach(k => {
      const sel = map[k];
      const node = document.querySelector(sel);
      if (!node) return;
      node.style.display = state.settings.hiddenAreas[k] ? 'none' : '';
    });
  }

  function applyTabHides() {
    // hide pages by id if requested
    Object.keys(state.settings.hiddenTabs).forEach(tabId => {
      const page = document.getElementById(tabId);
      if (page) page.style.display = state.settings.hiddenTabs[tabId] ? 'none' : '';
    });
  }

  // ---------- UI INSERTION ----------
  function insertPrivacyControls() {
    // locate dashboard header area — safe fallback: insert near h2 with text "Dashboard"
    const dashboardH2 = Array.from(document.querySelectorAll('h2')).find(h => /Dashboard/i.test(h.innerText));
    if (!dashboardH2) return;
    // don't insert twice
    if (document.getElementById('enh_privacy_controls')) return;

    const container = document.createElement('div');
    container.id = 'enh_privacy_controls';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';
    container.style.marginTop = '8px';

    const addBtn = (text, onclick, cls = 'btn-ghost') => {
      const b = document.createElement('button');
      b.className = cls;
      b.type = 'button';
      b.innerText = text;
      b.style.cursor = 'pointer';
      b.addEventListener('click', onclick);
      return b;
    };


    // spacer
    const spacer = document.createElement('div'); spacer.style.flex = '1';
    container.appendChild(spacer);
    container.appendChild(addBtn('Ocultar Aba Dashboard', () => toggleTabHide('dashboard')));
    // insert after the H2's parent card header
    dashboardH2.parentNode.insertBefore(container, dashboardH2.nextSibling);
  }

  // ---------- ASSETS & LIABILITIES (Ativos & Passivos) COMPONENT ----------
  function createAssetsTab() {
    const page = document.getElementById('ativos-passivos');
    if (!page) return;

    page.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2>Ativos & Passivos</h2>
          <button id="btn_clear_assets" class="btn-ghost" style="color:var(--danger)">Limpar Dados dessa Área</button>
        </div>
        <div class="small">Gerencie bens (imóveis, veículos) e dívidas de longo prazo.</div>
        
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;align-items:flex-end">
          <div style="flex:1;min-width:200px">
            <label>Nome do Ativo/Passivo</label>
            <input id="new_asset_name" class="input" placeholder="Ex: Apartamento Centro" />
          </div>
          <div style="width:140px">
             <label>Tipo</label>
             <select id="new_asset_type" class="input">
               <option value="ativo">Ativo</option>
               <option value="passivo">Passivo</option>
             </select>
          </div>
          <div style="width:140px">
            <label>Custo Inicial (R$)</label>
            <input id="new_asset_cost" type="number" class="input" placeholder="0.00" />
          </div>
          <button id="btn_add_asset" class="btn">Adicionar</button>
        </div>

        <div id="assetsList" style="margin-top:24px;display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:16px"></div>
        
        <div id="assetTxPanel" style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1)"></div>
      </div>
    `;

    // Bind events
    const btnAdd = page.querySelector('#btn_add_asset');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        const name = page.querySelector('#new_asset_name').value.trim();
        const type = page.querySelector('#new_asset_type').value;
        const cost = Number(page.querySelector('#new_asset_cost').value) || 0;
        if (!name) return alert('Nome é obrigatório');

        const asset = { id: uid('as'), name, type, cost, saldo: cost, transactions: [], updated: nowISO() };
        state.assets.push(asset);
        saveLocal();
        renderAssets();

        page.querySelector('#new_asset_name').value = '';
        page.querySelector('#new_asset_cost').value = '';
      });
    }

    const btnClear = page.querySelector('#btn_clear_assets');
    if (btnClear) {
      btnClear.addEventListener('click', clearAtivosPassivos);
    }

    renderAssets();
  }

  // ---------- ALERTS & REMINDERS (Lembretes) COMPONENT ----------
  function createRemindersTab() {
    const page = document.getElementById('lembretes');
    if (!page) return;

    page.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2>Lembretes & Alertas</h2>
          <button class="btn-ghost" onclick="clearAlertas()" style="color:var(--danger)">Limpar Tudo</button>
        </div>
        <div class="small">Defina lembretes, tarefas ou alertas de vencimento.</div>

        <div style="margin-top:16px;display:flex;gap:8px">
          <input id="alert_text" class="input" placeholder="Novo lembrete..." />
          <button id="alert_create_btn" class="btn">Adicionar</button>
        </div>

        <div style="margin-top:24px">
          <h3>Lembretes Ativos</h3>
          <div id="alertsListActive" style="margin-top:8px"></div>
        </div>

        <div style="margin-top:16px">
          <h3>Concluídos</h3>
          <div id="alertsListDone" style="margin-top:8px;opacity:0.7"></div>
        </div>
      </div>
    `;

    const createBtn = page.querySelector('#alert_create_btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const text = (page.querySelector('#alert_text').value || '').trim();
        if (!text) return;
        addAlerta(text);
        page.querySelector('#alert_text').value = '';
      });
    }

    // Ensure tab button exists
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.date}</td><td>${t.type}</td><td>${t.note || '(sem)'}</td><td>${safeFormatMoney(t.value)}</td>
        <td><button class="btn-ghost" data-deltx="${t.id}" data-asset="${a.id}">Excluir</button></td>`;
    table.querySelector('tbody').appendChild(tr);
  });
  panel.appendChild(table);
  // attach delete handlers
  table.querySelectorAll('button[data-deltx]').forEach(b => {
    b.addEventListener('click', (e) => {
      const txId = b.getAttribute('data-deltx');
      const assetId = b.getAttribute('data-asset');
      removeAssetTx(assetId, txId);
    });
  });
}

      function removeAssetTx(assetId, txId) {
  const a = state.assets.find(x => x.id === assetId);
  if (!a) return;
  if (!confirm('Excluir transação?')) return;
  a.transactions = a.transactions.filter(t => t.id !== txId);
  // recalc saldo from cost and transactions
  a.saldo = a.transactions.reduce((s, t) => s + (t.type === 'entrada' ? Number(t.value) : -Number(t.value)), Number(a.cost || 0));
  saveLocal();
  renderAssets();
  showAssetTransactions(assetId);
}

function openAssetEditor(id) {
  const a = state.assets.find(x => x.id === id);
  if (!a) return;
  const html = `
      <label>Nome</label><input id="modal_ap_name" class="input" value="${a.name}"/>
      <label>Tipo</label><select id="modal_ap_type" class="input"><option value="ativo">Ativo</option><option value="passivo">Passivo</option></select>
      <label>Custo inicial</label><input id="modal_ap_cost" class="input" type="number" value="${a.cost}"/>
    `;
  safeShowModal('Editar Ativo/Passivo', html, function () {
    a.name = document.getElementById('modal_ap_name').value.trim();
    a.type = document.getElementById('modal_ap_type').value;
    a.cost = Number(document.getElementById('modal_ap_cost').value) || 0;
    saveLocal(); renderAssets();
  });
}

function removeAsset(id) {
  if (!confirm('Excluir ativo/passivo e transações?')) return;
  state.assets = state.assets.filter(x => x.id !== id);
  saveLocal();
  renderAssets();
}

function clearAtivosPassivos() {
  if (!confirm('Tem certeza que deseja apagar TODOS os dados de Ativos e Passivos?')) return;
  state.assets = [];
  saveLocal();
  renderAssets();
  const panel = document.getElementById('assetTxPanel');
  if (panel) panel.innerHTML = '';
}

function renderAssetChartSmall(a) {
  const container = document.getElementById('chart_' + a.id);
  if (!container) return;
  container.innerHTML = '';
  if (typeof Chart === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.height = 80;
  container.appendChild(canvas);
  const labels = (a.transactions || []).slice(0, 10).map(t => t.date).reverse();
  const entradas = (a.transactions || []).slice(0, 10).map(t => t.type === 'entrada' ? Number(t.value) : 0).reverse();
  const saidas = (a.transactions || []).slice(0, 10).map(t => t.type === 'saida' ? Number(t.value) : 0).reverse();
  try {
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels, datasets: [
          { label: 'Entradas', data: entradas, backgroundColor: 'rgba(16,185,129,0.9)' },
          { label: 'Saídas', data: saidas, backgroundColor: 'rgba(239,68,68,0.9)' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
  } catch (e) { console.warn('chart draw fail', e); }
}

// ---------- INIT: insert UI and bind ----------
function initEnhancements() {
  createRemindersTab(); // NEW - Moved to top
  insertPrivacyControls();
  createAssetsTab();
  applyAreaHides();
  applyTabHides();
  renderAlertsDashboard(); // NEW

  // expose small API for manual triggers
  window.enhancements = {
    renderAssets,
    renderAlertsDashboard,
    createRemindersTab,
    toggleAreaHide,
    toggleTabHide,
    createAssetsTab
  };

  // Auto render assets if the tab visible
  if (location.hash && location.hash.includes('ativos-passivos')) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const p = document.getElementById('ativos-passivos');
    if (p) p.style.display = 'block';
    renderAssets();
  }
  // Auto render reminders if tab visible
  if (location.hash && location.hash.includes('lembretes')) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const p = document.getElementById('lembretes');
    if (p) p.style.display = 'block';
    renderRemindersTab();
  }
}

// run after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancements);
} else {
  setTimeout(initEnhancements, 50);
}

}) ();
