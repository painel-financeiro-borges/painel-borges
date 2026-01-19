import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

const ui = {
    loginScreen: document.getElementById('loginScreen'),
    loading: document.getElementById('loadingOverlay'),
    views: {
        projects: document.getElementById('view-projects'),
        kanban: document.getElementById('view-kanban'),
        iframe: document.getElementById('appFrame')
    },
    nav: {
        back: document.getElementById('backBtn'),
        title: document.getElementById('pageTitle'),
        user: document.getElementById('userEmail')
    },
    sections: {
        resources: document.getElementById('area-resources'),
        kanban: document.getElementById('area-kanban')
    }
};

document.getElementById('btnLogin').onclick = async () => {
    try { ui.loading.style.display = 'flex'; await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (e) { document.getElementById('authError').innerText = e.message; ui.loading.style.display = 'none'; }
};
document.getElementById('btnLogout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    ui.loading.style.display = 'none';
    if (user) {
        currentUser = user;
        ui.nav.user.innerText = user.email;
        ui.loginScreen.style.opacity = '0';
        setTimeout(() => ui.loginScreen.style.display = 'none', 400);
        initProjects();
    } else {
        currentUser = null;
        ui.loginScreen.style.display = 'flex';
        setTimeout(() => ui.loginScreen.style.opacity = '1', 10);
    }
});

// NAVEGAÇÃO
window.navigate = (target, title = 'Painel Org. Borges', extra = null) => {
    Object.values(ui.views).forEach(el => el.style.display = 'none');
    ui.nav.back.style.display = 'none';
    
    if (target === 'home') {
        ui.views.projects.style.display = 'block';
        ui.nav.title.innerHTML = '<i class="fas fa-cube text-primary me-2"></i>Painel Org. Borges';
        activeProjectId = null;
    } 
    else if (target === 'kanban') {
        ui.views.kanban.style.display = 'block';
        ui.nav.back.style.display = 'block';
        ui.nav.title.innerText = title;
        activeProjectId = extra.id;
        initKanban(extra.id);
        initSubCards(extra.id);
        const savedMode = extra.viewMode || 'hybrid';
        document.getElementById('viewModeSelector').value = savedMode;
        applyViewMode(savedMode);
    }
    else if (target === 'iframe') {
        ui.views.iframe.src = extra;
        ui.views.iframe.style.display = 'block';
        ui.nav.back.style.display = 'block';
        ui.nav.title.innerText = title;
    }
    bootstrap.Offcanvas.getInstance(document.getElementById('sidebarMenu'))?.hide();
};

document.getElementById('backBtn').onclick = () => window.navigate('home');
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        const target = btn.dataset.target;
        if(target === 'iframe') window.navigate('iframe', btn.innerText, btn.dataset.url);
        else window.navigate('home');
    };
});

document.getElementById('viewModeSelector').onchange = async (e) => {
    const mode = e.target.value;
    applyViewMode(mode);
    if(activeProjectId) await updateDoc(doc(db, `users/${currentUser.uid}/projects`, activeProjectId), { viewMode: mode });
};

function applyViewMode(mode) {
    const { resources, kanban } = ui.sections;
    if(mode === 'hybrid') { resources.style.display = 'block'; kanban.style.display = 'block'; }
    else if(mode === 'cards') { resources.style.display = 'block'; kanban.style.display = 'none'; }
    else if(mode === 'kanban') { resources.style.display = 'none'; kanban.style.display = 'block'; }
}

// --- PROJETOS POR BLOCOS (Lógica Nova) ---
function initProjects() {
    // Carrega tudo
    const q = query(collection(db, `users/${currentUser.uid}/projects`), orderBy('position', 'asc'));
    
    onSnapshot(q, (snap) => {
        // Limpa os 3 grids
        ['Profissional', 'Pessoal', 'Ideia'].forEach(type => document.getElementById(`grid-${type}`).innerHTML = '');

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement('div'); // Div para arrastar melhor
            card.className = `project-card ${data.color}`;
            card.setAttribute('data-id', docSnap.id);
            
            // Lógica de clique manual
            card.addEventListener('click', (e) => {
                if(!e.target.closest('.fa-pen')) {
                    window.navigate('kanban', data.title, { id: docSnap.id, viewMode: data.viewMode });
                }
            });

            card.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <span class="badge bg-white text-dark opacity-75">${data.type}</span>
                    <i class="fas fa-pen" style="opacity:0.6; cursor:pointer; padding:5px;" onclick="editProject('${docSnap.id}', '${data.title}', '${data.type}', '${data.color}')"></i>
                </div>
                <h4 class="fw-bold text-start mt-2">${data.title}</h4>
                <div class="mt-auto text-end w-100 opacity-75 small"><i class="fas fa-arrow-right"></i></div>
            `;
            
            // Adiciona no grid correto
            const targetGrid = document.getElementById(`grid-${data.type}`) || document.getElementById('grid-Ideia');
            targetGrid.appendChild(card);
        });

        // Configura Drag & Drop para os 3 grids
        ['Profissional', 'Pessoal', 'Ideia'].forEach(type => {
            const gridEl = document.getElementById(`grid-${type}`);
            new Sortable(gridEl, {
                group: 'projects', // Permite mover entre grids
                animation: 150,
                delay: 150,
                delayOnTouchOnly: true,
                onEnd: async function(evt) {
                    const itemEl = evt.item;
                    const newType = evt.to.getAttribute('data-type'); // Pega o tipo do grid onde soltou
                    const projId = itemEl.getAttribute('data-id');
                    
                    // Se mudou de lista, atualiza o Tipo no banco
                    if (evt.from !== evt.to) {
                        await updateDoc(doc(db, `users/${currentUser.uid}/projects`, projId), { type: newType });
                    }
                    // Atualiza posições
                    updateProjectOrder(evt.to); 
                }
            });
        });
    });
}

async function updateProjectOrder(gridEl) {
    const cards = gridEl.querySelectorAll('.project-card');
    const batch = writeBatch(db);
    cards.forEach((card, index) => {
        const id = card.getAttribute('data-id');
        const ref = doc(db, `users/${currentUser.uid}/projects`, id);
        batch.update(ref, { position: index });
    });
    await batch.commit();
}

// Modal Projeto
const projModal = new bootstrap.Modal(document.getElementById('projectModal'));
document.getElementById('fabBtn').onclick = () => {
    if(activeProjectId) {
        const mode = document.getElementById('viewModeSelector').value;
        if(mode === 'cards') openSubCardModal(); else openTaskModal();
    } else {
        document.getElementById('projId').value = '';
        document.getElementById('projTitle').value = '';
        document.getElementById('btnDelProj').style.display = 'none';
        projModal.show();
    }
};

window.editProject = (id, title, type, color) => {
    document.getElementById('projId').value = id;
    document.getElementById('projTitle').value = title;
    document.getElementById('projType').value = type;
    document.getElementById('selectedColor').value = color;
    document.getElementById('btnDelProj').style.display = 'block';
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d.classList.contains(color)));
    projModal.show();
};
window.selectColor = (el, color) => {
    document.querySelectorAll('#projectModal .color-dot').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('selectedColor').value = color;
};
document.getElementById('btnSaveProj').onclick = async () => {
    const id = document.getElementById('projId').value;
    const title = document.getElementById('projTitle').value;
    const type = document.getElementById('projType').value;
    const color = document.getElementById('selectedColor').value;
    if(!title) return;
    const data = { title, type, color, updatedAt: new Date() };
    if(id) await updateDoc(doc(db, `users/${currentUser.uid}/projects`, id), data);
    else { data.createdAt = new Date(); data.position = 9999; data.viewMode = 'hybrid'; await addDoc(collection(db, `users/${currentUser.uid}/projects`), data); }
    projModal.hide();
};
document.getElementById('btnDelProj').onclick = async () => { if(confirm("Apagar?")) { await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, document.getElementById('projId').value)); projModal.hide(); } };

// --- SUB-CARDS e TAREFAS (Mantidos iguais) ---
let subCardUnsub = null;
function initSubCards(projectId) {
    if(subCardUnsub) subCardUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/subcards`), where('projectId', '==', projectId));
    subCardUnsub = onSnapshot(q, (snap) => {
        const grid = document.getElementById('subCardsGrid');
        grid.innerHTML = '';
        if(snap.empty) { grid.innerHTML = '<div class="text-muted small text-center w-100 py-3" style="grid-column: span 2;">Sem recursos.</div>'; return; }
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const el = document.createElement('div');
            el.className = `sub-card ${data.color || 'bg-grad-1'}`;
            const icon = data.type === 'link' ? 'fa-link' : 'fa-align-left';
            el.innerHTML = `<i class="fas ${icon} sub-card-icon"></i><div class="sub-card-title">${data.title}</div><small class="opacity-75 mt-2" style="font-size:0.7rem">${data.type === 'link' ? 'Abrir Link' : 'Ver Texto'}</small>`;
            el.onclick = () => { if(data.type === 'link' && !confirm("Editar?")) window.open(data.content, '_blank'); else editSubCard(docSnap.id, data); };
            grid.appendChild(el);
        });
    });
}
// Helpers SubCard...
const subCardModal = new bootstrap.Modal(document.getElementById('subCardModal'));
window.openSubCardModal = () => { document.getElementById('subCardId').value = ''; document.getElementById('subCardTitle').value = ''; document.getElementById('subCardContent').value = ''; document.getElementById('btnDelSubCard').style.display = 'none'; subCardModal.show(); };
window.editSubCard = (id, data) => { document.getElementById('subCardId').value = id; document.getElementById('subCardTitle').value = data.title; document.getElementById('subCardContent').value = data.content; document.getElementById('subCardType').value = data.type; document.getElementById('subCardColor').value = data.color; document.getElementById('btnDelSubCard').style.display = 'block'; subCardModal.show(); };
window.selectSubColor = (el, color) => { document.querySelectorAll('#subCardModal .color-dot').forEach(d => d.classList.remove('selected')); el.classList.add('selected'); document.getElementById('subCardColor').value = color; };
document.getElementById('btnSaveSubCard').onclick = async () => { const id = document.getElementById('subCardId').value; const title = document.getElementById('subCardTitle').value; const content = document.getElementById('subCardContent').value; const type = document.getElementById('subCardType').value; const color = document.getElementById('subCardColor').value; if(!title) return; const data = { title, content, type, color, projectId: activeProjectId, updatedAt: new Date() }; if(id) await updateDoc(doc(db, `users/${currentUser.uid}/subcards`, id), data); else { data.createdAt = new Date(); await addDoc(collection(db, `users/${currentUser.uid}/subcards`), data); } subCardModal.hide(); };
document.getElementById('btnDelSubCard').onclick = async () => { if(confirm("Excluir?")) { await deleteDoc(doc(db, `users/${currentUser.uid}/subcards`, document.getElementById('subCardId').value)); subCardModal.hide(); } };

// Kanban...
let kanbanUnsub = null;
function initKanban(projectId) {
    if(kanbanUnsub) kanbanUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('projectId', '==', projectId));
    kanbanUnsub = onSnapshot(q, (snap) => {
        document.querySelectorAll('.kanban-col').forEach(c => c.innerHTML = '');
        const counters = { urgent:0, medium:0, low:0, none:0 };
        snap.forEach(docSnap => {
            const t = docSnap.data();
            if(t.deleted) return;
            counters[t.priority || 'none']++;
            const el = document.createElement('div');
            el.className = `task-card priority-${t.priority}`;
            el.dataset.id = docSnap.id;
            el.onclick = () => editTask(docSnap.id, t);
            let content = t.title.includes('http') ? `<a href="${t.title}" target="_blank" onclick="event.stopPropagation()" class="fw-bold text-decoration-none">Link <i class="fas fa-external-link-alt small"></i></a>` : `<span class="fw-bold">${t.title}</span>`;
            el.innerHTML = `<div>${content}</div>${t.desc ? `<small class="text-muted text-truncate d-block mt-1">${t.desc}</small>` : ''}`;
            const col = document.getElementById(`col-${t.priority}`);
            if(col) col.appendChild(el);
        });
        Object.keys(counters).forEach(key => { const h = document.querySelector(`.kanban-header.${key} .count-badge`); if(h) h.innerText = counters[key]; });
    });
}
['urgent', 'medium', 'low', 'none'].forEach(p => {
    new Sortable(document.getElementById(`col-${p}`), {
        group: 'kanban', animation: 150, delay: 100, delayOnTouchOnly: true,
        onEnd: async (evt) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, evt.item.dataset.id), { priority: evt.to.dataset.priority })
    });
});
const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
window.openTaskModal = () => { document.getElementById('taskId').value = ''; document.getElementById('taskTitle').value = ''; document.getElementById('taskDesc').value = ''; document.getElementById('btnDelTask').style.display = 'none'; taskModal.show(); };
window.editTask = (id, data) => { document.getElementById('taskId').value = id; document.getElementById('taskTitle').value = data.title; document.getElementById('taskDesc').value = data.desc || ''; document.getElementById('taskPriority').value = data.priority; document.getElementById('btnDelTask').style.display = 'block'; taskModal.show(); };
document.getElementById('btnSaveTask').onclick = async () => { const id = document.getElementById('taskId').value; const title = document.getElementById('taskTitle').value; const desc = document.getElementById('taskDesc').value; const priority = document.getElementById('taskPriority').value; if(!title) return; const data = { title, desc, priority, projectId: activeProjectId, deleted: false, updatedAt: new Date() }; if(id) await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), data); else { data.createdAt = new Date(); await addDoc(collection(db, `users/${currentUser.uid}/tasks`), data); } taskModal.hide(); };
document.getElementById('btnDelTask').onclick = async () => { await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, document.getElementById('taskId').value), { deleted: true }); taskModal.hide(); };

// Extras...
document.getElementById('taskSearch').onkeyup = (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.task-card').forEach(card => card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none'); };
document.getElementById('btnTrash').onclick = () => { const list = document.getElementById('trashList'); list.innerHTML = '<div class="text-center p-3"><div class="spinner-border"></div></div>'; new bootstrap.Modal(document.getElementById('trashModal')).show(); const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('deleted', '==', true)); onSnapshot(q, (snap) => { list.innerHTML = ''; if(snap.empty) { list.innerHTML = '<div class="text-center mt-5 text-muted">Lixeira vazia</div>'; return; } snap.forEach(docSnap => { const t = docSnap.data(); list.innerHTML += `<div class="card mb-2 border-0 shadow-sm"><div class="card-body d-flex justify-content-between align-items-center"><div><strong>${t.title}</strong></div><div><button class="btn btn-sm btn-success me-2" onclick="restore('${docSnap.id}')">Restaurar</button><button class="btn btn-sm btn-outline-danger" onclick="nuke('${docSnap.id}')">X</button></div></div></div>`; }); }); };
window.restore = async (id) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { deleted: false });
window.nuke = async (id) => { if(confirm("Excluir para sempre?")) await deleteDoc(doc(db, `users/${currentUser.uid}/tasks`, id)); };
document.getElementById('themeToggle').onclick = () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); };
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
