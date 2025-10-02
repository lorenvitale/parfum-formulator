const SUPABASE_URL = "https://xbduxfvclbcdezegvpwl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZHV4ZnZjbGJjZGV6ZWd2cHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODI5MzEsImV4cCI6MjA3NDk1ODkzMX0.l7d4dqzeoUx4isDRfG2riWDSkP6n2mtaD2kEHtyIudU";

const LOCAL_STORAGE_KEY = "parfum-formulator:current"; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(location.search);
const RETURN_URL_DEFAULT = "https://lorenvitale.github.io/parfum-formulator/";
const RETURN_URL = decodeURIComponent(params.get("return") || RETURN_URL_DEFAULT);
const goHome = () => { window.location.href = RETURN_URL; };

const authBox = document.getElementById("auth-box");
const appBox  = document.getElementById("app");
const authMsg = document.getElementById("auth-msg");
const saveMsg = document.getElementById("save-msg");

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const btnLogin= document.getElementById("btn-login");
const btnSignup=document.getElementById("btn-signup");
const btnLogout=document.getElementById("btn-logout");
const userNav = document.getElementById("user-nav");
const userEmailSpan = document.getElementById("user-email");

const nameEl  = document.getElementById("formula-name");
const jsonEl  = document.getElementById("formula-json");
const listEl  = document.getElementById("list");
const btnSave = document.getElementById("btn-save");
const btnImport = document.getElementById("btn-import");

// Registrazione
btnSignup?.addEventListener("click", async () => {
  authMsg.textContent = "Registrazione…";
  const { error } = await supabase.auth.signUp(
    { email: emailEl.value.trim(), password: passEl.value.trim() },
    { emailRedirectTo: RETURN_URL }
  );
  authMsg.textContent = error ? error.message : "Controlla l'email per confermare l'account.";
});

// Login
btnLogin?.addEventListener("click", async () => {
  authMsg.textContent = "Login…";
  const { error } = await supabase.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passEl.value.trim(),
  });
  if (!error) goHome(); else authMsg.textContent = error.message;
});

// Logout
btnLogout?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  goHome();
});

// Inizializza sessione
init();
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  handleSession(session);
  supabase.auth.onAuthStateChange((_e, session) => handleSession(session));
}

function handleSession(session) {
  const logged = !!session?.user;
  if (logged) {
    goHome();
  } else {
    authBox && (authBox.style.display = "");
    appBox && (appBox.style.display = "none");
    userNav && (userNav.style.display = "none");
  }
}

// Gestione formule se vuoi tenerle in auth.html
btnSave?.addEventListener("click", async () => {
  saveMsg.textContent = "Salvataggio…";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { saveMsg.textContent = "Non sei autenticato."; return; }
  let parsed;
  try { parsed = JSON.parse(jsonEl.value || "{}"); }
  catch { saveMsg.textContent = "JSON non valido."; return; }
  const { error } = await supabase
    .from("formulas")
    .insert({ user_id: user.id, name: (nameEl.value || "Senza nome").trim(), data: parsed });
  saveMsg.textContent = error ? error.message : "Salvata ✅";
  if (!error) { nameEl.value = ""; jsonEl.value = ""; loadMyFormulas(); }
});

btnImport?.addEventListener("click", () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) { saveMsg.textContent = "Nessuna formula trovata."; return; }
    jsonEl.value = raw;
    saveMsg.textContent = "Importata. Premi Salva.";
  } catch {
    saveMsg.textContent = "Errore importazione.";
  }
});

async function loadMyFormulas() {
  if (!listEl) return;
  listEl.innerHTML = "Carico…";
  const { data, error } = await supabase
    .from("formulas")
    .select("id,name,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { listEl.textContent = error.message; return; }
  listEl.innerHTML = "";
  data.forEach(row => {
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${escapeHtml(row.name)}</strong></div>
                    <div class="meta">${new Date(row.created_at).toLocaleString()}</div>`;
    listEl.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}
