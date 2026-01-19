// --- KANBAN ATUALIZADO (COM CHECKBOX E X) ---
let kanbanUnsub = null;

function initKanban(projectId) {
    if(kanbanUnsub) kanbanUnsub();
    const q = query(collection(db, `users/${currentUser.uid}/tasks`), where('projectId', '==', projectId));
    
    kanbanUnsub = onSnapshot(q, (snap) => {
        // Limpa colunas
        ['urgent', 'medium', 'low'].forEach(id => { 
            const col = document.getElementById(`col-${id}`); 
            if(col) col.innerHTML = ''; 
        });
        
        const counters = { urgent:0, medium:0, low:0 };
        
        snap.forEach(docSnap => {
            const t = docSnap.data();
            if(t.deleted) return;
            
            let p = t.priority;
            if (p === 'none' || !p) p = 'low';

            counters[p]++;
            
            const el = document.createElement('div');
            el.className = `task-card priority-${p}`;
            el.dataset.id = docSnap.id;
            
            // Verifica se é link e se está concluído
            let content = t.title.includes('http') ? `<a href="${t.title}" target="_blank" onclick="event.stopPropagation()" class="fw-bold text-decoration-none">Link Externo <i class="fas fa-external-link-alt small"></i></a>` : `<span class="fw-bold">${t.title}</span>`;
            
            // Estilos condicionais (Riscar se feito)
            const doneClass = t.done ? 'task-done-text' : '';
            const checkedState = t.done ? 'checked' : '';

            // Layout do Card: Checkbox + Texto + Botões (Pen/X)
            el.innerHTML = `
                <div class="d-flex align-items-start">
                    <div class="me-2 pt-1">
                        <input type="checkbox" class="form-check-input" style="cursor:pointer;" ${checkedState} onchange="toggleTaskDone('${docSnap.id}', this.checked)">
                    </div>
                    <div class="flex-grow-1 ${doneClass}" style="cursor:pointer;" onclick="editTask('${docSnap.id}', {title:'${t.title.replace(/'/g, "\\'")}', desc:'${(t.desc||'').replace(/'/g, "\\'")}', priority:'${p}'})">
                        ${content}
                        ${t.desc ? `<small class="text-muted text-truncate d-block mt-1">${t.desc}</small>` : ''}
                    </div>
                    <div class="task-actions ms-2 d-flex gap-2">
                        <i class="fas fa-pen text-secondary small" style="cursor:pointer;" title="Editar" onclick="editTask('${docSnap.id}', {title:'${t.title.replace(/'/g, "\\'")}', desc:'${(t.desc||'').replace(/'/g, "\\'")}', priority:'${p}'})"></i>
                        <i class="fas fa-times text-danger small" style="cursor:pointer;" title="Excluir" onclick="deleteTaskDirect('${docSnap.id}')"></i>
                    </div>
                </div>
            `;
            
            const col = document.getElementById(`col-${p}`);
            if(col) col.appendChild(el);
        });
        
        // Atualiza contadores
        Object.keys(counters).forEach(key => { 
            const h = document.querySelector(`.kanban-header.${key} .count-badge`); 
            if(h) h.innerText = counters[key]; 
        });
    });
}

// NOVA FUNÇÃO: Riscar/Desriscar tarefa
window.toggleTaskDone = async (id, isDone) => {
    await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { done: isDone });
};

// NOVA FUNÇÃO: Excluir direto pelo X
window.deleteTaskDirect = async (id) => {
    if(confirm("Excluir esta tarefa?")) {
        await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, id), { deleted: true });
    }
};

// Configuração do Drag & Drop (Mantida igual)
['urgent', 'medium', 'low'].forEach(p => {
    const el = document.getElementById(`col-${p}`);
    if(el) {
        new Sortable(el, {
            group: 'kanban', animation: 150, delay: 100, delayOnTouchOnly: true,
            onEnd: async (evt) => await updateDoc(doc(db, `users/${currentUser.uid}/tasks`, evt.item.dataset.id), { priority: evt.to.dataset.priority })
        });
    }
});
