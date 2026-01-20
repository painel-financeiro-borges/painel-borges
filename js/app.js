import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDoc, setDoc, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBnOexg7KChfV2OsKBCDCuMCRT2xcAwKx8",
    authDomain: "painel-financeiro-borges.firebaseapp.com",
    projectId: "painel-financeiro-borges",
    storageBucket: "painel-financeiro-borges.firebasestorage.app",
    messagingSenderId: "354997627208",
    appId: "1:354997627208:web:90604d0a7dcd45b6e4eb7d",
    measurementId: "G-KH9BDWN2WH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let activeProjectId = null;
let tempChecklistItems = [];
let tempLinks = [];
let tempTexts = [];
let subCardSortableInstance = null;
let checklistSortableInstance = null; 

const ui = {
    loginScreen: document.getElementById('loginScreen'),
    loading: document.getElementById('loadingOverlay'),
    views: { projects: document.getElementById('view-projects'), kanban: document.getElementById('view-kanban'), iframe: document.getElementById('appFrame') },
    nav: { back: document.getElementById('backBtn'), title: document.getElementById('pageTitle'), user: document.getElementById('userEmail') },
    sections: { resources: document.getElementById('area-resources'), kanban: document.getElementById('area-kanban') }
};

document.getElementById('btnLogin').onclick = async () => { try { ui.loading.style.display = 'flex'; await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { document.getElementById('authError').innerText = e.message; ui.loading.style.display = 'none'; } };
document.getElementById('btnLogout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    ui.loading.style.display = 'none';
    if (user) { currentUser = user; ui.nav.user.innerText = user.email; ui.loginScreen.style.opacity = '0'; setTimeout(() => ui.loginScreen.style.display = 'none', 400); initProjects(); initHistory(); } 
    else { currentUser = null; ui.loginScreen.style.display = 'flex'; setTimeout(() => ui.loginScreen.style.opacity = '1', 10); }
});

async function addToHistory(action, details) {
    if(!currentUser) return;
    try { await addDoc(collection(db, `users/${currentUser.uid}/history`), { action: action, details: details, createdAt: new Date() }); } catch(e) { console.error("Erro log", e); }
}
function initHistory() {
    const q = query(collection(db, `users/${currentUser.uid}/history`), orderBy('createdAt', 'desc'), limit(50));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('systemHistoryLog'); container.innerHTML = '';
        if(snap.empty) { container.innerHTML = '<div class="text-muted small text-center">Nenhuma atividade recente.</div>'; return; }
        snap.forEach(doc => { const data = doc.data(); const time = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'; container.innerHTML += `<div class="history-item"><div><span class="history-time">[${time}]</span> <span class="history-action">${data.action}:</span> ${data.details}</div></div>`; });
    });
}
document.getElementById('btnClearHistory').onclick = async () => { if(!confirm("Limpar?")) return; const snap = await getDocs(query(collection(db, `users/${currentUser.uid}/history`))); const batch = writeBatch(db); snap.forEach(doc => batch.delete(doc.ref)); await batch.commit(); addToHistory('SISTEMA', 'Histórico limpo.'); };

window.exportData = async (format) => {
    if(!currentUser) return; ui.loading.style.display = 'flex';
    try {
        const p = await getDocs(collection(db, `users/${currentUser.uid}/projects`));
        const t = await getDocs(collection(db, `users/${currentUser.uid}/tasks`));
        const s = await getDocs(collection(db, `users/${currentUser.uid}/subcards`));
        const data = { exportedAt: new Date().toISOString(), user: currentUser.email, projects: p.docs.map(d=>({id:d.id,...d.data()})), tasks: t.docs.map(d=>({id:d.id,...d.data()})), subcards: s.docs.map(d=>({id:d.id,...d.data()})) };
        if(format==='json') { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); a.download=`backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); addToHistory('EXPORT', 'JSON baixado.'); }
        else if(format==='copy') { await navigator.clipboard.writeText(JSON.stringify(data,null,2)); alert("Copiado!"); addToHistory('EXPORT', 'Copiado para área de transferência.'); }
        else if(format==='pdf') { 
            const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text(`Relatório - ${new Date().toLocaleString()}`,10,10); let y=20;
            data.projects.forEach(proj => { if(y>270){doc.addPage();y=20;} doc.setFontSize(14); doc.text(proj.title,10,y); y+=10; const tasks=data.tasks.filter(k=>k.projectId===proj.id); tasks.forEach(task=>{doc.setFontSize(10);doc.text(`- ${task.title} [${task.priority}]`,15,y);y+=6;}); y+=5; });
            doc.save(`relatorio_${new Date().toISOString().slice(0,10)}.pdf`); addToHistory('EXPORT', 'PDF gerado.');
        }
    } catch(e) { alert("Erro export: "+e.message); } finally { ui.loading.style.display = 'none'; bootstrap.Modal.getInstance(document.getElementById('exportModal'))?.hide(); }
};

window.navigate = (target, title = 'Painel Org. Borges', extra = null) => {
    Object.values(ui.views).forEach(el => el.style.display = 'none'); ui.nav.back.style.display = 'none';
    if (target === 'home') { ui.views.projects.style.display = 'block'; ui.nav.title.innerHTML = '<i class="fas fa-cube text-primary me-2"></i>Painel Org. Borges'; activeProjectId = null; addToHistory('NAVEGAÇÃO', 'Home'); } 
    else if (target === 'kanban') { ui.views.kanban.style.display = 'block'; ui.nav.back.style.display = 'block'; ui.nav.title.innerText = title; activeProjectId = extra.id; initKanban(extra.id); initSubCards(extra.id); const savedMode = extra.viewMode || 'hybrid'; document.getElementById('viewModeSelector').value = savedMode; applyViewMode(savedMode); addToHistory('NAVEGAÇÃO', `Projeto: ${title}`); }
    else if (target === 'iframe') { ui.views.iframe.src = extra; ui.views.iframe.style.display = 'block'; ui.nav.back.style.display = 'block'; ui.nav.title.innerText = title; addToHistory('NAVEGAÇÃO', `Módulo: ${title}`); }
    bootstrap.Offcanvas.getInstance(document.getElementById('sidebarMenu'))?.hide();
};
document.getElementById('backBtn').onclick = () => window.navigate('home');
document.querySelectorAll('.nav-btn').forEach(btn => { btn.onclick = () => { const target = btn.dataset.target; if(target === 'iframe') window.navigate('iframe', btn.innerText, btn.dataset.url); else window.navigate('home'); }; });
document.getElementById('viewModeSelector').onchange = async (e) => { const mode = e.target.value; applyViewMode(mode); if(activeProjectId) await updateDoc(doc(db, `users/${currentUser.uid}/projects`, activeProjectId), { viewMode: mode }); };
function applyViewMode(mode) { const { resources, kanban } = ui.sections; if(mode === 'hybrid') { resources.style.display = 'block'; kanban.style.display = 'block'; } else if(mode === 'cards') { resources.style.display = 'block'; kanban.style.display = 'none'; } else if(mode === 'kanban') { resources.style.display = 'none'; kanban.style.display = 'block'; } }
window.addSpacer = async (blockType) => { await addDoc(collection(db, `users/${currentUser.uid}/projects`), { title: "Spacer", type: blockType, isSpacer: true, position: 99999, createdAt: new Date() }); addToHistory('LAYOUT', `Spacer em ${blockType}`); };
async function moveToTrash(collectionName, docId, data, type) { if(!currentUser) return; try { await addDoc(collection(db, `users/${currentUser.uid}/trash`), { ...data, originalCollection: collectionName, originalId: docId, itemType: type, deletedAt: new Date() }); if(collectionName && docId) { await deleteDoc(doc(db, `users/${currentUser.uid}/${collectionName}`, docId)); } addToHistory('EXCLUSÃO', `Lixeira: ${data.title || type}`); } catch(e) { console.error(e); } }
async function saveOrderFromDom(gridEl, collectionPath) { const cards = gridEl.children; const batch = writeBatch(db); Array.from(cards).forEach((card, index) => { const id = card.getAttribute('data-id'); if(id) { const ref = doc(db, collectionPath, id); batch.update(ref, { position: index }); } }); await batch.commit(); }
window.toggleProjectPin = async (e, id, currentState) => { e.stopPropagation(); await updateDoc(doc(db, `users/${currentUser.uid}/projects`, id), { pinned: !currentState }); addToHistory('FIXAR', `Projeto ${currentState ? 'desafixado' : 'fixado'}`); };

function initProjects() {
    onSnapshot(query(collection(db, `users/${currentUser.uid}/projects`)), (snap) => {
        ['Profissional', 'Pessoal', 'Ideia'].forEach(type => document.getElementById(`grid-${type}`).innerHTML = '');
        let items = []; snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => { if (!!a.pinned === !!b.pinned) { return (a.position || 0) - (b.position || 0); } return a.pinned ? -1 : 1; });
        items.forEach(data => {
            const targetGrid = document.getElementById(`grid-${data.type}`) || document.getElementById('grid-Ideia'); if(!targetGrid) return;
            let card;
            if(data.isSpacer) { card = document.createElement('div'); card.className = 'spacer-card animate-in'; card.setAttribute('data-id', data.id); card.innerHTML = `<i class="fas fa-arrows-alt spacer-icon"></i><div class="spacer-delete"><i class="fas fa-times"></i></div>`; card.querySelector('.spacer-delete').onclick = async (e) => { e.stopPropagation(); if(confirm("Lixeira?")) await moveToTrash('projects', data.id, data, 'Espaço'); }; }
            else { card = document.createElement('div'); card.className = `project-card ${data.color} animate-in`; card.setAttribute('data-id', data.id); card.addEventListener('click', (e) => { if(!e.target.closest('.fa-pen') && !e.target.closest('.pin-btn')) window.navigate('kanban', data.title, { id: data.id, viewMode: data.viewMode }); });
            card.innerHTML = `<i class="fas fa-thumbtack pin-btn ${data.pinned ? 'active' : ''}" onclick="toggleProjectPin(event, '${data.id}', ${data.pinned || false})"></i><div class="d-flex w-100 justify-content-between ps-5"><span class="badge bg-white text-dark opacity-75">${data.type}</span><i class="fas fa-pen" style="opacity:0.6; cursor:pointer; padding:5px;" onclick="editProject('${data.id}', '${data.title}', '${data.type}', '${data.color}')"></i></div><h4 class="fw-bold text-start mt-2 text-white-force">${data.title}</h4><div class="mt-auto text-end w-100 opacity-75 small"><i class="fas fa-arrow-right"></i></div>`; }
            card.setAttribute('data-type', data.type); targetGrid.appendChild(card);
        });
        ['Profissional', 'Pessoal', 'Ideia'].forEach(type => { const gridEl = document.getElementById(`grid-${type}`); if(gridEl) { new Sortable(gridEl, { group: 'projects', animation: 150, onEnd: async function(evt) { const itemEl = evt.item; const newType = evt.to.getAttribute('data-type'); const projId = itemEl.getAttribute('data-id'); if (evt.from !== evt.to) { await updateDoc(doc(db, `users/${currentUser.uid}/projects`, projId), { type: newType }); } saveOrderFromDom(evt.to, `users/${currentUser.uid}/projects`); if(evt.from !== evt.to) saveOrderFromDom(evt.from, `users/${currentUser.uid}/projects`); } }); } });
    });
}
const projModal = new bootstrap.Modal(document.getElementById('projectModal'));
document.getElementById('fabBtn').onclick = () => { if(activeProjectId) { const mode = document.getElementById('viewModeSelector').value; if(mode === 'cards') openSubCardModal(); else openTaskModal(); } else { document.getElementById('projId').value = ''; document.getElementById('projTitle').value = ''; document.getElementById('btnDelProj').style.display = 'none'; projModal.show(); } };
window.editProject = (id, title, type, color) => { document.getElementById('projId').value = id; document.getElementById('projTitle').value = title; document.getElementById('projType').value = type; document.getElementById('selectedColor').value = color; document.getElementById('btnDelProj').style.display = 'block'; document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d.classList.contains(color))); projModal.show(); };
window.selectColor = (el, color) => { document.querySelectorAll('#projectModal .color-dot').forEach(d => d.classList.remove('selected')); el.classList.add('selected'); document.getElementById('selectedColor').value = color; };
document.getElementById('btnSaveProj').onclick = async () => { const id = document.getElementById('projId').value; const title = document.getElementById('projTitle').value; const type = document.getElementById('projType').value; const color = document.getElementById('selectedColor').value; if(!title) return; const data = { title, type, color, updatedAt: new Date(), isSpacer: false }; if(id) { await updateDoc(doc(db, `users/${currentUser.uid}/projects`, id), data); addToHistory('EDIÇÃO', `Projeto: ${title}`); } else { data.createdAt = new Date(); data.position = 9999; data.pinned = false; data.viewMode = 'hybrid'; await addDoc(collection(db, `users/${currentUser.uid}/projects`), data); addToHistory('CRIAÇÃO', `Projeto: ${title}`); } projModal.hide(); };
document.getElementById('btnDelProj').onclick = async () => { if(confirm("Lixeira?")) { const id = document.getElementById('projId').value; const docRef = doc(db, `users/${currentUser.uid}/projects`, id); const docSnap = await getDoc(docRef); await moveToTrash('projects', id, docSnap.data(), 'Projeto'); projModal.hide(); } };

window.addSubSpacer = async () => { if (!activeProjectId) return; await addDoc(collection(db, `users/${currentUser.uid}/subcards`), { title: "Spacer", projectId: activeProjectId, isSpacer: true, position: 99999, createdAt: new Date() }); addToHistory('LAYOUT', 'Spacer Subcard'); };
window.togglePin = async (e, id, currentState) => { e.stopPropagation(); await updateDoc(doc(db, `users/${currentUser.uid}/subcards`, id), { pinned: !currentState }); addToHistory('FIXAR', `Subcard ${currentState ? 'desafixado' : 'fixado'}`); };

const subCardModal = new bootstrap.Modal(document.getElementById('subCardModal'));

// Helper para URL segura
const formatUrl = (url) => {
    if (!url) return '#';
    if (!/^https?:\/\//i.test(url)) return 'https://' + url;
    return url;
};

// Renderiza a lista de LINKS temporários no modal
window.renderTempLinks = () => {
    const container = document.getElementById('tempLinkList'); container.innerHTML = '';
    tempLinks.forEach((link, index) => {
        // Botão de abrir link adicionado
        const openBtn = link.url ? `<a href="${formatUrl(link.url)}" target="_blank" class="btn btn-outline-secondary border-0" title="Abrir Link"><i class="fas fa-external-link-alt"></i></a>` : '';
        
        container.innerHTML += `
            <div class="resource-item">
                <i class="fas fa-times resource-delete" onclick="removeTempLink(${index})"></i>
                <div class="input-group input-group-sm mb-1">
                    <span class="input-group-text bg-transparent border-0"><i class="fas fa-tag"></i></span>
                    <input type="text" class="form-control fw-bold" placeholder="Nome do Link" value="${link.name}" onchange="updateTempLink(${index}, 'name', this.value)">
                </div>
                <div class="input-group input-group-sm">
                    <span class="input-group-text bg-transparent border-0"><i class="fas fa-link"></i></span>
                    <input type="text" class="form-control text-primary" placeholder="URL (https://...)" value="${link.url}" onchange="updateTempLink(${index}, 'url', this.value)">
                    ${openBtn}
                </div>
            </div>`;
    });
};
window.addTempLink = () => { tempLinks.push({name: '', url: ''}); renderTempLinks(); };
window.removeTempLink = (index) => { tempLinks.splice(index, 1); renderTempLinks(); };
window.updateTempLink = (index, field, value) => { tempLinks[index][field] = value; };

window.renderTempTexts = () => {
    const container = document.getElementById('tempTextList'); container.innerHTML = '';
    tempTexts.forEach((text, index) => {
        container.innerHTML += `
            <div class="resource-item">
                <i class="fas fa-times resource-delete" onclick="removeTempText(${index})"></i>
                <input type="text" class="form-control fw-bold mb-1 border-0 bg-transparent px-0" placeholder="Título da Nota" value="${text.title}" onchange="updateTempText(${index}, 'title', this.value)">
                <textarea class="form-control border-0 bg-transparent px-0 text-muted" rows="2" placeholder="Conteúdo..." onchange="updateTempText(${index}, 'content', this.value)">${text.content}</textarea>
            </div>`;
    });
};
window.addTempText = () => { tempTexts.push({title: '', content: ''}); renderTempTexts(); };
window.removeTempText = (index) => { tempTexts.splice(index, 1); renderTempTexts(); };
window.updateTempText = (index, field, value) => { tempTexts[index][field] = value; };

window.renderTempChecklist = () => {
    const container = document.getElementById('tempChecklistList'); container.innerHTML = '';
    tempChecklistItems.forEach((item, index) => {
        const div = document.createElement('div'); div.className = `checklist-item cl-${item.priority || 'low'} ${item.done ? 'done' : ''}`;
        div.innerHTML = `<i class="fas fa-grip-vertical checklist-handle"></i><input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleTempItem(${index})"><span>${item.text}</span><i class="fas fa-times text-danger" style="cursor:pointer" onclick="removeTempItem(${index})"></i>`;
        container.appendChild(div);
    });
};
window.addTempItem = () => { const input = document.getElementById('newCheckItem'); const priority = document.getElementById('newCheckPriority').value; if(!input.value.trim()) return; tempChecklistItems.push({ text: input.value, done: false, priority: priority }); input.value = ''; renderTempChecklist(); };
window.removeTempItem = (index) => { tempChecklistItems.splice(index, 1); renderTempChecklist(); };
window.toggleTempItem = (index) => { tempChecklistItems[index].done = !tempChecklistItems[index].done; renderTempChecklist(); };

window.openSubCardModal = () => { 
    document.getElementById('subCardId').value = ''; 
    document.getElementById('subCardTitle').value = ''; 
    tempChecklistItems = []; tempLinks = []; tempTexts = [];
    renderTempChecklist(); renderTempLinks(); renderTempTexts();
    document.getElementById('btnDelSubCard').style.display = 'none'; 
    initSubCardSortable(); 
    subCardModal.show(); 
};

window.editSubCard = (id, data) => { 
    document.getElementById('subCardId').value = id; 
    document.getElementById('subCardTitle').value = data.title; 
    document.getElementById('subCardColor').value = data.color; 
    
    tempChecklistItems = data.items || [];
    tempLinks = data.links || [];
    tempTexts = data.texts || [];

    if (data.type === 'link' && tempLinks.length === 0 && data.content) { tempLinks.push({ name: 'Link Principal', url: data.content }); }
    if (data.type === 'text' && tempTexts.length === 0 && data.content) { tempTexts.push({ title: 'Nota Principal', content: data.content }); }
    
    renderTempChecklist(); renderTempLinks(); renderTempTexts();
    document.getElementById('btnDelSubCard').style.display = 'block'; 
    initSubCardSortable(); 
    subCardModal.show(); 
};

function initSubCardSortable() {
    const el = document.getElementById('tempChecklistList'); if(!el) return;
    if(checklistSortableInstance) { checklistSortableInstance.destroy(); checklistSortableInstance = null; }
    checklistSortableInstance = new Sortable(el, { animation: 150, handle: '.checklist-handle', ghostClass: 'sortable-ghost', delay: 0, fallbackOnBody: true, swapThreshold: 0.65, onEnd: function(evt) { const item = tempChecklistItems.splice(evt.oldIndex, 1)[0]; tempChecklistItems.splice(evt.newIndex, 0, item); if(navigator.vibrate) navigator.vibrate(30); } });
}
window.selectSubColor = (el, color) => { document.querySelectorAll('#subCardModal .color-dot').forEach(d => d.classList.remove('selected')); el.classList.add('selected'); document.getElementById('subCardColor').value = color; };

document.getElementById('btnSaveSubCard').onclick = async () => { 
    const id = document.getElementById('subCardId').value; const title = document.getElementById('subCardTitle').value; const color = document.getElementById('subCardColor').value; if(!title) return; 
    const data = { title, color, items: tempChecklistItems, links: tempLinks, texts: tempTexts, projectId: activeProjectId, updatedAt: new Date(), type: (tempLinks.length > 0 && tempTexts.length === 0 && tempChecklistItems.length === 0) ? 'link' : (tempTexts.length > 0 && tempLinks.length === 0 && tempChecklistItems.length === 0) ? 'text' : (tempChecklistItems.length > 0 && tempLinks.length === 0 && tempTexts.length === 0) ? 'checklist' : 'mixed' }; 
    if(id) { await updateDoc(doc(db, `users/${currentUser.uid}/subcards`, id), data); addToHistory('EDIÇÃO', `Sub-card: ${title}`); } 
    else { data.createdAt = new Date(); data.position = 99999; data.pinned = false; await addDoc(collection(db, `users/${currentUser.uid}/subcards`), data); addToHistory('CRIAÇÃO', `Sub-card: ${title}`); } 
    subCardModal.hide(); 
};
document.getElementById('btnDelSubCard').onclick = async () => { if(confirm("Lixeira?")) { const id = document.getElementById('subCardId').value; const docRef = doc(db, `users/${currentUser.uid}/subcards`, id); const docSnap = await getDoc(docRef); await moveToTrash('subcards', id, docSnap.data(), 'Recurso'); subCardModal.hide(); } };

let subCardUnsub = null;
function initSubCards(projectId) {
    if(subCardUnsub) subCardUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/subcards`), where('projectId', '==', projectId));
    subCardUnsub = onSnapshot(q, (snap) => {
        const grid = document.getElementById('subCardsGrid'); grid.innerHTML = '';
        if(snap.empty) { grid.innerHTML = '<div class="text-muted small text-center w-100 py-3">Sem recursos.</div>'; return; }
        let items = []; snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => { if (!!a.pinned === !!b.pinned) { return (a.position || 0) - (b.position || 0); } return a.pinned ? -1 : 1; });
        items.forEach(data => {
            if(data.isSpacer) {
                const spacer = document.createElement('div'); spacer.className = 'spacer-card animate-in'; spacer.setAttribute('data-id', data.id);
                spacer.innerHTML = `<i class="fas fa-arrows-alt spacer-icon"></i><div class="spacer-delete"><i class="fas fa-times"></i></div>`;
                spacer.querySelector('.spacer-delete').onclick = async (e) => { e.stopPropagation(); if(confirm("Lixeira?")) await moveToTrash('subcards', data.id, data, 'Espaço'); };
                grid.appendChild(spacer); return;
            }
            const el = document.createElement('div'); el.className = `sub-card ${data.color || 'bg-grad-1'} animate-in`; el.setAttribute('data-id', data.id);
            let icon = 'fa-layer-group';
            if (data.type === 'link') icon = 'fa-link'; else if (data.type === 'text') icon = 'fa-align-left'; else if (data.type === 'checklist') icon = 'fa-tasks';
            const pinnedClass = data.pinned ? 'active' : '';
            el.innerHTML = `<i class="fas fa-thumbtack pin-btn ${pinnedClass}" onclick="togglePin(event, '${data.id}', ${data.pinned || false})"></i><i class="fas ${icon} sub-card-icon"></i><div class="sub-card-title text-white-force">${data.title}</div><small class="opacity-75 mt-2" style="font-size:0.7rem">${data.type ? data.type.toUpperCase() : 'MISTO'}</small>`;
            el.onclick = () => { editSubCard(data.id, data); };
            grid.appendChild(el);
        });
        if(subCardSortableInstance) subCardSortableInstance.destroy();
        subCardSortableInstance = new Sortable(grid, { animation: 150, ghostClass: 'sortable-ghost', delay: 200, delayOnTouchOnly: true, touchStartThreshold: 10, onChoose: () => { if(navigator.vibrate) navigator.vibrate(50); }, onEnd: async function(evt) { saveOrderFromDom(grid, `users/${currentUser.uid}/subcards`); } });
    });
}

let kanbanUnsub = null;
function initKanban(projectId) {
    if(kanbanUnsub) kanbanUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('projectId', '==', projectId));
    kanbanUnsub = onSnapshot(q, (snap) => {
        ['urgent', 'medium', 'low'].forEach(id => { const col = document.getElementById(`col-${id}`); if(col) col.innerHTML = ''; });
        const counters = { urgent:0, medium:0, low:0 };
        snap.forEach(docSnap => {
            const t = docSnap.data(); if(t.deleted) return; let p = t.priority; if (p === 'none' || !p) p = 'low'; counters[p]++;
            const el = document.createElement('div'); el.className = `task-card priority-${p} animate-in`; el.dataset.id = docSnap.id;
            let content = t.title.includes('http') ? `<a href="${t.title}" target="_blank" onclick="event.stopPropagation()" class="fw-bold text-decoration-none">Link Externo <i class="fas fa-external-link-alt small"></i></a>` : `<span class="fw-bold">${t.title}</span>`;
            const doneClass = t.done ? 'task-done-text' : ''; const checkedState = t.done ? 'checked' : '';
            el.innerHTML = `<div class="d-flex align-items-start"><div class="me-2 pt-1"><input type="checkbox" class="form-check-input" style="cursor:pointer;" ${checkedState} onchange="toggleTaskDone('${docSnap.id}', this.checked)"></div><div class="flex-grow-1 ${doneClass}" style="cursor:pointer;" onclick="editTask('${docSnap.id}', {title:'${t.title.replace(/'/g, "\\'")}', desc:'${(t.desc||'').replace(/'/g, "\\'")}', priority:'${p}'})">${content}${t.desc ? `<small class="text-muted text-truncate d-block mt-1">${t.desc}</small>` : ''}</div><div class="task-actions ms-2 d-flex gap-2"><i class="fas fa-pen text-secondary small" style="cursor:pointer;" title="Editar" onclick="editTask('${docSnap.id}', {title:'${t.title.replace(/'/g, "\\'")}', desc:'${(t.desc||'').replace(/'/g, "\\'")}', priority:'${p}'})"></i><i class="fas fa-times text-danger small" style="cursor:pointer;" title="Excluir" onclick="deleteTaskDirect('${docSnap.id}', '${t.title}')"></i></div></div>`;
            const col = document.getElementById(`col-${p}`); if(col) col.appendChild(el);
        });
        Object.keys(counters).forEach(key => { const h = document.querySelector(`.kanban-header.${key} .count-badge`); if(h) h.innerText = counters[key]; });
    });
}
window.toggleTaskDone = async (id, isDone) => { await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { done: isDone }); addToHistory('TAREFA', `Tarefa ${isDone ? 'concluída' : 'pendente'}`); };
window.deleteTaskDirect = async (id, title) => { if(confirm("Excluir?")) { const docRef = doc(db, `users/${currentUser.uid}/tasks`, id); const docSnap = await getDoc(docRef); await moveToTrash('tasks', id, docSnap.data(), 'Tarefa'); } };
['urgent', 'medium', 'low'].forEach(p => { const el = document.getElementById(`col-${p}`); if(el) { new Sortable(el, { group: 'kanban', animation: 150, delay: 100, delayOnTouchOnly: true, onEnd: async (evt) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, evt.item.dataset.id), { priority: evt.to.dataset.priority }) }); } });
const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
window.openTaskModal = () => { document.getElementById('taskId').value = ''; document.getElementById('taskTitle').value = ''; document.getElementById('taskDesc').value = ''; document.getElementById('taskPriority').value = 'low'; document.getElementById('btnDelTask').style.display = 'none'; taskModal.show(); };
window.editTask = (id, data) => { document.getElementById('taskId').value = id; document.getElementById('taskTitle').value = data.title; document.getElementById('taskDesc').value = data.desc || ''; let p = data.priority; if(p === 'none') p = 'low'; document.getElementById('taskPriority').value = p; document.getElementById('btnDelTask').style.display = 'block'; taskModal.show(); };
document.getElementById('btnSaveTask').onclick = async () => { const id = document.getElementById('taskId').value; const title = document.getElementById('taskTitle').value; const desc = document.getElementById('taskDesc').value; const priority = document.getElementById('taskPriority').value; if(!title) return; const data = { title, desc, priority, projectId: activeProjectId, deleted: false, updatedAt: new Date() }; if(id) { await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), data); addToHistory('EDIÇÃO', `Tarefa editada: ${title}`); } else { data.createdAt = new Date(); await addDoc(collection(db, `users/${currentUser.uid}/tasks`), data); addToHistory('CRIAÇÃO', `Tarefa: ${title}`); } taskModal.hide(); };
document.getElementById('btnDelTask').onclick = async () => { const id = document.getElementById('taskId').value; const title = document.getElementById('taskTitle').value; await deleteTaskDirect(id, title); taskModal.hide(); };
document.getElementById('taskSearch').onkeyup = (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.task-card').forEach(card => card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none'); };

document.getElementById('btnTrash').onclick = () => { 
    const list = document.getElementById('trashList'); list.innerHTML = '<div class="text-center p-3"><div class="spinner-border"></div></div>'; new bootstrap.Modal(document.getElementById('trashModal')).show(); 
    const q = query(collection(db, `users/${currentUser.uid}/trash`), where('deletedAt', '!=', null));
    onSnapshot(collection(db, `users/${currentUser.uid}/trash`), (snap) => { 
        list.innerHTML = ''; if(snap.empty) { list.innerHTML = '<div class="text-center mt-5 text-muted">Lixeira vazia</div>'; return; } 
        snap.forEach(docSnap => { 
            const t = docSnap.data();
            list.innerHTML += `<div class="card mb-2 border-0 shadow-sm"><div class="card-body d-flex justify-content-between align-items-center"><div><span class="badge bg-secondary mb-1">${t.itemType || 'Item'}</span><div class="fw-bold">${t.title || 'Sem título'}</div><small class="text-muted">${t.deletedAt?.toDate ? t.deletedAt.toDate().toLocaleDateString() : ''}</small></div><div><button class="btn btn-sm btn-success me-2" onclick="restoreFromTrash('${docSnap.id}')">Recuperar</button><button class="btn btn-sm btn-outline-danger" onclick="nuke('${docSnap.id}')">X</button></div></div></div>`; 
        }); 
    }); 
};

window.restoreFromTrash = async (trashId) => {
    try {
        const trashRef = doc(db, `users/${currentUser.uid}/trash`, trashId); const trashDoc = await getDoc(trashRef);
        if(!trashDoc.exists()) { alert("Item não encontrado."); return; }
        const data = trashDoc.data(); const collectionName = data.originalCollection; const originalId = data.originalId; const type = data.itemType;
        delete data.deletedAt; delete data.originalCollection; delete data.originalId; delete data.itemType;

        if (type === 'Item Lista' && data.originalCardId) {
            const cardRef = doc(db, `users/${currentUser.uid}/subcards`, data.originalCardId); const cardSnap = await getDoc(cardRef);
            if (cardSnap.exists()) {
                const currentItems = cardSnap.data().items || []; currentItems.push({ text: data.title, priority: data.priority || 'low', done: false });
                await updateDoc(cardRef, { items: currentItems }); addToHistory('RESTAURAÇÃO', `Item de lista restaurado em Card`);
            } else {
                await addDoc(collection(db, `users/${currentUser.uid}/tasks`), { title: `[Orfão] ${data.title}`, priority: data.priority || 'low', projectId: activeProjectId || 'root', createdAt: new Date() });
                alert("Card original excluído. Item voltou como Tarefa Solta."); addToHistory('RESTAURAÇÃO', `Item restaurado como Tarefa (Órfão)`);
            }
        } else if (collectionName && originalId) {
            await setDoc(doc(db, `users/${currentUser.uid}/${collectionName}`, originalId), data); addToHistory('RESTAURAÇÃO', `Item restaurado: ${data.title}`);
        } else { alert("Erro de origem."); return; }
        await deleteDoc(trashRef);
    } catch(e) { console.error("Erro restore", e); alert("Erro ao restaurar: " + e.message); }
};
window.nuke = async (id) => { if(confirm("Excluir?")) { await deleteDoc(doc(db, `users/${currentUser.uid}/trash`, id)); addToHistory('LIXEIRA', 'Exclusão permanente'); }};
document.getElementById('themeToggle').onclick = () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); };
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
