/***** 1) COSTANTI PROGETTO *****/
const SUPABASE_URL = "https://xbduxfvclbcdezegvpwl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZHV4ZnZjbGJjZGV6ZWd2cHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODI5MzEsImV4cCI6MjA3NDk1ODkzMX0.l7d4dqzeoUx4isDRfG2riWDSkP6n2mtaD2kEHtyIudU";

/***** 2) (Opz.) chiave LocalStorage per import *****/
const LOCAL_STORAGE_KEY = "parfum-formulator:current";

/***** 3) Client Supabase *****/
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/***** 4) URL di ritorno *****/
const params = new URLSearchParams(location.search);
const RETURN_URL_DEFAULT = "https://lorenvitale.github.io/parfum-formulator/";
const RETURN_URL = decodeURIComponent(params.get("return") || RETURN_URL_DEFAULT);
const goHome = () => { window.location.href = RETURN_URL; };

/***** 5) DOM refs *****/
const authBox = document.getElementById("auth-box");
const appBox  = document.getElementById("app");
const authMsg = document.getElementById("auth-msg");
const saveMsg = document.getElementById("save-msg");

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

const btnLogin   = document.getElementById("btn-login");
const btnSignup  = document.getElementById("btn-signup");
const logoutBtn  = document.getElementById("logoutBtn");

const userNav = document.getElementById("user-nav");
const userEmailSpan = document.getElementById("user-email");

const nameEl  = document.getElementById("formula-name");
const jsonEl  = document.getElementById("formula-json");
const listEl  = document.getElementById("list");
const btnSave = document.getElementById("btn-save");
const btnImport = document.getElementById("btn-import");

/***** 6) Occhietto password *****/
togglePassword?.addEventListener("click", () => {
  const type = passEl.getAttribute("type") === "password" ? "text" : "password";
  passEl.setAttribute("type", type);
  togglePassword.textContent = type === "password" ? "👁️" : "🙈";
});

/***** 7) Auth handlers *****/
btnSignup?.addEventListener("click", async () => {
  authMsg.textContent = "Registrazione…";
  try {
    const { error } = await supabase.auth.signUp(
      { email: emailEl.value.trim(), password: passEl.value.trim() },
      { emailRedirectTo: RETURN_URL } // dopo conferma email torna alla pagina d’origine
    );
    authMsg.textContent = error ? error.message : "Controlla l'email per confermare l'account.";
  } catch (e) {
    authMsg.textContent = e?.message || "Errore di rete";
  }
});

btnLogin?.addEventListener("click", async () => {
  authMsg.textContent = "Login…";
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passEl.value.trim(),
    });
    if (error) { authMsg.textContent = error.message; return; }
    goHome();
  } catch (e) {
    authMsg.textContent = e?.message || "Errore di rete";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  goHome();
});

/***** 8) Init + session watcher *****/
init();
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  handleSession(session);
  supabase.auth.onAuthStateChange((_e, session) => handleSession(session));
}

function handleSession(session) {
  const logged = !!session?.user;
  if (logged) {
    // Se apri auth.html già loggato, torna subito alla pagina di partenza
    goHome();
    // Se preferisci restare su auth.html per usare l'area privata:
    // renderLoggedUI(session); loadMyFormulas();
  } else {
    renderLoggedOutUI();
  }
}

function renderLoggedOutUI() {
  if (authBox) authBox.style.display = "";
  if (appBox)  appBox.style.display  = "none";
  if (userNav) userNav.style.display = "none";
}

function renderLoggedUI(session) {
  if (authBox) authBox.style.display = "none";
  if (appBox)  appBox.style.display  = "";
  if (userNav) userNav.style.display = "flex";
  if (session?.user?.email) userEmailSpan.textContent = session.user.email;
}

/***** 9) Salvataggio/lettura formule (opzionale) *****/
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
    li.innerHTML = `
      <div><strong>${escapeHtml(row.name)}</strong></div>
      <div class="meta">${new Date(row.created_at).toLocaleString()}</div>
    `;
    listEl.appendChild(li);
  });
}

/***** 10) Utility *****/
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}
