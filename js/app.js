// Variável global para controlar a instância do Sortable do checklist (adicione lá no topo com as outras variáveis let)
let checklistSortableInstance = null; 

// ... (Resto do código) ...

// --- SUBSTITUA APENAS ESTA FUNÇÃO ---
function initSubCardSortable() {
    const el = document.getElementById('tempChecklistList');
    
    // Se já existe uma instância, destrói ela antes de criar outra (evita bugs de memória)
    if (checklistSortableInstance) {
        checklistSortableInstance.destroy();
        checklistSortableInstance = null;
    }

    if(el) {
        checklistSortableInstance = new Sortable(el, {
            animation: 150,
            handle: '.checklist-handle', // Só arrasta se pegar no ícone
            ghostClass: 'sortable-ghost', // Classe do espaço vazio
            dragClass: 'sortable-drag',   // Classe do item sendo arrastado
            delay: 0, // Sem delay, pois tem alça (handle)
            touchStartThreshold: 0, // Resposta imediata no mobile
            fallbackOnBody: true, // Garante que o item não "suma" se arrastar muito longe
            swapThreshold: 0.65, // Melhora a sensibilidade de troca
            
            onEnd: function(evt) {
                // Atualiza o array tempChecklistItems com a nova ordem
                const item = tempChecklistItems.splice(evt.oldIndex, 1)[0];
                tempChecklistItems.splice(evt.newIndex, 0, item);
            }
        });
    }
}
