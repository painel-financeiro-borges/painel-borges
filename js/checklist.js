let checklistAtual = null;
let uidAtual = null;

auth.onAuthStateChanged(user => {
  if (!user) return;
  uidAtual = user.uid;
});

// Abrir seção
function abrirChecklists() {
  document.querySelector(".cards").style.display = "none";
  document.getElementById("checklists-section").style.display = "block";
  carregarChecklistSistema();
}

// Carrega checklist principal
function carregarChecklistSistema() {
  const ref = db
    .collection("users")
    .doc(uidAtual)
    .collection("checklists")
    .where("system", "==", true)
    .limit(1);

  ref.get().then(snapshot => {
    if (snapshot.empty) return;

    const doc = snapshot.docs[0];
    checklistAtual = doc.id;
    carregarItens();
  });
}

// Carrega itens
function carregarItens() {
  const container = document.getElementById("checklists-container");
  container.innerHTML = "";

  db.collection("users")
    .doc(uidAtual)
    .collection("checklists")
    .doc(checklistAtual)
    .collection("items")
    .where("deleted", "==", false)
    .orderBy("priority")
    .orderBy("position")
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const item = doc.data();
        container.appendChild(renderItem(doc.id, item));
      });
    });
}

// Render do item
function renderItem(id, item) {
  const div = document.createElement("div");
  div.className = `item priority-${item.priority}`;
  div.innerHTML = `
    <input value="${item.text}" onchange="editarItem('${id}', this.value)">
    <select onchange="alterarPrioridade('${id}', this.value)">
      <option value="none" ${item.priority==="none"?"selected":""}>⚪</option>
      <option value="high" ${item.priority==="high"?"selected":""}>🔴</option>
      <option value="medium" ${item.priority==="medium"?"selected":""}>🟡</option>
      <option value="low" ${item.priority==="low"?"selected":""}>🟢</option>
    </select>
    <button onclick="excluirItem('${id}')">🗑️</button>
  `;
  return div;
}

// Criar item
function criarItem() {
  const texto = document.getElementById("novo-item-texto").value;
  const prioridade = document.getElementById("novo-item-prioridade").value;

  if (!texto) return;

  db.collection("users")
    .doc(uidAtual)
    .collection("checklists")
    .doc(checklistAtual)
    .collection("items")
    .add({
      text: texto,
      priority: prioridade,
      position: Date.now(),
      deleted: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      document.getElementById("novo-item-texto").value = "";
      carregarItens();
    });
}

// Editar
function editarItem(id, texto) {
  db.collection("users")
    .doc(uidAtual)
    .collection("checklists")
    .doc(checklistAtual)
    .collection("items")
    .doc(id)
    .update({ text: texto });
}

// Prioridade
function alterarPrioridade(id, prioridade) {
  db.collection("users")
    .doc(uidAtual)
    .collection("checklists")
    .doc(checklistAtual)
    .collection("items")
    .doc(id)
    .update({ priority: prioridade })
    .then(carregarItens);
}

// Excluir (lixeira lógica)
function excluirItem(id) {
  db.collection("users")
    .doc(uidAtual)
    .collection("checklists")
    .doc(checklistAtual)
    .collection("items")
    .doc(id)
    .update({ deleted: true })
    .then(carregarItens);
    }
