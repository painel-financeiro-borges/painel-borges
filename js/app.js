// js/app.js

auth.onAuthStateChanged(user => {
  if (!user) return;

  const uid = user.uid;
  console.log("Usuário ativo:", uid);

  criarChecklistInicial(uid);
});

function criarChecklistInicial(uid) {
  const ref = db
    .collection("users")
    .doc(uid)
    .collection("checklists");

  ref.where("system", "==", true).get()
    .then(snapshot => {
      if (!snapshot.empty) return;

      ref.add({
        title: "🧩 Construção do Painel Híbrido",
        system: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(doc => {
        const items = [
          "Criar dashboard.html",
          "Configurar Firebase",
          "Login funcionando",
          "Criar estrutura de pastas",
          "Salvar dados no Firestore",
          "Criar checklist visual",
          "Implementar prioridades",
          "Criar drag & drop",
          "Criar lixeira",
          "Criar busca global"
        ];

        items.forEach((text, index) => {
          ref.doc(doc.id)
            .collection("items")
            .add({
              text,
              priority: "none",
              position: index,
              deleted: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        console.log("Checklist inicial criado");
      });
    });
            }
