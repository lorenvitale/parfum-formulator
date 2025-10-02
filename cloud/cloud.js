/***** 1) CONFIGURA QUI LE TUE CHIAVI SUPABASE *****/
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

/***** 2) SE USI LOCALSTORAGE NELLA HOME, METTI QUI LA CHIAVE CORRETTA *****/
/* Suggerimento: apri la pagina principale, F12 → Application → Local Storage
   guarda come si chiama la chiave dove salvi la formula attiva. */
const LOCAL_STORAGE_KEY = "parfum-formulator:current"; // <-- cambiala se serve

/***** 3) INIZIALIZZA SUPABASE *****/
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/***** 4) ELEMENTI DOM *****/
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

/***** 5) AUTH *****/
btnSignup.addEventListener("click", async () => {
  authMsg.textContent = "Registrazione…";
  const { error } = await supabase.auth.signUp({
    email: emailEl.value.trim(),
    password: passEl.value.trim(),
  });
  authMsg.textContent = error ? error.message : "Controlla l'email per confermare l'account.";
});

btnLogin.addEventListener("click", async () => {
  authMsg.textContent = "Login…";
  const { error } = await supabase.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passEl.value.trim(),
  });
  authMsg.textContent = error ? error.message : "";
});

btnLogout.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

init();

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  handleSession(session);
  supabase.auth.onAuthStateChange((_event, session) => handleSession(session));
}

function handleSession(session) {
  const logged = !!session?.user;
  authBox.classList.toggle("hidden", logged);
  appBox.classList.toggle("hidden", !logged);
  userNav.classList.toggle("hidden", !logged);
  userEmailSpan.textContent = logged ? session.user.email : "";
  if (logged) loadMyFormulas();
}

/***** 6) SALVATAGGIO E LETTURA *****/
btnSave.addEventListener("click", async () => {
  saveMsg.textContent = "Salvataggio…";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { saveMsg.textContent = "Non sei autenticato."; return; }

  // Tenta parse del JSON scritto nella textarea
  let parsed;
  try { parsed = JSON.parse(jsonEl.value || "{}"); }
  catch { saveMsg.textContent = "JSON non valido."; return; }

  const { error } = await supabase
    .from("formulas")
    .insert({
      user_id: user.id,
      name: (nameEl.value || "Senza nome").trim(),
      data: parsed
    });

  saveMsg.textContent = error ? error.message : "Salvata ✅";
  if (!error) { nameEl.value = ""; jsonEl.value = ""; loadMyFormulas(); }
});

btnImport.addEventListener("click", () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) { saveMsg.textContent = "Nessuna formula trovata nel LocalStorage."; return; }
    jsonEl.value = raw;
    saveMsg.textContent = "Importata dalla pagina principale. Verifica e premi Salva.";
  } catch {
    saveMsg.textContent = "Impossibile leggere dal LocalStorage.";
  }
});

async function loadMyFormulas() {
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

/***** 7) UTILITY *****/
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}
