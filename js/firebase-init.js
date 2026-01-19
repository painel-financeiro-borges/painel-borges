// js/firebase-init.js

const firebaseConfig = {
  apiKey: "AIzaSyBnOexg7KChfV2OsKBCDCuMCRT2xcAwKx8",
  authDomain: "painel-financeiro-borges.firebaseapp.com",
  projectId: "painel-financeiro-borges",
  storageBucket: "painel-financeiro-borges.appspot.com",
  messagingSenderId: "354997627208",
  appId: "1:354997627208:web:90604d0a7dcd45b6e4eb7d"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Serviços globais
const auth = firebase.auth();
const db = firebase.firestore();
