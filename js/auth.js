// js/auth.js

const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

loginBtn.addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Preencha email e senha");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      console.log("Login realizado");
    })
    .catch(err => {
      alert("Erro no login: " + err.message);
    });
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

// Observador de sessão
auth.onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = "none";
    dashboard.style.display = "block";
  } else {
    dashboard.style.display = "none";
    loginScreen.style.display = "block";
  }
});
