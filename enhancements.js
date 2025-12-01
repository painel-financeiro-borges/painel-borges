/* enhancements.js
   Adiciona:
   - Aba "Ativos & Passivos" (criar/editar/transações/grafico pequeno)
   - Aba "Lembretes" (alertas e lembretes)
   - Lógica: Classificação de Ativo/Passivo baseada no Fluxo Líquido (Entradas vs Saídas).
   Design inalterado. Não destrutivo.
*/

(function () {
  // ---------- UTILITÁRIOS / FALBACKS ----------
  const has = (name) => typeof window[name] === 'function';
  const el = (s) => document.querySelector(s);
  const els = (s) => Array.from(document.querySelectorAll(s));
  const nowISO = () => (new Date()).toISOString();
  const uid = (prefix = 'id') => (prefix + '_' + Math.random().toString(36).slice(2, 10));
  
  // Garante que o formatMoney global (com hideValues) seja usado
  const safeFormatMoney = (v) => (typeof formatMoney === 'function' ? formatMoney(v) : (typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : v));
  const safeShowModal = (title, html, cb) => {
    if (typeof showModal === 'function') return showModal(title, html, cb);
    // fallback: simple prompt-based edit (very small fallback)
    const ok = confirm(title + '\n\n' + (html || ''));
    if (ok && typeof cb === 'function') cb();
  };

  // Ensure global state exists and new keys are present
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
  
  // ========== FUNÇÃO CENTRAL: CLASSIFICAÇÃO AUTOMÁTICA ==========
  /**
   * Calcula o Fluxo Líquido (Entradas - Saídas) de um ativo.
   * Usado para classificar automaticamente como Ativo/Passivo.
   * @param {Object} a - O objeto asset.
   * @returns {number} Fluxo líquido.
   */
  function computeAssetNet(a) {
    const tx = a.transactions || [];
    const entradas = tx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.value || 0), 0);
    const saidas = tx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.value || 0), 0);
    // Fluxo Líquido = Receitas - Despesas
    return entradas - saidas;
  }
  
  /**
   * Recalcula o saldo total (Custo Inicial + Fluxo Líquido).
   * @param {Object} a - O objeto asset.
   * @returns {number} Saldo atualizado.
   */
  function computeAssetBalance(a) {
    return Number(a.cost || 0) + computeAssetNet(a);
  }

  // ---------- ASSETS & LIABILITIES (Ativos & Passivos) COMPONENT ----------
  function createAssetsTab() {
    const page = document.getElementById('ativos-passivos');
    if (!page) return;

    // Removida a label para escolher Ativo/Passivo, pois é automático agora
    page.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2>Ativos & Passivos</h2>
          <button id="btn_clear_assets" class="btn-ghost" style="color:var(--danger)">Limpar Dados dessa Área</button>
        </div>
        <div class="small">Gerencie bens e dívidas de longo prazo. A classificação (Ativo/Passivo) é automática, baseada no Fluxo Líquido (Entradas - Saídas).</div>
        
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;align-items:flex-end">
          <div style="flex:1;min-width:200px">
            <label>Nome do Patrimônio</label>
            <input id="new_asset_name" class="input" placeholder="Ex: Apartamento Centro (Ativo) ou Financiamento (Passivo)" />
          </div>
          <div style="width:140px">
            <label>Custo/Dívida Inicial (R$)</label>
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
        const cost = Number(page.querySelector('#new_asset_cost').value) || 0;
        if (!name) return alert('Nome é obrigatório');

        // Cria o item, o saldo inicial será o custo inicial
        const asset = { id: uid('as'), name, cost, saldo: cost, transactions: [], updated: nowISO() };
        state.assets.push(asset);
        saveLocal();
        renderAssets();
        renderAlertsDashboard(); // Update summary

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
  
  // ---------- RENDER / ACTIONS FOR ASSETS ----------
  function renderAssets() {
    const container = document.getElementById('assetsList');
    if (!container) return;
    container.innerHTML = '';
    if (!state.assets.length) {
      container.innerHTML = '<div class="small">Nenhum ativo / passivo</div>';
      return;
    }
    state.assets.forEach(a => {
      // Cálculo: Ativo se Fluxo Líquido > 0 (traz dinheiro)
      const net = computeAssetNet(a);
      // Saldo é o Custo Inicial + Fluxo Líquido
      const currentBalance = computeAssetBalance(a); 
      
      let statusLabel = 'NEUTRO (Fluxo: 0)';
      let statusColor = 'var(--muted)';
      
      // Lógica de Classificação Automática
      if (net > 0) { 
          statusLabel = 'ATIVO (Gera Renda)'; 
          statusColor = 'var(--success)'; 
      }
      else if (net < 0) { 
          statusLabel = 'PASSIVO (Gera Despesa)'; 
          statusColor = 'var(--danger)'; 
      }

      const card = document.createElement('div');
      card.className = 'res-card';
      card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700">${a.name}</div>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost" data-act="edit" data-id="${a.id}">✎</button>
            <button class="btn-ghost" data-act="del" data-id="${a.id}">✖</button>
          </div>
        </div>
        <div style="margin-top:8px" class="small">Custo/Dívida Inicial: ${safeFormatMoney(a.cost)}</div>
        <div style="margin-top:6px;font-weight:800;font-size:18px">${safeFormatMoney(currentBalance)}</div>
        <div style="margin-top:8px;font-weight:bold;color:${statusColor};border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">${statusLabel}</div>
        <div style="margin-top:4px"><div class="small">Fluxo Líquido (Receitas - Despesas): <span style="${net > 0 ? 'color:var(--success)' : (net < 0 ? 'color:var(--danger)' : '')}">${safeFormatMoney(net)}</span></div></div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">
          <button class="btn-ghost" data-act="addE" data-id="${a.id}">+ Receita/Entrada</button>
          <button class="btn-ghost" data-act="addS" data-id="${a.id}">- Despesa/Saída</button>
          <button class="btn-ghost" data-act="view" data-id="${a.id}">Ver transações</button>
        </div>
        <div style="margin-top:8px" id="chart_${a.id}"></div>
    `;
      container.appendChild(card);
      // attach events
      card.querySelectorAll('button').forEach(b => {
        const act = b.getAttribute('data-act');
        const id = b.getAttribute('data-id');
        if (act === 'edit') b.addEventListener('click', () => { openAssetEditor(id); });
        if (act === 'del') b.addEventListener('click', () => { removeAsset(id); });
        if (act === 'addE') b.addEventListener('click', () => { promptAssetTx(id, 'entrada'); });
        if (act === 'addS') b.addEventListener('click', () => { promptAssetTx(id, 'saida'); });
        if (act === 'view') b.addEventListener('click', () => { showAssetTransactions(id); });
      });
      // render tiny chart (if Chart.js present)
      renderAssetChartSmall(a);
    });
  }

  function promptAssetTx(id, tipo) {
    const val = Number(prompt(`Valor R$ da ${tipo === 'entrada' ? 'Receita' : 'Despesa'}`, '0')) || 0;
    if (val <= 0) return;
    const desc = prompt('Descrição', '') || '';
    addAssetTransaction(id, tipo, val, desc);
  }

  function addAssetTransaction(id, tipo, valor, nota) {
    const a = state.assets.find(x => x.id === id);
    if (!a) return;
    const tx = { id: uid('tx'), date: (new Date()).toLocaleDateString(), type: tipo, value: Number(valor), note: nota || '' };
    a.transactions.unshift(tx);
    
    // O Saldo é atualizado automaticamente pelo novo cálculo
    a.saldo = computeAssetBalance(a); 
    a.updated = nowISO();
    saveLocal();
    renderAssets();
    renderAlertsDashboard(); // Update summary
    // showAssetTransactions(id); // Opcional: manter o painel de transações aberto
  }

  function showAssetTransactions(id) {
    const a = state.assets.find(x => x.id === id);
    const panel = document.getElementById('assetTxPanel');
    if (!panel) return;
    panel.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${a.name} — Transações</div>`;
    if (!a.transactions || !a.transactions.length) { panel.innerHTML += '<div class="small">Sem transações</div>'; return; }
    const table = document.createElement('table');
    table.className = 'table';
    table.style.width = '100%';
    table.innerHTML = `<thead><tr><th>Data</th><th>Tipo</th><th>Desc</th><th>Valor</th><th></th></tr></thead><tbody></tbody>`;
    a.transactions.forEach(t => {
      const tr = document.createElement('tr');
      const color = t.type === 'entrada' ? 'var(--success)' : 'var(--danger)';
      tr.innerHTML = `<td>${t.date}</td><td style="color:${color};font-weight:600">${t.type}</td><td>${t.note || '(sem)'}</td><td>${safeFormatMoney(t.value)}</td>
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
    
    // Recalcula o saldo após a remoção
    a.saldo = computeAssetBalance(a); 
    
    saveLocal();
    renderAssets();
    renderAlertsDashboard(); // Update summary
    showAssetTransactions(assetId);
  }

  function openAssetEditor(id) {
    const a = state.assets.find(x => x.id === id);
    if (!a) return;
    const html = `
      <label>Nome</label><input id="modal_ap_name" class="input" value="${a.name}"/>
      <label>Custo/Dívida Inicial</label><input id="modal_ap_cost" class="input" type="number" value="${a.cost}"/>
    `;
    safeShowModal('Editar Patrimônio', html, function () {
      a.name = document.getElementById('modal_ap_name').value.trim();
      a.cost = Number(document.getElementById('modal_ap_cost').value) || 0;
      
      // CORREÇÃO: Recalcula o saldo quando o custo inicial é alterado
      a.saldo = computeAssetBalance(a); 
      
      saveLocal(); 
      renderAssets(); 
      renderAlertsDashboard();
    });
  }

  function removeAsset(id) {
    if (!confirm('Excluir patrimônio e transações?')) return;
    state.assets = state.assets.filter(x => x.id !== id);
    saveLocal();
    renderAssets();
    renderAlertsDashboard(); // Update summary
  }

  function clearAtivosPassivos() {
    if (!confirm('Tem certeza que deseja apagar TODOS os dados de Ativos e Passivos?')) return;
    state.assets = [];
    saveLocal();
    renderAssets();
    renderAlertsDashboard(); // Update summary
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
    
    // Prepara dados - limitando a 10 transações para o gráfico pequeno
    const txData = (a.transactions || []).slice(0, 10).reverse();
    const labels = txData.map(t => t.date);
    const entradas = txData.map(t => t.type === 'entrada' ? Number(t.value) : 0);
    const saidas = txData.map(t => t.type === 'saida' ? Number(t.value) : 0);
    
    try {
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels, datasets: [
            { label: 'Receitas', data: entradas, backgroundColor: 'rgba(16,185,129,0.9)' },
            { label: 'Despesas', data: saidas, backgroundColor: 'rgba(239,68,68,0.9)' }
          ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { x: { display: false }, y: { display: false } } 
        }
      });
    } catch (e) { console.warn('chart draw fail', e); }
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

    // Garante que o botão da aba Lembretes seja criado/funcione se ainda não estiver lá
    let btn = document.querySelector('.tab[data-tab="lembretes"]');
    if (btn) {
        // Se a aba existe, apenas garante que o clique chama o render correto
        btn.onclick = function () {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
            const pageEl = document.getElementById('lembretes');
            if (pageEl) pageEl.style.display = 'block';
            renderRemindersTab();
        };
    }

    renderRemindersTab();
  }

  function addAlerta(texto) {
    const alerta = { id: uid('al'), text: texto, created: nowISO(), concluido: false };
    state.alertas.unshift(alerta);
    saveLocal();
    renderRemindersTab();
    renderAlertsDashboard();
  }

  function toggleAlerta(id) {
    const a = state.alertas.find(x => x.id === id);
    if (!a) return;
    a.concluido = !a.concluido;
    saveLocal();
    renderRemindersTab();
    renderAlertsDashboard();
  }

  function removeAlerta(id) {
    if (!confirm('Remover lembrete?')) return;
    state.alertas = state.alertas.filter(x => x.id !== id);
    saveLocal();
    renderRemindersTab();
    renderAlertsDashboard();
  }

  window.clearAlertas = function () {
    if (!confirm('Deseja realmente apagar TODOS os lembretes e alertas?')) return;
    state.alertas = [];
    saveLocal();
    renderRemindersTab();
    renderAlertsDashboard();
    alert('Lembretes limpos com sucesso!');
  };

  function renderRemindersTab() {
    const activeDiv = document.getElementById('alertsListActive');
    const doneDiv = document.getElementById('alertsListDone');
    if (!activeDiv || !doneDiv) return;

    activeDiv.innerHTML = '';
    doneDiv.innerHTML = '';

    const ativos = state.alertas.filter(a => !a.concluido);
    const concluidos = state.alertas.filter(a => a.concluido);

    if (!ativos.length) activeDiv.innerHTML = '<div class="small">Nenhum lembrete ativo</div>';
    ativos.forEach(a => {
      const row = document.createElement('div');
      row.className = 'res-card';
      row.style.marginBottom = '8px';
      row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600">${a.text}</div>
          <div style="display:flex;gap:8px">
            <button class="btn-ghost" data-act="done" data-id="${a.id}">✔ Concluir</button>
            <button class="btn-ghost" data-act="del" data-id="${a.id}">✖</button>
          </div>
        </div>
      <div class="small" style="margin-top:4px">${new Date(a.created).toLocaleDateString()}</div>
    `;
      activeDiv.appendChild(row);
      row.querySelector('[data-act="done"]').addEventListener('click', () => toggleAlerta(a.id));
      row.querySelector('[data-act="del"]').addEventListener('click', () => removeAlerta(a.id));
    });

    if (!concluidos.length) doneDiv.innerHTML = '<div class="small">Nenhum lembrete concluído</div>';
    concluidos.forEach(a => {
      const row = document.createElement('div');
      row.style.padding = '8px';
      row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="text-decoration:line-through;color:var(--muted)">${a.text}</div>
          <div style="display:flex;gap:8px">
            <button class="btn-ghost" data-act="undo" data-id="${a.id}">Desfazer</button>
            <button class="btn-ghost" data-act="del" data-id="${a.id}">✖</button>
          </div>
        </div>
      `;
      doneDiv.appendChild(row);
      row.querySelector('[data-act="undo"]').addEventListener('click', () => toggleAlerta(a.id));
      row.querySelector('[data-act="del"]').addEventListener('click', () => removeAlerta(a.id));
    });
  }

  function renderAlertsDashboard() {
    // Try to find wrapper no dashboard
    const wrapper = document.getElementById('dash_reminders_wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';

    // --- ASSET SUMMARY (ATUALIZADO) ---
    if (state.assets && state.assets.length > 0) {
      let countAtivos = 0;
      let countPassivos = 0;
      state.assets.forEach(a => {
        // Classifica com base no Fluxo Líquido (computeAssetNet)
        const net = computeAssetNet(a);
        if (net > 0) countAtivos++;
        if (net < 0) countPassivos++;
      });

      if (countAtivos > 0 || countPassivos > 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.style.marginBottom = '12px';
        summaryDiv.style.display = 'flex';
        summaryDiv.style.gap = '12px';

        if (countAtivos > 0) {
          const divA = document.createElement('div');
          divA.className = 'card';
          divA.style.flex = '1';
          divA.style.background = 'rgba(16,185,129,0.1)';
          divA.style.border = '1px solid var(--success)';
          divA.style.padding = '8px';
          divA.style.textAlign = 'center';
          // Renderiza a quantidade de ativos
          divA.innerHTML = `<div style="font-weight:bold;color:var(--success)">Você tem ${countAtivos} Ativos</div>`;
          summaryDiv.appendChild(divA);
        }

        if (countPassivos > 0) {
          const divP = document.createElement('div');
          divP.className = 'card';
          divP.style.flex = '1';
          divP.style.background = 'rgba(239,68,68,0.1)';
          divP.style.border = '1px solid var(--danger)';
          divP.style.padding = '8px';
          divP.style.textAlign = 'center';
          // Renderiza a quantidade de passivos
          divP.innerHTML = `<div style="font-weight:bold;color:var(--danger)">Você tem ${countPassivos} Passivos</div>`;
          summaryDiv.appendChild(divP);
        }
        wrapper.appendChild(summaryDiv);
      }
    }

    // --- REMINDERS ALERTS ---
    const ativos = state.alertas.filter(a => !a.concluido);
    if (!ativos.length) return;
    
    // (O restante do código de renderização dos lembretes pendentes no dashboard)
    const container = document.createElement('div');
    container.style.background = 'rgba(239,68,68,0.15)';
    container.style.borderLeft = '4px solid #ef4444';
    container.style.padding = '10px';
    container.style.borderRadius = '8px';
    container.style.marginBottom = '12px';
    container.style.color = '#fca5a5';

    if (ativos.length === 1) {
      const a = ativos[0];
      container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600">🔔 ${a.text}</div>
          <button class="btn-ghost" id="dash_solve_${a.id}" style="font-size:12px;padding:4px 8px">Resolvido</button>
        </div>
      `;
      wrapper.appendChild(container);
      document.getElementById(`dash_solve_${a.id}`).addEventListener('click', () => toggleAlerta(a.id));
    } else {
      // Multiple alerts
      let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:700">🔔 ${ativos.length} Lembretes Pendentes</div>
        <button class="btn-ghost" id="dash_toggle_alerts" style="font-size:12px">Expandir</button>
      </div>`;

      const listId = 'dash_alerts_list';
      html += `<div id="${listId}" style="display:none;flex-direction:column;gap:6px">`;
      ativos.forEach(a => {
        html += `
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.2);padding:6px;border-radius:4px">
            <span>${a.text}</span>
            <button class="btn-ghost" data-act="solve" data-id="${a.id}" style="font-size:11px">Resolvido</button>
          </div>
      `;
      });
      html += `</div>`;
      container.innerHTML = html;
      wrapper.appendChild(container);

      const toggleBtn = container.querySelector('#dash_toggle_alerts');
      const listDiv = container.querySelector(`#${listId}`);

      toggleBtn.addEventListener('click', () => {
        const isHidden = listDiv.style.display === 'none';
        listDiv.style.display = isHidden ? 'flex' : 'none';
        toggleBtn.innerText = isHidden ? 'Recolher' : 'Expandir';
      });

      container.querySelectorAll('[data-act="solve"]').forEach(b => {
        b.addEventListener('click', () => toggleAlerta(b.getAttribute('data-id')));
      });
    }
  }


  // ---------- INIT: insert UI and bind ----------
  function initEnhancements() {
    createRemindersTab();
    createAssetsTab();
    renderAlertsDashboard();

    // expose small API for manual triggers
    window.enhancements = {
      renderAssets,
      renderAlertsDashboard,
      createRemindersTab,
      createAssetsTab,
      computeAssetNet // Expor utilitário
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

})();
