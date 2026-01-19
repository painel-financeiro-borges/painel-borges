// js/auth.js

const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginToggleBtn = document.getElementById("loginToggleBtn");

loginBtn.addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Preencha email e senha");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

// Alternância correta de estado
auth.onAuthStateChanged(user => {
  if (user) {
    loginScreen.style.display = "none";
    dashboard.style.display = "block";
    logoutBtn.style.display = "inline-block";
    loginToggleBtn.style.display = "none";
  } else {
    dashboard.style.display = "none";
    loginScreen.style.display = "flex";
    logoutBtn.style.display = "none";
    loginToggleBtn.style.display = "inline-block";
  }
});

// Botão "Entrar" visível quando deslogado
loginToggleBtn.addEventListener("click", () => {
  loginScreen.style.display = "flex";
  dashboard.style.display = "none";
});    dashboard.style.display = "none";
    loginScreen.style.display = "block";
  }
});
