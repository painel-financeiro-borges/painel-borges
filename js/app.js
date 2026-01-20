import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
    if (user) { currentUser = user; ui.nav.user.innerText = user.email; ui.loginScreen.style.opacity = '0'; setTimeout(() => ui.loginScreen.style.display = 'none', 400); initProjects(); } 
    else { currentUser = null; ui.loginScreen.style.display = 'flex'; setTimeout(() => ui.loginScreen.style.opacity = '1', 10); }
});

window.navigate = (target, title = 'Painel Org. Borges', extra = null) => {
    Object.values(ui.views).forEach(el => el.style.display = 'none');
    ui.nav.back.style.display = 'none';
    if (target === 'home') { ui.views.projects.style.display = 'block'; ui.nav.title.innerHTML = '<i class="fas fa-cube text-primary me-2"></i>Painel Org. Borges'; activeProjectId = null; } 
    else if (target === 'kanban') { ui.views.kanban.style.display = 'block'; ui.nav.back.style.display = 'block'; ui.nav.title.innerText = title; activeProjectId = extra.id; initKanban(extra.id); initSubCards(extra.id); const savedMode = extra.viewMode || 'hybrid'; document.getElementById('viewModeSelector').value = savedMode; applyViewMode(savedMode); }
    else if (target === 'iframe') { ui.views.iframe.src = extra; ui.views.iframe.style.display = 'block'; ui.nav.back.style.display = 'block'; ui.nav.title.innerText = title; }
    bootstrap.Offcanvas.getInstance(document.getElementById('sidebarMenu'))?.hide();
};

document.getElementById('backBtn').onclick = () => window.navigate('home');
document.querySelectorAll('.nav-btn').forEach(btn => { btn.onclick = () => { const target = btn.dataset.target; if(target === 'iframe') window.navigate('iframe', btn.innerText, btn.dataset.url); else window.navigate('home'); }; });
document.getElementById('viewModeSelector').onchange = async (e) => { const mode = e.target.value; applyViewMode(mode); if(activeProjectId) await updateDoc(doc(db, `users/${currentUser.uid}/projects`, activeProjectId), { viewMode: mode }); };
function applyViewMode(mode) { const { resources, kanban } = ui.sections; if(mode === 'hybrid') { resources.style.display = 'block'; kanban.style.display = 'block'; } else if(mode === 'cards') { resources.style.display = 'block'; kanban.style.display = 'none'; } else if(mode === 'kanban') { resources.style.display = 'none'; kanban.style.display = 'block'; } }

window.addSpacer = async (blockType) => { await addDoc(collection(db, `users/${currentUser.uid}/projects`), { title: "Spacer", type: blockType, isSpacer: true, position: 99999, createdAt: new Date() }); };

// --- NOVA FUNÇÃO DE TROCA (SWAP) ---
async function swapPositions(collectionName, draggedId, droppedId) {
    if (!draggedId || !droppedId || draggedId === droppedId) return;
    
    const dragRef = doc(db, collectionName, draggedId);
    const dropRef = doc(db, collectionName, droppedId);
    
    // Ler posições atuais
    const batch = writeBatch(db);
    // Como não podemos ler síncrono fácil aqui sem await, vamos assumir que o Sortable visual já trocou
    // e vamos forçar uma reordenação baseada no DOM atual
    // Essa é a estratégia mais segura: ler o DOM e salvar a ordem exata que você deixou
}

async function saveOrderFromDom(gridEl, collectionName) {
    const cards = gridEl.children;
    const batch = writeBatch(db);
    Array.from(cards).forEach((card, index) => {
        const id = card.getAttribute('data-id');
        if(id) {
            const ref = doc(db, collectionName, id);
            batch.update(ref, { position: index });
        }
    });
    await batch.commit();
}

function initProjects() {
    const q = query(collection(db, `users/${currentUser.uid}/projects`));
    onSnapshot(q, (snap) => {
        ['Profissional', 'Pessoal', 'Ideia'].forEach(type => document.getElementById(`grid-${type}`).innerHTML = '');
        let items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => (a.position || 0) - (b.position || 0));
        items.forEach(data => {
            const targetGrid = document.getElementById(`grid-${data.type}`) || document.getElementById('grid-Ideia');
            if(!targetGrid) return;
            if(data.isSpacer) {
                const spacer = document.createElement('div'); spacer.className = 'spacer-card'; spacer.setAttribute('data-id', data.id);
                spacer.innerHTML = `<i class="fas fa-arrows-alt spacer-icon"></i><div class="spacer-delete" title="Excluir"><i class="fas fa-times"></i></div>`;
                spacer.querySelector('.spacer-delete').onclick = async (e) => { e.stopPropagation(); if(confirm("Remover espaço?")) await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, data.id)); };
                targetGrid.appendChild(spacer); return;
            }
            const card = document.createElement('div'); card.className = `project-card ${data.color}`; card.setAttribute('data-id', data.id);
            card.addEventListener('click', (e) => { if(!e.target.closest('.fa-pen')) window.navigate('kanban', data.title, { id: data.id, viewMode: data.viewMode }); });
            card.innerHTML = `<div class="d-flex w-100 justify-content-between"><span class="badge bg-white text-dark opacity-75">${data.type}</span><i class="fas fa-pen" style="opacity:0.6; cursor:pointer; padding:5px;" onclick="editProject('${data.id}', '${data.title}', '${data.type}', '${data.color}')"></i></div><h4 class="fw-bold text-start mt-2">${data.title}</h4><div class="mt-auto text-end w-100 opacity-75 small"><i class="fas fa-arrow-right"></i></div>`;
            targetGrid.appendChild(card);
        });
        
        ['Profissional', 'Pessoal', 'Ideia'].forEach(type => {
            const gridEl = document.getElementById(`grid-${type}`);
            if(gridEl) { 
                new Sortable(gridEl, { 
                    group: 'projects', animation: 150, 
                    delay: 200, delayOnTouchOnly: true, // SEGURA PARA ARRASTAR
                    onChoose: () => { if(navigator.vibrate) navigator.vibrate(50); },
                    onEnd: async function(evt) { 
                        const itemEl = evt.item;
                        const newType = evt.to.getAttribute('data-type'); 
                        const projId = itemEl.getAttribute('data-id'); 
                        
                        // Atualiza tipo se mudou de lista
                        if (evt.from !== evt.to) { await updateDoc(doc(db, `users/${currentUser.uid}/projects`, projId), { type: newType }); } 
                        
                        // SALVA A ORDEM EXATA DO DOM (SIMULA SWAP SE VOCÊ TROCOU 1 POR 1)
                        saveOrderFromDom(evt.to, `users/${currentUser.uid}/projects`);
                        if(evt.from !== evt.to) saveOrderFromDom(evt.from, `users/${currentUser.uid}/projects`);
                    } 
                }); 
            }
        });
    });
}

const projModal = new bootstrap.Modal(document.getElementById('projectModal'));
document.getElementById('fabBtn').onclick = () => {
    if(activeProjectId) { const mode = document.getElementById('viewModeSelector').value; if(mode === 'cards') openSubCardModal(); else openTaskModal(); } 
    else { document.getElementById('projId').value = ''; document.getElementById('projTitle').value = ''; document.getElementById('btnDelProj').style.display = 'none'; projModal.show(); }
};
window.editProject = (id, title, type, color) => { document.getElementById('projId').value = id; document.getElementById('projTitle').value = title; document.getElementById('projType').value = type; document.getElementById('selectedColor').value = color; document.getElementById('btnDelProj').style.display = 'block'; document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d.classList.contains(color))); projModal.show(); };
window.selectColor = (el, color) => { document.querySelectorAll('#projectModal .color-dot').forEach(d => d.classList.remove('selected')); el.classList.add('selected'); document.getElementById('selectedColor').value = color; };
document.getElementById('btnSaveProj').onclick = async () => { const id = document.getElementById('projId').value; const title = document.getElementById('projTitle').value; const type = document.getElementById('projType').value; const color = document.getElementById('selectedColor').value; if(!title) return; const data = { title, type, color, updatedAt: new Date(), isSpacer: false }; if(id) await updateDoc(doc(db, `users/${currentUser.uid}/projects`, id), data); else { data.createdAt = new Date(); data.position = 9999; data.viewMode = 'hybrid'; await addDoc(collection(db, `users/${currentUser.uid}/projects`), data); } projModal.hide(); };
document.getElementById('btnDelProj').onclick = async () => { if(confirm("Apagar?")) { await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, document.getElementById('projId').value)); projModal.hide(); } };

// --- SUB-CARDS (RECURSOS) ---
window.addSubSpacer = async () => { if (!activeProjectId) return; await addDoc(collection(db, `users/${currentUser.uid}/subcards`), { title: "Spacer", projectId: activeProjectId, isSpacer: true, position: 99999, createdAt: new Date() }); };

let subCardUnsub = null;
function initSubCards(projectId) {
    if(subCardUnsub) subCardUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/subcards`), where('projectId', '==', projectId));
    subCardUnsub = onSnapshot(q, (snap) => {
        const grid = document.getElementById('subCardsGrid'); grid.innerHTML = '';
        if(snap.empty) { grid.innerHTML = '<div class="text-muted small text-center w-100 py-3">Sem recursos.</div>'; return; }
        let items = [];
        snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        items.sort((a, b) => (a.position || 0) - (b.position || 0));
        items.forEach(data => {
            if(data.isSpacer) {
                const spacer = document.createElement('div'); spacer.className = 'spacer-card'; spacer.setAttribute('data-id', data.id);
                spacer.innerHTML = `<i class="fas fa-arrows-alt spacer-icon"></i><div class="spacer-delete" title="Excluir"><i class="fas fa-times"></i></div>`;
                spacer.querySelector('.spacer-delete').onclick = async (e) => { e.stopPropagation(); if(confirm("Remover espaço?")) await deleteDoc(doc(db, `users/${currentUser.uid}/subcards`, data.id)); };
                grid.appendChild(spacer); return;
            }
            const el = document.createElement('div'); el.className = `sub-card ${data.color || 'bg-grad-1'}`; el.setAttribute('data-id', data.id);
            let icon = 'fa-align-left'; if (data.type === 'link') icon = 'fa-link'; if (data.type === 'checklist') icon = 'fa-tasks';
            el.innerHTML = `<i class="fas ${icon} sub-card-icon"></i><div class="sub-card-title">${data.title}</div><small class="opacity-75 mt-2" style="font-size:0.7rem">${data.type.toUpperCase()}</small>`;
            el.onclick = () => { if(data.type === 'link' && !confirm("Editar?")) window.open(data.content, '_blank'); else editSubCard(data.id, data); };
            grid.appendChild(el);
        });
        
        // CONFIG SORTABLE SUB-CARDS (SWAP SIMULADO)
        new Sortable(grid, { 
            animation: 150, ghostClass: 'sortable-ghost', 
            delay: 200, delayOnTouchOnly: true, // SEGURA PARA ARRASTAR
            onChoose: () => { if(navigator.vibrate) navigator.vibrate(50); },
            onEnd: async function(evt) { saveOrderFromDom(grid, `users/${currentUser.uid}/subcards`); } 
        });
    });
}

const subCardModal = new bootstrap.Modal(document.getElementById('subCardModal'));
window.toggleSubCardInputs = () => { const type = document.getElementById('subCardType').value; document.getElementById('areaInputText').style.display = (type === 'checklist') ? 'none' : 'block'; document.getElementById('areaInputChecklist').style.display = (type === 'checklist') ? 'block' : 'none'; };
document.getElementById('subCardType').onchange = window.toggleSubCardInputs;

window.renderTempChecklist = () => {
    const container = document.getElementById('tempChecklistList');
    container.innerHTML = '';
    tempChecklistItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `checklist-item cl-${item.priority || 'low'} ${item.done ? 'done' : ''}`;
        div.innerHTML = `<i class="fas fa-grip-vertical checklist-handle"></i><input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleTempItem(${index})"><span>${item.text}</span><i class="fas fa-times text-danger" style="cursor:pointer" onclick="removeTempItem(${index})"></i>`;
        container.appendChild(div);
    });
};
window.addTempItem = () => {
    const input = document.getElementById('newCheckItem');
    const priority = document.getElementById('newCheckPriority').value;
    if(!input.value.trim()) return;
    tempChecklistItems.push({ text: input.value, done: false, priority: priority });
    input.value = ''; renderTempChecklist();
};
window.removeTempItem = (index) => { tempChecklistItems.splice(index, 1); renderTempChecklist(); };
window.toggleTempItem = (index) => { tempChecklistItems[index].done = !tempChecklistItems[index].done; renderTempChecklist(); };

window.openSubCardModal = () => { 
    document.getElementById('subCardId').value = ''; document.getElementById('subCardTitle').value = ''; document.getElementById('subCardContent').value = ''; document.getElementById('subCardType').value = 'checklist'; 
    tempChecklistItems = []; renderTempChecklist(); toggleSubCardInputs(); document.getElementById('btnDelSubCard').style.display = 'none'; 
    initSubCardSortable(); subCardModal.show(); 
};
window.editSubCard = (id, data) => { 
    document.getElementById('subCardId').value = id; document.getElementById('subCardTitle').value = data.title; document.getElementById('subCardContent').value = data.content || ''; document.getElementById('subCardType').value = data.type; document.getElementById('subCardColor').value = data.color; 
    tempChecklistItems = data.items || []; renderTempChecklist(); toggleSubCardInputs(); document.getElementById('btnDelSubCard').style.display = 'block'; 
    initSubCardSortable(); subCardModal.show(); 
};
function initSubCardSortable() {
    const el = document.getElementById('tempChecklistList');
    if(el) { new Sortable(el, { animation: 150, handle: '.checklist-handle', onEnd: function(evt) { const item = tempChecklistItems.splice(evt.oldIndex, 1)[0]; tempChecklistItems.splice(evt.newIndex, 0, item); } }); }
}
window.selectSubColor = (el, color) => { document.querySelectorAll('#subCardModal .color-dot').forEach(d => d.classList.remove('selected')); el.classList.add('selected'); document.getElementById('subCardColor').value = color; };
document.getElementById('btnSaveSubCard').onclick = async () => { const id = document.getElementById('subCardId').value; const title = document.getElementById('subCardTitle').value; const content = document.getElementById('subCardContent').value; const type = document.getElementById('subCardType').value; const color = document.getElementById('subCardColor').value; if(!title) return; const data = { title, content, type, color, items: tempChecklistItems, projectId: activeProjectId, updatedAt: new Date(), position: 99999 }; if(id) await updateDoc(doc(db, `users/${currentUser.uid}/subcards`, id), data); else { data.createdAt = new Date(); await addDoc(collection(db, `users/${currentUser.uid}/subcards`), data); } subCardModal.hide(); };
document.getElementById('btnDelSubCard').onclick = async () => { if(confirm("Excluir?")) { await deleteDoc(doc(db, `users/${currentUser.uid}/subcards`, document.getElementById('subCardId').value)); subCardModal.hide(); } };

let kanbanUnsub = null;
function initKanban(projectId) {
    if(kanbanUnsub) kanbanUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('projectId', '==', projectId));
    kanbanUnsub = onSnapshot(q, (snap) => {
        ['urgent', 'medium', 'low'].forEach(id => { const col = document.getElementById(`col-${id}`); if(col) col.innerHTML = ''; });
        const counters = { urgent:0, medium:0, low:0 };
        snap.forEach(docSnap => {
            const t = docSnap.data(); if(t.deleted) return; let p = t.priority; if (p === 'none' || !p) p = 'low'; counters[p]++;
            const el = document.createElement('div'); el.className = `task-card priority-${p}`; el.dataset.id = docSnap.id;
            let content = t.title.includes('http') ? `<a href="${t.title}" target="_blank" onclick="event.stopPropagation()" class="fw-bold text-decoration-none">Link Externo <i class="fas fa-external-link-alt small"></i></a>` : `<span class="fw-bold">${t.title}</span>`;
            const doneClass = t.done ? 'task-done-text' : ''; const checkedState = t.done ? 'checked' : '';
            el.innerHTML = `<div class="d-flex align-items-start"><div class="me-2 pt-1"><input type="checkbox" class="form-check-input" style="cursor:pointer;" ${checkedState} onchange="toggleTaskDone('${docSnap.id}', this.checked)"></div><div class="flex-grow-1 ${doneClass}" style="cursor:pointer;" onclick="editTask('${docSnap.id}', {title:'${t.title.replace(/'/g, "\\'")}', desc:'${(t.desc||'').replace(/'/g, "\\'")}', priority:'${p}'})">${content}${t.desc ? `<small class="text-muted text-truncate d-block mt-1">${t.desc}</small>` : ''}</div><div class="task-actions ms-2 d-flex gap-2"><i class="fas fa-pen text-secondary small" style="cursor:pointer;" title="Editar" onclick="editTask('${docSnap.id}', {title:'${t.title.replace(/'/g, "\\'")}', desc:'${(t.desc||'').replace(/'/g, "\\'")}', priority:'${p}'})"></i><i class="fas fa-times text-danger small" style="cursor:pointer;" title="Excluir" onclick="deleteTaskDirect('${docSnap.id}')"></i></div></div>`;
            const col = document.getElementById(`col-${p}`); if(col) col.appendChild(el);
        });
        Object.keys(counters).forEach(key => { const h = document.querySelector(`.kanban-header.${key} .count-badge`); if(h) h.innerText = counters[key]; });
    });
}
window.toggleTaskDone = async (id, isDone) => { await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { done: isDone }); };
window.deleteTaskDirect = async (id) => { if(confirm("Excluir esta tarefa?")) { await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { deleted: true }); } };
['urgent', 'medium', 'low'].forEach(p => { const el = document.getElementById(`col-${p}`); if(el) { new Sortable(el, { group: 'kanban', animation: 150, delay: 100, delayOnTouchOnly: true, onEnd: async (evt) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, evt.item.dataset.id), { priority: evt.to.dataset.priority }) }); } });
const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
window.openTaskModal = () => { document.getElementById('taskId').value = ''; document.getElementById('taskTitle').value = ''; document.getElementById('taskDesc').value = ''; document.getElementById('taskPriority').value = 'low'; document.getElementById('btnDelTask').style.display = 'none'; taskModal.show(); };
window.editTask = (id, data) => { document.getElementById('taskId').value = id; document.getElementById('taskTitle').value = data.title; document.getElementById('taskDesc').value = data.desc || ''; let p = data.priority; if(p === 'none') p = 'low'; document.getElementById('taskPriority').value = p; document.getElementById('btnDelTask').style.display = 'block'; taskModal.show(); };
document.getElementById('btnSaveTask').onclick = async () => { const id = document.getElementById('taskId').value; const title = document.getElementById('taskTitle').value; const desc = document.getElementById('taskDesc').value; const priority = document.getElementById('taskPriority').value; if(!title) return; const data = { title, desc, priority, projectId: activeProjectId, deleted: false, updatedAt: new Date() }; if(id) await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), data); else { data.createdAt = new Date(); await addDoc(collection(db, `users/${currentUser.uid}/tasks`), data); } taskModal.hide(); };
document.getElementById('btnDelTask').onclick = async () => { await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, document.getElementById('taskId').value), { deleted: true }); taskModal.hide(); };
document.getElementById('taskSearch').onkeyup = (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.task-card').forEach(card => card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none'); };
document.getElementById('btnTrash').onclick = () => { const list = document.getElementById('trashList'); list.innerHTML = '<div class="text-center p-3"><div class="spinner-border"></div></div>'; new bootstrap.Modal(document.getElementById('trashModal')).show(); const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('deleted', '==', true)); onSnapshot(q, (snap) => { list.innerHTML = ''; if(snap.empty) { list.innerHTML = '<div class="text-center mt-5 text-muted">Lixeira vazia</div>'; return; } snap.forEach(docSnap => { const t = docSnap.data(); list.innerHTML += `<div class="card mb-2 border-0 shadow-sm"><div class="card-body d-flex justify-content-between align-items-center"><div><strong>${t.title}</strong></div><div><button class="btn btn-sm btn-success me-2" onclick="restore('${docSnap.id}')">Restaurar</button><button class="btn btn-sm btn-outline-danger" onclick="nuke('${docSnap.id}')">X</button></div></div></div>`; }); }); };
window.restore = async (id) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { deleted: false });
window.nuke = async (id) => { if(confirm("Excluir para sempre?")) await deleteDoc(doc(db, `users/${currentUser.uid}/tasks`, id)); };
document.getElementById('themeToggle').onclick = () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); };
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
