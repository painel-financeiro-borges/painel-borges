/* enhancements.js
   Adiciona:
   - Aba "Ativos & Passivos" (criar/editar/transa��es/grafico pequeno)
   - Bot�es de ocultar por aba
   - Bot�es de ocultar �reas do Dashboard
   Design inalterado. N�o destrutivo.
*/

(function(){
  // ---------- UTILIT�RIOS / FALBACKS ----------
  const has = (name) => typeof window[name] === 'function';
  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));
  const nowISO = ()=> (new Date()).toISOString();
  const uid = (prefix='id') => (prefix + '_' + Math.random().toString(36).slice(2,10));
  const safeFormatMoney = (v) => (typeof formatMoney === 'function' ? formatMoney(v) : (typeof v === 'number' ? v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : v));
  const safeShowModal = (title, html, cb) => {
    if (typeof showModal === 'function') return showModal(title, html, cb);
    // fallback: simple prompt-based edit (very small fallback)
    const ok = confirm(title + '\n\n' + (html||''));
    if (ok && typeof cb === 'function') cb();
  };

  // Ensure global state exists
  if (!window.state) window.state = { reservas:[], transacoes:[], investimentos:[], fluxo:[], custo:[], planejamento:{}, caderno:[], settings:{hideValues:false} };

  if (!state.assets) state.assets = []; // where assets will be stored

  // Ensure saveLocal exists; if not provide safe fallback that stores to localStorage
  if (typeof saveLocal !== 'function') {
    window.saveLocal = function(){
      try { localStorage.setItem('borges_panel_3_v1', JSON.stringify(state)); } catch(e){ console.warn('saveLocal fallback failed', e); }
      if (typeof renderAll === 'function') renderAll();
    };
  }

  // ---------- HELPERS TO MANAGE HIDE STATE ----------
  if(!state.settings) state.settings = { hideValues:false };
  if(!state.settings.hiddenAreas) state.settings.hiddenAreas = {}; // { areaId: true }
  if(!state.settings.hiddenTabs) state.settings.hiddenTabs = {}; // { tabId: true }

  function toggleAreaHide(areaId){
    state.settings.hiddenAreas[areaId] = !state.settings.hiddenAreas[areaId];
    saveLocal();
    applyAreaHides();
  }
  function toggleTabHide(tabId){
    state.settings.hiddenTabs[tabId] = !state.settings.hiddenTabs[tabId];
    saveLocal();
    applyTabHides();
  }

  function applyAreaHides(){
    // mapping of known area ids to selectors � if the selectors exist, hide them
    const map = {
      'dash_top_stats': '#dash_top_stats',
      'dash_result': '#dash_result',
      'dash_summary': '#dash_summary',
      'dash_reservas': '#dash_reservas_total',
      'dash_invest': '#dash_invest_total'
    };
    Object.keys(map).forEach(k=>{
      const sel = map[k];
      const node = document.querySelector(sel);
      if(!node) return;
      node.style.display = state.settings.hiddenAreas[k] ? 'none' : '';
    });
  }

  function applyTabHides(){
    // hide pages by id if requested
    Object.keys(state.settings.hiddenTabs).forEach(tabId=>{
      const page = document.getElementById(tabId);
      if(page) page.style.display = state.settings.hiddenTabs[tabId] ? 'none' : '';
    });
  }

  // ---------- UI INSERTION ----------
  function insertPrivacyControls(){
    // locate dashboard header area � safe fallback: insert near h2 with text "Dashboard"
    const dashboardH2 = Array.from(document.querySelectorAll('h2')).find(h=>/Dashboard/i.test(h.innerText));
    if(!dashboardH2) return;
    // don't insert twice
    if (document.getElementById('enh_privacy_controls')) return;

    const container = document.createElement('div');
    container.id = 'enh_privacy_controls';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';
    container.style.marginTop = '8px';

    const addBtn = (text, onclick, cls='btn-ghost') => {
      const b = document.createElement('button');
      b.className = cls;
      b.type = 'button';
      b.innerText = text;
      b.style.cursor = 'pointer';
      b.addEventListener('click', onclick);
      return b;
    };

    // area-specific hide buttons
    container.appendChild(addBtn('Ocultar Entradas', ()=>toggleAreaHide('dash_top_stats')));
    container.appendChild(addBtn('Ocultar Resultado', ()=>toggleAreaHide('dash_result')));
    container.appendChild(addBtn('Ocultar Resumos', ()=>toggleAreaHide('dash_summary')));
    // spacer
    const spacer = document.createElement('div'); spacer.style.flex = '1';
    container.appendChild(spacer);
    container.appendChild(addBtn('Ocultar Aba Dashboard', ()=>toggleTabHide('dashboard')));
    // insert after the H2's parent card header
    dashboardH2.parentNode.insertBefore(container, dashboardH2.nextSibling);
  }

  // ---------- ASSETS & LIABILITIES (Ativos & Passivos) COMPONENT ----------
  function createAssetsTab(){
    // do not create twice
    if(document.getElementById('ativos-passivos')) return;

    // find pages container: a safe container that holds pages; try to insert at end of pages area
    // we search for an element with class 'page' to find parent
    const anyPage = document.querySelector('.page');
    if(!anyPage) return;
    const pagesParent = anyPage.parentNode;

    // create page
    const page = document.createElement('div');
    page.id = 'ativos-passivos';
    page.className = 'page';
    page.style.display = 'none';

    page.innerHTML = `
      <div class="card">
        <h2>Ativos & Passivos</h2>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
          <input id="ap_name" class="input" placeholder="Nome do ativo / passivo (ex: Moto aluguel)"/>
          <select id="ap_type" class="input"><option value="ativo">Ativo</option><option value="passivo">Passivo</option></select>
          <input id="ap_cost" class="input" type="number" placeholder="Custo inicial (R$)"/>
          <button id="ap_create_btn" class="btn">Criar</button>
        </div>

        <div id="assetsList" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px"></div>

        <div style="margin-top:18px">
          <h3>Transa��es por Ativo</h3>
          <div id="assetTxPanel" style="margin-top:8px"></div>
        </div>
      </div>
    `;
    pagesParent.appendChild(page);

    // add tab control: try to find nav tabs; else add a small link
    const tabControl = document.querySelectorAll('.tab');
    if(tabControl && tabControl.length){
      // create a tab button consistent with others
      const lastTab = tabControl[tabControl.length-1];
      const tabListParent = lastTab.parentNode;
      const btn = document.createElement('button');
      btn.className = 'tab';
      btn.dataset.tab = 'ativos-passivos';
      btn.innerText = 'Ativos & Passivos';
      btn.addEventListener('click', function(){
        // activate tab (mimic existing behavior)
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.page').forEach(p=>p.style.display='none');
        const pageEl = document.getElementById('ativos-passivos');
        if(pageEl) pageEl.style.display = 'block';
        // call custom render
        renderAssets();
      });
      tabListParent.appendChild(btn);
    } else {
      // fallback: add link at top of pages
      const link = document.createElement('div');
      link.style.marginTop = '8px';
      link.innerHTML = `<a href="#" id="link_ativos_passivos">Ativos & Passivos</a>`;
      anyPage.parentNode.insertBefore(link, anyPage);
      document.getElementById('link_ativos_passivos').addEventListener('click', (e)=>{
        e.preventDefault();
        document.querySelectorAll('.page').forEach(p=>p.style.display='none');
        document.getElementById('ativos-passivos').style.display='block';
        renderAssets();
      });
    }

    // attach create button
    page.querySelector('#ap_create_btn').addEventListener('click', ()=> {
      const name = (page.querySelector('#ap_name').value || '').trim();
      const type = page.querySelector('#ap_type').value;
      const cost = Number(page.querySelector('#ap_cost').value) || 0;
      if(!name) { alert('Nome obrigat�rio'); return; }
      const asset = { id: uid('a'), name, type, cost, saldo: cost, transactions: [], created: nowISO() };
      state.assets.push(asset);
      page.querySelector('#ap_name').value=''; page.querySelector('#ap_cost').value='';
      saveLocal();
      renderAssets();
    });
  }

  // ---------- RENDER / ACTIONS FOR ASSETS ----------
  function renderAssets(){
    const container = document.getElementById('assetsList');
    if(!container) return;
    container.innerHTML = '';
    if(!state.assets.length){
      container.innerHTML = '<div class="small">Nenhum ativo / passivo</div>';
      return;
    }
    state.assets.forEach(a=>{
      const net = computeAssetNet(a);
      const netColor = net >= 0 ? 'color:var(--success)' : 'color:var(--danger)';
      const card = document.createElement('div');
      card.className = 'res-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700">${a.name} <span class="small">(${a.type})</span></div>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost" data-act="edit" data-id="${a.id}">?</button>
            <button class="btn-ghost" data-act="del" data-id="${a.id}">?</button>
          </div>
        </div>
        <div style="margin-top:8px" class="small">Custo inicial: ${safeFormatMoney(a.cost)}</div>
        <div style="margin-top:6px;font-weight:800">${safeFormatMoney(a.saldo||0)}</div>
        <div style="margin-top:8px"><div class="small">Resultado: <span style="${netColor}">${safeFormatMoney(net)}</span></div></div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-ghost" data-act="addE" data-id="${a.id}">+ Entrada</button>
          <button class="btn-ghost" data-act="addS" data-id="${a.id}">- Sa�da</button>
          <button class="btn-ghost" data-act="view" data-id="${a.id}">Ver transa��es</button>
        </div>
        <div style="margin-top:8px" id="chart_${a.id}"></div>
      `;
      container.appendChild(card);
      // attach events
      card.querySelectorAll('button').forEach(b=>{
        const act = b.getAttribute('data-act');
        const id = b.getAttribute('data-id');
        if(act === 'edit') b.addEventListener('click', ()=>{ openAssetEditor(id); });
        if(act === 'del') b.addEventListener('click', ()=>{ removeAsset(id); });
        if(act === 'addE') b.addEventListener('click', ()=>{ promptAssetTx(id,'entrada'); });
        if(act === 'addS') b.addEventListener('click', ()=>{ promptAssetTx(id,'saida'); });
        if(act === 'view') b.addEventListener('click', ()=>{ showAssetTransactions(id); });
      });
      // render tiny chart (if Chart.js present)
      renderAssetChartSmall(a);
    });
  }

  function computeAssetNet(a){
    const tx = a.transactions || [];
    const entradas = tx.filter(t=>t.type==='entrada').reduce((s,t)=>s+Number(t.value||0),0);
    const saidas = tx.filter(t=>t.type==='saida').reduce((s,t)=>s+Number(t.value||0),0);
    return entradas - saidas;
  }

  function promptAssetTx(id, tipo){
    let input = prompt('Valor (R$)', '0');
    if (!input) return;

    input = input.replace(/\./g, '').replace(',', '.'); 
    const val = parseFloat(input) || 0;

    if (val <= 0) return;

    const desc = prompt('Descrição','') || '';
    addAssetTransaction(id, tipo, val, desc);
}

    if(val <= 0) return;
    const desc = prompt('Descri��o','') || '';
    addAssetTransaction(id, tipo, val, desc);
  }

  function addAssetTransaction(id, tipo, valor, nota){
    const a = state.assets.find(x=>x.id===id);
    if(!a) return;
    const tx = { id: uid('tx'), date: (new Date()).toLocaleDateString(), type: tipo, value: Number(valor), note: nota||'' };
    a.transactions.unshift(tx);
    a.saldo = (Number(a.saldo||0) + (tipo === 'entrada' ? Number(valor) : -Number(valor)));
    a.updated = nowISO();
    saveLocal();
    renderAssets();
    showAssetTransactions(id);
  }

  function showAssetTransactions(id){
    const a = state.assets.find(x=>x.id===id);
    const panel = document.getElementById('assetTxPanel');
    if(!panel) return;
    panel.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${a.name} � Transa��es</div>`;
    if(!a.transactions || !a.transactions.length){ panel.innerHTML += '<div class="small">Sem transa��es</div>'; return; }
    const table = document.createElement('table');
    table.className = 'table';
    table.style.width = '100%';
    table.innerHTML = `<thead><tr><th>Data</th><th>Tipo</th><th>Desc</th><th>Valor</th><th></th></tr></thead><tbody></tbody>`;
    a.transactions.forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.date}</td><td>${t.type}</td><td>${t.note||'(sem)'}</td><td>${safeFormatMoney(t.value)}</td>
        <td><button class="btn-ghost" data-deltx="${t.id}" data-asset="${a.id}">Excluir</button></td>`;
      table.querySelector('tbody').appendChild(tr);
    });
    panel.appendChild(table);
    // attach delete handlers
    table.querySelectorAll('button[data-deltx]').forEach(b=>{
      b.addEventListener('click', (e)=>{
        const txId = b.getAttribute('data-deltx');
        const assetId = b.getAttribute('data-asset');
        removeAssetTx(assetId, txId);
      });
    });
  }

  function removeAssetTx(assetId, txId){
    const a = state.assets.find(x=>x.id===assetId);
    if(!a) return;
    if(!confirm('Excluir transa��o?')) return;
    a.transactions = a.transactions.filter(t=>t.id !== txId);
    // recalc saldo from cost and transactions
    a.saldo = a.transactions.reduce((s,t)=> s + (t.type==='entrada' ? Number(t.value) : -Number(t.value)), Number(a.cost || 0));
    saveLocal();
    renderAssets();
    showAssetTransactions(assetId);
  }

  function openAssetEditor(id){
    const a = state.assets.find(x=>x.id===id);
    if(!a) return;
    const html = `
      <label>Nome</label><input id="modal_ap_name" class="input" value="${a.name}"/>
      <label>Tipo</label><select id="modal_ap_type" class="input"><option value="ativo">Ativo</option><option value="passivo">Passivo</option></select>
      <label>Custo inicial</label><input id="modal_ap_cost" class="input" type="number" value="${a.cost}"/>
    `;
    safeShowModal('Editar Ativo/Passivo', html, function(){
      a.name = document.getElementById('modal_ap_name').value.trim();
      a.type = document.getElementById('modal_ap_type').value;
      a.cost = Number(document.getElementById('modal_ap_cost').value) || 0;
      saveLocal(); renderAssets();
    });
  }

  function removeAsset(id){
    if(!confirm('Excluir ativo/passivo e transa��es?')) return;
    state.assets = state.assets.filter(x=>x.id !== id);
    saveLocal();
    renderAssets();
  }

  function renderAssetChartSmall(a){
    const container = document.getElementById('chart_'+a.id);
    if(!container) return;
    container.innerHTML = '';
    if(typeof Chart === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.height = 80;
    container.appendChild(canvas);
    const labels = (a.transactions||[]).slice(0,10).map(t=>t.date).reverse();
    const entradas = (a.transactions||[]).slice(0,10).map(t=> t.type==='entrada' ? Number(t.value) : 0).reverse();
    const saidas = (a.transactions||[]).slice(0,10).map(t=> t.type==='saida' ? Number(t.value) : 0).reverse();
    try {
      new Chart(canvas.getContext('2d'), {
        type:'bar',
        data:{ labels, datasets:[
          { label:'Entradas', data:entradas, backgroundColor:'rgba(16,185,129,0.9)' },
          { label:'Sa�das', data:saidas, backgroundColor:'rgba(239,68,68,0.9)' }
        ]},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{display:false}, y:{display:false}} }
      });
    } catch(e){ console.warn('chart draw fail', e); }
  }

  // ---------- INIT: insert UI and bind ----------
  function initEnhancements(){
    insertPrivacyControls();
    createAssetsTab();
    applyAreaHides();
    applyTabHides();

    // expose small API for manual triggers
    window.enhancements = {
      renderAssets,
      toggleAreaHide,
      toggleTabHide
    };

    // Auto render assets if the tab visible
    if(location.hash && location.hash.includes('ativos-passivos')) {
      document.querySelectorAll('.page').forEach(p=>p.style.display='none');
      const p = document.getElementById('ativos-passivos');
      if(p) p.style.display = 'block';
      renderAssets();
    }
  }

  // run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements);
  } else {
    setTimeout(initEnhancements, 50);
  }

})();

