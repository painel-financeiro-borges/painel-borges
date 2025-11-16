/* ==========================================================
   enhancements.js — COMPLETO, REORGANIZADO E ESTRUTURADO
   Blocos numerados iguais ao HTML para manutenção futura
   ========================================================== */

/* ==========================================================
   #ENH-BLOCO-01 — UTILITÁRIOS / FALLBACKS
   ========================================================== */
(function(){
  const has = (name) => typeof window[name] === 'function';
  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));
  const nowISO = ()=> (new Date()).toISOString();
  const uid = (prefix='id') => (prefix + '_' + Math.random().toString(36).slice(2,10));
  const safeFormatMoney = (v) => (typeof formatMoney === 'function' ? formatMoney(v) : (typeof v === 'number' ? v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : v));
  const safeShowModal = (title, html, cb) => {
    if (typeof showModal === 'function') return showModal(title, html, cb);
    const ok = confirm(title + '

' + (html||''));
    if (ok && typeof cb === 'function') cb();
  };

  if (!window.state) window.state = { reservas:[], transacoes:[], investimentos:[], fluxo:[], custo:[], planejamento:{}, caderno:[], settings:{hideValues:false} };
  if (!state.assets) state.assets = [];

  if (typeof saveLocal !== 'function') {
    window.saveLocal = function(){
      try { localStorage.setItem('borges_panel_3_v1', JSON.stringify(state)); } catch(e){ }
      if (typeof renderAll === 'function') renderAll();
    };
  }

/* ==========================================================
   #ENH-BLOCO-02 — SETTINGS / ESTRUTURA DE ESTADO
   ========================================================== */
  if(!state.settings) state.settings = { hideValues:false };
  if(!state.settings.hiddenAreas) state.settings.hiddenAreas = {};
  if(!state.settings.hiddenTabs) state.settings.hiddenTabs = {};

/* ==========================================================
   #ENH-BLOCO-03 — HELPERS DE OCULTAÇÃO
   ========================================================== */
  function toggleAreaHide(areaId){
    state.settings.hiddenAreas[areaId] = !state.settings.hiddenAreas[areaId];
    saveLocal(); applyAreaHides();
  }
  function toggleTabHide(tabId){
    state.settings.hiddenTabs[tabId] = !state.settings.hiddenTabs[tabId];
    saveLocal(); applyTabHides();
  }

/* ==========================================================
   #ENH-BLOCO-04 — APLICADORES DE OCULTAÇÃO (DASHBOARD / ABAS)
   ========================================================== */
  function applyAreaHides(){
    const map = {
      'dash_top_stats': '#dash_top_stats',
      'dash_result': '#dash_result',
      'dash_summary': '#dash_summary',
      'dash_reservas': '#dash_reservas_total',
      'dash_invest': '#dash_invest_total'
    };
    Object.keys(map).forEach(k=>{
      const node = document.querySelector(map[k]);
      if(node) node.style.display = state.settings.hiddenAreas[k] ? 'none' : '';
    });
  }
  function applyTabHides(){
    Object.keys(state.settings.hiddenTabs).forEach(tabId=>{
      const page = document.getElementById(tabId);
      if(page) page.style.display = state.settings.hiddenTabs[tabId] ? 'none' : '';
    });
  }

/* ==========================================================
   #ENH-BLOCO-05 — CONTROLES DE PRIVACIDADE (UI)
   ========================================================== */
  function insertPrivacyControls(){
    const dashboardH2 = Array.from(document.querySelectorAll('h2')).find(h=>/Dashboard/i.test(h.innerText));
    if(!dashboardH2) return;
    if(document.getElementById('enh_privacy_controls')) return;

    const container = document.createElement('div');
    container.id = 'enh_privacy_controls';
    container.style.display='flex'; container.style.gap='8px'; container.style.alignItems='center'; container.style.marginTop='8px';

    const addBtn = (text, onclick) => {
      const b = document.createElement('button'); b.className='btn-ghost'; b.innerText=text; b.addEventListener('click', onclick); return b;
    };

    container.appendChild(addBtn('Ocultar Entradas', ()=>toggleAreaHide('dash_top_stats')));
    container.appendChild(addBtn('Ocultar Resultado', ()=>toggleAreaHide('dash_result')));
    container.appendChild(addBtn('Ocultar Resumos', ()=>toggleAreaHide('dash_summary')));
    const spacer = document.createElement('div'); spacer.style.flex='1'; container.appendChild(spacer);
    container.appendChild(addBtn('Ocultar Aba Dashboard', ()=>toggleTabHide('dashboard')));

    dashboardH2.parentNode.insertBefore(container, dashboardH2.nextSibling);
  }

/* ==========================================================
   #ENH-BLOCO-06 — CRIAÇÃO DA ABA "ATIVOS & PASSIVOS"
   ========================================================== */
  function createAssetsTab(){
    if(document.getElementById('ativos-passivos')) return;
    const anyPage = document.querySelector('.page'); if(!anyPage) return;
    const pagesParent = anyPage.parentNode;

    const page = document.createElement('div');
    page.id='ativos-passivos'; page.className='page'; page.style.display='none';
    page.innerHTML = `
      <div class="card">
        <h2>Ativos & Passivos</h2>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
          <input id="ap_name" class="input" placeholder="Nome"/>
          <select id="ap_type" class="input"><option value="ativo">Ativo</option><option value="passivo">Passivo</option></select>
          <input id="ap_cost" class="input" type="number" placeholder="Custo inicial (R$)"/>
          <button id="ap_create_btn" class="btn">Criar</button>
        </div>
        <div id="assetsList" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px"></div>
        <div style="margin-top:18px"><h3>Transações por Ativo</h3><div id="assetTxPanel" style="margin-top:8px"></div></div>
      </div>`;
    pagesParent.appendChild(page);

    const tabControl = document.querySelectorAll('.tab');
    if(tabControl.length){
      const lastTab = tabControl[tabControl.length-1]; const parent = lastTab.parentNode;
      const btn = document.createElement('button'); btn.className='tab'; btn.dataset.tab='ativos-passivos'; btn.innerText='Ativos & Passivos';
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.page').forEach(p=>p.style.display='none');
        document.getElementById('ativos-passivos').style.display='block';
        renderAssets();
      });
      parent.appendChild(btn);
    }

    page.querySelector('#ap_create_btn').addEventListener('click', ()=>{
      const name = page.querySelector('#ap_name').value.trim();
      const type = page.querySelector('#ap_type').value;
      const cost = Number(page.querySelector('#ap_cost').value)||0;
      if(!name){ alert('Nome obrigatório'); return; }
      const asset = { id:uid('a'), name, type, cost, saldo:cost, transactions:[], created:nowISO() };
      state.assets.push(asset);
      page.querySelector('#ap_name').value=''; page.querySelector('#ap_cost').value='';
      saveLocal(); renderAssets();
    });
  }

/* ==========================================================
   #ENH-BLOCO-07 — RENDERIZAÇÃO DOS ATIVOS & PASSIVOS
   ========================================================== */
  function renderAssets(){
    const container = document.getElementById('assetsList'); if(!container) return;
    container.innerHTML='';
    if(!state.assets.length){ container.innerHTML='<div class="small">Nenhum ativo / passivo</div>'; return; }

    state.assets.forEach(a=>{
      const net = computeAssetNet(a);
      const netColor = net>=0 ? 'color:var(--success)' : '
