import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- 1. CONFIGURAÇÃO FIREBASE ---
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

// --- 2. AUTH E UI ---
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
    }
};

// Login
document.getElementById('btnLogin').onclick = async () => {
    try {
        ui.loading.style.display = 'flex';
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        document.getElementById('authError').innerText = e.message;
        ui.loading.style.display = 'none';
    }
};

// Logout
document.getElementById('btnLogout').onclick = () => signOut(auth);

// Observer
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

// --- 3. NAVEGAÇÃO ---
window.navigate = (target, title = 'Hub', extra = null) => {
    // Esconde tudo
    Object.values(ui.views).forEach(el => el.style.display = 'none');
    ui.nav.back.style.display = 'none';
    
    // Mostra alvo
    if (target === 'home') {
        ui.views.projects.style.display = 'block';
        ui.nav.title.innerHTML = '<i class="fas fa-cube text-primary me-2"></i>Hub';
        activeProjectId = null;
    } 
    else if (target === 'kanban') {
        ui.views.kanban.style.display = 'block';
        ui.nav.back.style.display = 'block';
        ui.nav.title.innerText = title;
        activeProjectId = extra; // ID do projeto
        initKanban(extra);
    }
    else if (target === 'iframe') {
        ui.views.iframe.src = extra; // URL
        ui.views.iframe.style.display = 'block';
        ui.nav.back.style.display = 'block';
        ui.nav.title.innerText = title;
    }

    // Fecha menu sidebar
    const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById('sidebarMenu'));
    if(sidebar) sidebar.hide();
};

// Botões de Navegação
document.getElementById('backBtn').onclick = () => window.navigate('home');
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        const target = btn.dataset.target;
        if(target === 'iframe') window.navigate('iframe', btn.innerText, btn.dataset.url);
        else window.navigate('home');
    };
});

// --- 4. LÓGICA DE PROJETOS ---
function initProjects() {
    const q = query(collection(db, `users/${currentUser.uid}/projects`), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snap) => {
        const grid = document.getElementById('projectsGrid');
        grid.innerHTML = '';
        document.getElementById('projectCount').innerText = snap.size;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement('button');
            card.className = `project-card ${data.color}`;
            card.onclick = () => window.navigate('kanban', data.title, docSnap.id);
            
            card.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <span class="badge bg-white text-dark opacity-75">${data.type || 'Geral'}</span>
                    <i class="fas fa-pen" style="opacity:0.6" onclick="event.stopPropagation(); editProject('${docSnap.id}', '${data.title}', '${data.color}')"></i>
                </div>
                <h4 class="fw-bold text-start mt-2">${data.title}</h4>
                <div class="mt-auto text-end w-100 opacity-75 small">
                    <i class="fas fa-arrow-right"></i>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

// Criar/Editar Projeto
const projModal = new bootstrap.Modal(document.getElementById('projectModal'));
document.getElementById('fabBtn').onclick = () => {
    if(activeProjectId) openTaskModal(); // Se dentro de projeto, cria tarefa
    else {
        document.getElementById('projId').value = '';
        document.getElementById('projTitle').value = '';
        document.getElementById('btnDelProj').style.display = 'none';
        projModal.show();
    }
};

window.editProject = (id, title, color) => {
    document.getElementById('projId').value = id;
    document.getElementById('projTitle').value = title;
    document.getElementById('selectedColor').value = color;
    document.getElementById('btnDelProj').style.display = 'block';
    
    // Atualiza visual da seleção de cor
    document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('selected', d.classList.contains(color));
    });
    
    projModal.show();
};

window.selectColor = (el, color) => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('selectedColor').value = color;
};

document.getElementById('btnSaveProj').onclick = async () => {
    const id = document.getElementById('projId').value;
    const title = document.getElementById('projTitle').value;
    const color = document.getElementById('selectedColor').value;
    
    if(!title) return;
    
    const data = { title, color, type: 'Pessoal', updatedAt: new Date() }; // Type fixo por enquanto
    
    if(id) await updateDoc(doc(db, `users/${currentUser.uid}/projects`, id), data);
    else {
        data.createdAt = new Date();
        await addDoc(collection(db, `users/${currentUser.uid}/projects`), data);
    }
    projModal.hide();
};

document.getElementById('btnDelProj').onclick = async () => {
    const id = document.getElementById('projId').value;
    if(confirm("Tem certeza? Isso apaga o projeto (mas mantém tarefas na lixeira por segurança).")) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, id));
        projModal.hide();
    }
};

// --- 5. LÓGICA DE TAREFAS (KANBAN) ---
let kanbanUnsub = null;

function initKanban(projectId) {
    if(kanbanUnsub) kanbanUnsub();
    
    const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('projectId', '==', projectId));
    kanbanUnsub = onSnapshot(q, (snap) => {
        // Limpa colunas
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
            
            // Renderiza Link ou Texto
            let content = t.title;
            if(t.title.includes('http')) content = `<a href="${t.title}" target="_blank" onclick="event.stopPropagation()" class="fw-bold text-decoration-none">${t.title.substring(0,30)}... <i class="fas fa-external-link-alt small"></i></a>`;
            else content = `<span class="fw-bold">${content}</span>`;

            el.innerHTML = `
                <div>${content}</div>
                ${t.desc ? `<small class="text-muted text-truncate d-block mt-1">${t.desc}</small>` : ''}
            `;
            
            const col = document.getElementById(`col-${t.priority}`);
            if(col) col.appendChild(el);
        });

        // Atualiza contadores
        Object.keys(counters).forEach(key => {
            const header = document.querySelector(`.kanban-header.${key} .count-badge`);
            if(header) header.innerText = counters[key];
        });
    });
}

// Configura Drag & Drop
['urgent', 'medium', 'low', 'none'].forEach(p => {
    new Sortable(document.getElementById(`col-${p}`), {
        group: 'kanban', animation: 150, delay: 100, delayOnTouchOnly: true,
        onEnd: async (evt) => {
            const id = evt.item.dataset.id;
            const newPriority = evt.to.dataset.priority;
            await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { priority: newPriority });
        }
    });
});

// Modal e CRUD Tarefas
const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));

window.openTaskModal = () => {
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('btnDelTask').style.display = 'none';
    taskModal.show();
};

window.editTask = (id, data) => {
    document.getElementById('taskId').value = id;
    document.getElementById('taskTitle').value = data.title;
    document.getElementById('taskDesc').value = data.desc || '';
    document.getElementById('taskPriority').value = data.priority;
    document.getElementById('btnDelTask').style.display = 'block';
    taskModal.show();
};

document.getElementById('btnSaveTask').onclick = async () => {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value;
    const desc = document.getElementById('taskDesc').value;
    const priority = document.getElementById('taskPriority').value;

    if(!title) return;

    const data = { title, desc, priority, projectId: activeProjectId, deleted: false, updatedAt: new Date() };

    if(id) await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), data);
    else {
        data.createdAt = new Date();
        await addDoc(collection(db, `users/${currentUser.uid}/tasks`), data);
    }
    taskModal.hide();
};

document.getElementById('btnDelTask').onclick = async () => {
    const id = document.getElementById('taskId').value;
    await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { deleted: true });
    taskModal.hide();
};

// --- 6. EXTRAS (Busca e Lixeira) ---
document.getElementById('taskSearch').onkeyup = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.task-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none';
    });
};

document.getElementById('btnTrash').onclick = () => {
    const list = document.getElementById('trashList');
    list.innerHTML = '<div class="text-center p-3"><div class="spinner-border"></div></div>';
    new bootstrap.Modal(document.getElementById('trashModal')).show();

    const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('deleted', '==', true));
    onSnapshot(q, (snap) => {
        list.innerHTML = '';
        if(snap.empty) {
            list.innerHTML = '<div class="text-center mt-5 text-muted">Lixeira vazia 🎉</div>';
            return;
        }
        snap.forEach(docSnap => {
            const t = docSnap.data();
            list.innerHTML += `
                <div class="card mb-2 border-0 shadow-sm">
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${t.title}</strong><br>
                            <small class="text-muted">Do projeto original</small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-success me-2" onclick="restore('${docSnap.id}')">Restaurar</button>
                            <button class="btn btn-sm btn-outline-danger" onclick="nuke('${docSnap.id}')">X</button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
};

window.restore = async (id) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { deleted: false });
window.nuke = async (id) => {
    if(confirm("Excluir para sempre?")) await deleteDoc(doc(db, `users/${currentUser.uid}/tasks`, id));
};

// Toggle Dark Mode
document.getElementById('themeToggle').onclick = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
};
if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
