/* =========================================================================
 * Parfum Formulator – app.js
 * Pulizia + miglioramenti UX/robustezza + mapping note con alias & fuzzy
 * ========================================================================= */

import { NOTES_DATA, OLFACTIVE_FAMILIES, DEFAULT_PYRAMID } from './assets/notes-data.js';
import { MASTER_LIBRARY } from './assets/library-data.js';

/* --------------------------------- DOM ---------------------------------- */

const materialsTable      = document.getElementById('materialsTable');
const materialTemplate    = document.getElementById('materialRowTemplate');
const noteLibrary         = document.getElementById('noteLibrary');

const batchWeightInput    = document.getElementById('batchWeight');
const densityInput        = document.getElementById('density');
const batchVolumeOutput   = document.getElementById('batchVolume');
const batchDropsOutput    = document.getElementById('batchDrops');

const addMaterialBtn      = document.getElementById('addMaterialBtn');
const clearMaterialsBtn   = document.getElementById('clearMaterialsBtn');

const pyramidList         = document.getElementById('pyramidList');
const familyBadge         = document.getElementById('familyBadge');
const scoreValue          = document.getElementById('scoreValue');
const improvementList     = document.getElementById('improvementList');

const saveFormulaBtn      = document.getElementById('saveFormulaBtn');
const exportFormulaBtn    = document.getElementById('exportFormulaBtn');
const exportExcelBtn      = document.getElementById('exportExcelBtn');
const exportPdfBtn        = document.getElementById('exportPdfBtn');
const importBtn           = document.getElementById('importBtn');
const importFile          = document.getElementById('importFile');

const libraryList         = document.getElementById('libraryList');
const newFormulaBtn       = document.getElementById('newFormulaBtn');

const themeToggle         = document.getElementById('themeToggle');
const formulaNameInput    = document.getElementById('formulaName');
const formulaTypeSelect   = document.getElementById('formulaType');

const browseCatalogBtn    = document.getElementById('browseCatalogBtn');
const catalogModal        = document.getElementById('catalogModal');
const catalogCloseBtn     = document.getElementById('catalogCloseBtn');
const catalogCloseBtn2    = document.getElementById('catalogCloseBtn2');
const catalogSearch       = document.getElementById('catalogSearch');
const catalogGroup        = document.getElementById('catalogGroup');
const catalogList         = document.getElementById('catalogList');

/* opzionale: piccola barra visual del concentrato (se la aggiungi in HTML) */
const concentrateBar      = document.getElementById('concentrateBar');
const concentrateLabel    = document.getElementById('concentrateLabel');

/* ------------------------------ COSTANTI -------------------------------- */

const DROPS_PER_ML       = 20;

const STORAGE_KEY        = 'parfum-formulator__formulas';
const THEME_STORAGE_KEY  = 'parfum-formulator__theme';
const DRAFT_KEY          = 'parfum-formulator__draft';
const USER_ALIAS_KEY     = 'parfum-formulator__aliases';

const DEFAULT_LEVELS     = DEFAULT_PYRAMID; // ['Testa','Cuore','Fondo']

// Quota concentrato per tipologia (range % del lotto)
const TYPE_QUOTA = {
  EDC:   { min: 6,  max: 10 },
  EDT:   { min: 8,  max: 15 },
  EDP:   { min: 15, max: 25 },
  EX:    { min: 25, max: 40 } // extrait
};

// Range “sano” della piramide (percentuali del *concentrato* o del totale materie)
const PYRAMID_TARGET = {
  Testa: { min: 20, max: 35 },
  Cuore: { min: 35, max: 50 },
  Fondo: { min: 20, max: 35 }
};

const themeMediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

/* ------------------------------- STATO ---------------------------------- */

let syncing = false;

const state = {
  materials: [],
  formulas: [],
  editingId: null
};

// Undo/Redo a 1 livello (semplice)
let lastSnapshot = null;
let redoSnapshot = null;

/* --------------------------- UTILITY GENERALI --------------------------- */

function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const formatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function formatDecimal(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits
  });
}

function normaliseName(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ');
}

function escapeHtml(value = '') {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSafeFileName(name, extension) {
  const base = name
    ? name.toString().trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
    : '';
  const safeBase = base || 'formula';
  return `${safeBase}.${extension}`;
}

function uid() {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/* ------------------------------ TEMA UI --------------------------------- */

function readStoredTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch { return null; }
}

function storeThemePreference(theme) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
}

function getPreferredTheme() {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (themeMediaQuery) return themeMediaQuery.matches ? 'dark' : 'light';
  return 'light';
}

function applyTheme(theme) {
  const selected = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = selected;
  if (themeToggle) {
    const isDark = selected === 'dark';
    themeToggle.setAttribute('aria-checked', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Attiva modalità chiara' : 'Attiva modalità scura');
    themeToggle.setAttribute('title',      isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura');
  }
}

function initTheme() {
  applyTheme(getPreferredTheme());
  themeToggle?.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    storeThemePreference(nextTheme);
    applyTheme(nextTheme);
  });
  themeMediaQuery?.addEventListener('change', (e) => {
    if (readStoredTheme()) return; // se l’utente ha scelto manualmente, non seguo il sistema
    applyTheme(e.matches ? 'dark' : 'light');
  });
}

/* --------------------------- CATALOGO & ALIAS --------------------------- */

// Carica/salva alias utente (per mappare nomi personalizzati -> canonical)
function loadUserAliases() {
  try { return JSON.parse(localStorage.getItem(USER_ALIAS_KEY) || '[]'); } catch { return []; }
}
function saveUserAlias(alias, canonical) {
  const list = loadUserAliases();
  const item = { alias: normaliseName(alias), canonical: normaliseName(canonical) };
  if (!list.find(x => x.alias === item.alias)) {
    list.push(item);
    localStorage.setItem(USER_ALIAS_KEY, JSON.stringify(list));
  }
}

/**
 * Costruisce indice note + alias (dataset principale + master library)
 * Ritorna:
 * - NOTE_INDEX: Map(normalisedName -> {name, families[], pyramid[]})
 * - NOTE_NAMES: array di nomi canonici (per fuzzy)
 * - ALIAS: Map(normalisedAlias -> normalisedCanonical)
 */
function buildNoteCatalog(notes, master = MASTER_LIBRARY) {
  const index = new Map();
  const aliasIndex = new Map();
  const list = [];

  // 1) NOTES_DATA
  notes.forEach((note) => {
    if (!note || !note.name) return;
    const key = normaliseName(note.name);
    const families = Array.isArray(note.families) ? note.families.slice() : [];
    const pyramid  = Array.isArray(note.pyramid)  ? note.pyramid.slice()  : [];
    if (!index.has(key)) {
      index.set(key, { name: note.name, families, pyramid });
      list.push({ name: note.name, families, pyramid });
    } else {
      // merge eventuali
      const n = index.get(key);
      families.forEach(f => { if (!n.families.includes(f)) n.families.push(f); });
      pyramid.forEach (p => { if (!n.pyramid.includes(p))  n.pyramid.push(p);  });
    }
  });

  // 2) MASTER_LIBRARY (include group/aliases/synonyms/etc.)
  (Array.isArray(master) ? master : []).forEach((item) => {
    const name = item?.name;
    if (!name) return;
    const key = normaliseName(name);
    const families = Array.isArray(item.families) ? item.families.slice() : [];
    const pyramid  = Array.isArray(item.pyramid)  ? item.pyramid.slice()  : [];

    // main entry
    if (!index.has(key)) {
      index.set(key, { name, families, pyramid });
      list.push({ name, families, pyramid });
    } else {
      const n = index.get(key);
      families.forEach(f => { if (!n.families.includes(f)) n.families.push(f); });
      pyramid.forEach (p => { if (!n.pyramid.includes(p))  n.pyramid.push(p);  });
    }

    // aliases (se presenti)
    const aliases = []
      .concat(item.aliases || [])
      .concat(item.synonyms || [])
      .concat(item.commonNames || []);
    aliases.forEach(a => {
      const ak = normaliseName(a);
      if (ak && !aliasIndex.has(ak)) aliasIndex.set(ak, key);
    });
  });

  // 3) Alias utente persistiti
  loadUserAliases().forEach(a => {
    if (a?.alias && a?.canonical) aliasIndex.set(a.alias, a.canonical);
  });

  // Sort per UX (non fondamentale per l’indice)
  list.sort((a, b) => a.name.localeCompare(b.name, 'it'));

  const names = list.map(x => x.name);
  return { index, list, names, aliasIndex };
}

const { index: NOTE_INDEX, list: NOTE_LIBRARY, names: NOTE_NAMES, aliasIndex: ALIAS_INDEX } =
  buildNoteCatalog(NOTES_DATA, MASTER_LIBRARY);

/* -------------------------- FUZZY MATCH DELLE NOTE ---------------------- */

// Punteggio semplice: prefisso > parola intera > inizio parola > includes > distanza
function fuzzyScore(query, candidate) {
  if (!query || !candidate) return -Infinity;
  const q = normaliseName(query);
  const c = normaliseName(candidate);

  if (q === c) return 1000;
  if (c.startsWith(q)) return 900;

  const words = c.split(' ');
  if (words.includes(q)) return 800;
  if (words.some(w => w.startsWith(q))) return 700;

  if (c.includes(q)) return 600;

  // distanza (troncata per performance)
  const dist = levenshtein(q.slice(0, 32), c.slice(0, 32));
  return 500 - dist * 20; // più distante -> punteggio minore
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1]
        ? prev
        : 1 + Math.min(prev, dp[j-1], dp[j]); // replace, insert, delete
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Risolve un nome nota:
 * 1) alias utente/sistema
 * 2) match esatto su NOTE_INDEX
 * 3) fuzzy sulle NOTE_NAMES
 * Ritorna { profile, canonicalKey, confidence, unmapped }
 */
function resolveNoteProfile(name) {
  const raw = (name || '').toString();
  const key = normaliseName(raw);
  if (!key) {
    return { profile: null, canonicalKey: null, confidence: 0, unmapped: true };
  }

  // alias?
  const aliased = ALIAS_INDEX.get(key);
  const canonicalKey = aliased || key;

  // esatto
  if (NOTE_INDEX.has(canonicalKey)) {
    return { profile: NOTE_INDEX.get(canonicalKey), canonicalKey, confidence: 1, unmapped: false };
  }

  // fuzzy
  let best = { name: null, score: -Infinity };
  for (const candidate of NOTE_NAMES) {
    const s = fuzzyScore(raw, candidate);
    if (s > best.score) best = { name: candidate, score: s };
  }

  if (best.score >= 650) {
    const k2 = normaliseName(best.name);
    const prof = NOTE_INDEX.get(k2);
    return { profile: prof, canonicalKey: k2, confidence: 0.8, unmapped: false };
  }

  // fallback “neutro”, non penalizzante
  return {
    profile: { name: raw, families: ['Neutra'], pyramid: ['Cuore'] },
    canonicalKey: key,
    confidence: 0.2,
    unmapped: true
  };
}

/* ----------------------------- GESTIONE RIGHE --------------------------- */

function loadNoteLibrary() {
  if (!noteLibrary) return;
  noteLibrary.innerHTML = '';
  const fragment = document.createDocumentFragment();
  NOTE_LIBRARY.forEach((note) => {
    const option = document.createElement('option');
    option.value = note.name;
    fragment.appendChild(option);
  });
  noteLibrary.appendChild(fragment);
}

function getMaterial(id) {
  return state.materials.find((item) => item.id === id);
}

function getBatchWeight() {
  return parseNumber(batchWeightInput?.value);
}
function getDensity() {
  const density = parseNumber(densityInput?.value);
  return density > 0 ? density : 1;
}

function snapshot() {
  lastSnapshot = {
    materials: JSON.parse(JSON.stringify(state.materials)),
    batchWeight: getBatchWeight(),
    density: getDensity(),
    name: formulaNameInput?.value || '',
    type: formulaTypeSelect?.value || 'EDP'
  };
  redoSnapshot = null; // invalida redo
}

function undoOnce() {
  if (!lastSnapshot) return;
  const now = {
    materials: JSON.parse(JSON.stringify(state.materials)),
    batchWeight: getBatchWeight(),
    density: getDensity(),
    name: formulaNameInput?.value || '',
    type: formulaTypeSelect?.value || 'EDP'
  };
  // swap
  state.materials = lastSnapshot.materials;
  batchWeightInput && (batchWeightInput.value = lastSnapshot.batchWeight);
  densityInput && (densityInput.value = lastSnapshot.density);
  if (formulaNameInput) formulaNameInput.value = lastSnapshot.name;
  if (formulaTypeSelect) formulaTypeSelect.value = lastSnapshot.type;

  materialsTable && (materialsTable.innerHTML = '');
  state.materials.forEach(createMaterialRow);
  updateBatchOutputs();
  updateInsights();

  redoSnapshot = now;
  lastSnapshot = null;
}

function redoOnce() {
  if (!redoSnapshot) return;
  snapshot(); // crea nuova base
  state.materials = redoSnapshot.materials;
  batchWeightInput && (batchWeightInput.value = redoSnapshot.batchWeight);
  densityInput && (densityInput.value = redoSnapshot.density);
  if (formulaNameInput) formulaNameInput.value = redoSnapshot.name;
  if (formulaTypeSelect) formulaTypeSelect.value = redoSnapshot.type;

  materialsTable && (materialsTable.innerHTML = '');
  state.materials.forEach(createMaterialRow);
  updateBatchOutputs();
  updateInsights();
}

function recalcMaterial(material, source, value) {
  const density = getDensity();
  const batchWeight = getBatchWeight();
  const payload = { ...material };
  payload.dilution = clampPercentage(material.dilution ?? 100);

  switch (source) {
    case 'grams':
      payload.grams  = value;
      payload.ml     = density ? value / density : 0;
      payload.drops  = payload.ml * DROPS_PER_ML;
      payload.percent= batchWeight ? (value / batchWeight) * 100 : 0;
      break;
    case 'ml':
      payload.ml     = value;
      payload.grams  = value * density;
      payload.drops  = value * DROPS_PER_ML;
      payload.percent= batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
    case 'drops':
      payload.drops  = value;
      payload.ml     = value / DROPS_PER_ML;
      payload.grams  = payload.ml * density;
      payload.percent= batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
    case 'percent':
      payload.percent= value;
      payload.grams  = (value / 100) * batchWeight;
      payload.ml     = density ? payload.grams / density : 0;
      payload.drops  = payload.ml * DROPS_PER_ML;
      break;
    default: // 'sync'
      payload.grams  = material.grams || 0;
      payload.ml     = density ? payload.grams / density : 0;
      payload.drops  = payload.ml * DROPS_PER_ML;
      payload.percent= batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
  }
  return payload;
}

function updateMaterial(id, payload, { takeSnapshot = false } = {}) {
  const index = state.materials.findIndex((item) => item.id === id);
  if (index === -1) return;
  if (takeSnapshot) snapshot();
  state.materials[index] = { ...state.materials[index], ...payload };
  syncMaterialRow(id);
  updateInsights();
  scheduleAutosave();
}

function duplicateMaterial(id) {
  const m = getMaterial(id);
  if (!m) return;
  snapshot();
  const copy = { ...m, id: uid() };
  state.materials.push(copy);
  createMaterialRow(copy);
  updateInsights();
  scheduleAutosave();
}

function syncMaterialRow(id) {
  const material = state.materials.find((item) => item.id === id);
  const row = materialsTable?.querySelector(`[data-id="${id}"]`);
  if (!material || !row) return;

  syncing = true;
  const noteInput    = row.querySelector('.note-input');
  const gramsInput   = row.querySelector('.grams-input');
  const mlInput      = row.querySelector('.ml-input');
  const dropsInput   = row.querySelector('.drops-input');
  const percentInput = row.querySelector('.percent-input');
  const dilutionInput= row.querySelector('.dilution-input');
  const unmappedBadge= row.querySelector('.unmapped-badge');

  if (document.activeElement !== noteInput) {
    noteInput.value = material.note || '';
  }
  if (document.activeElement !== gramsInput) {
    gramsInput.value = material.grams ? material.grams.toFixed(2) : '';
  }
  if (document.activeElement !== mlInput) {
    mlInput.value = material.ml ? material.ml.toFixed(2) : '';
  }
  if (document.activeElement !== dropsInput) {
    dropsInput.value = material.drops ? Math.round(material.drops) : '';
  }
  if (document.activeElement !== percentInput) {
    percentInput.value = material.percent ? material.percent.toFixed(2) : '';
  }
  if (document.activeElement !== dilutionInput) {
    dilutionInput.value = material.dilution ?? 100;
  }

  // badge unmapped (se nel template c'è un placeholder)
  if (unmappedBadge) {
    unmappedBadge.style.display = material.__unmapped ? 'inline-flex' : 'none';
    unmappedBadge.title = material.__suggestion
      ? `Suggerito: ${material.__suggestion}`
      : 'Nota non riconosciuta';
  }

  syncing = false;
}

function addMaterial(note = '') {
  snapshot();
  const resolved = resolveNoteProfile(note);
  const material = recalcMaterial(
    {
      id: uid(),
      note: resolved.profile?.name || note || '',
      grams: 0, ml: 0, drops: 0, percent: 0, dilution: 100,
      __unmapped: resolved.unmapped,
      __suggestion: resolved.unmapped ? (resolved.profile?.name || '') : ''
    },
    'init'
  );
  state.materials.push(material);
  createMaterialRow(material);
  updateInsights();
  scheduleAutosave();
}

function removeMaterial(id) {
  const index = state.materials.findIndex((item) => item.id === id);
  if (index === -1) return;
  snapshot();
  state.materials.splice(index, 1);
  const row = materialsTable?.querySelector(`[data-id="${id}"]`);
  row?.remove();
  updateInsights();
  scheduleAutosave();
}

function clearMaterials() {
  snapshot();
  state.materials = [];
  if (materialsTable) materialsTable.innerHTML = '';
  updateInsights();
  scheduleAutosave();
}

function createMaterialRow(material) {
  if (!materialTemplate || !materialsTable) return;
  const clone = materialTemplate.content.firstElementChild.cloneNode(true);
  clone.dataset.id = material.id;

  const noteInput     = clone.querySelector('.note-input');
  const gramsInput    = clone.querySelector('.grams-input');
  const mlInput       = clone.querySelector('.ml-input');
  const dropsInput    = clone.querySelector('.drops-input');
  const percentInput  = clone.querySelector('.percent-input');
  const dilutionInput = clone.querySelector('.dilution-input');
  const removeBtn     = clone.querySelector('.remove-btn');
  const duplicateBtn  = clone.querySelector('.duplicate-btn'); // opzionale nel template

  // input NOTE con auto-resolve on blur
  noteInput.addEventListener('blur', () => {
    if (syncing) return;
    const val = noteInput.value || '';
    const res = resolveNoteProfile(val);
    updateMaterial(material.id, {
      note: res.profile?.name || val,
      __unmapped: res.unmapped,
      __suggestion: res.unmapped ? (res.profile?.name || '') : ''
    });
  });

  // numerici con debounce per fluidità
  gramsInput.addEventListener('input', debounce((event) => {
    const grams = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'grams', grams));
  }, 160));

  mlInput.addEventListener('input', debounce((event) => {
    const ml = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'ml', ml));
  }, 160));

  dropsInput.addEventListener('input', debounce((event) => {
    const drops = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'drops', drops));
  }, 160));

  percentInput.addEventListener('input', debounce((event) => {
    const percent = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'percent', percent));
  }, 160));

  dilutionInput.addEventListener('input', debounce((event) => {
    const dilution = clampPercentage(parseNumber(event.target.value));
    updateMaterial(material.id, { dilution });
  }, 160));

  removeBtn?.addEventListener('click', () => removeMaterial(material.id));
  duplicateBtn?.addEventListener('click', () => duplicateMaterial(material.id));

  materialsTable.appendChild(clone);
  syncMaterialRow(material.id);
}

/* -------------------------- BATCH & QUOTE/TARGET ------------------------ */

function updateBatchOutputs() {
  const weight  = getBatchWeight();
  const density = getDensity();
  const volume  = density ? weight / density : 0;
  const drops   = volume * DROPS_PER_ML;

  if (batchVolumeOutput) batchVolumeOutput.textContent = formatter.format(volume);
  if (batchDropsOutput)  batchDropsOutput.textContent  = formatter.format(drops);

  state.materials = state.materials.map((m) => recalcMaterial(m, 'sync'));
  state.materials.forEach((m) => syncMaterialRow(m.id));
  updateInsights();
  scheduleAutosave();
}

function getTypeQuotaBounds() {
  const t = (formulaTypeSelect?.value || 'EDP').toUpperCase();
  return TYPE_QUOTA[t] || TYPE_QUOTA.EDP;
}

/* --------------------------- INSIGHTS & RATING -------------------------- */

function getMaterialProfile(noteName) {
  const resolved = resolveNoteProfile(noteName);
  return { profile: resolved.profile, unmapped: resolved.unmapped, suggestion: resolved.__suggestion };
}

/**
 * Nuovo scoring:
 *  - si calcola la % Testa/Cuore/Fondo sul TOTALE MATERIE PRIME
 *  - punteggio per ogni livello in base alla distanza dal range target
 *  - media livelli → 0..100 → scala 1..10
 *  - le note “unmapped” NON penalizzano la famiglia domin.
 */
function computeInsights() {
  const batchWeight = getBatchWeight();
  const totalWeight = state.materials.reduce((sum, item) => sum + (item.grams || 0), 0);

  const pyramid = new Map(DEFAULT_LEVELS.map((level) => [level, []]));
  const familyWeights = new Map();

  state.materials.forEach((material) => {
    if (!material.note || material.grams <= 0) return;
    const { profile } = getMaterialProfile(material.note);
    const levels = Array.isArray(profile?.pyramid) && profile.pyramid.length ? profile.pyramid : ['Cuore'];

    levels.forEach((level) => {
      if (!pyramid.has(level)) pyramid.set(level, []);
      pyramid.get(level).push(material);
    });

    // famiglie: non consideriamo "Neutra"
    (profile?.families || []).forEach((family) => {
      if (family === 'Neutra') return;
      const current = familyWeights.get(family) || 0;
      familyWeights.set(family, current + material.grams);
    });
  });

  const pyramidData = DEFAULT_LEVELS.map((level) => {
    const materials = pyramid.get(level) || [];
    const weight = materials.reduce((sum, item) => sum + (item.grams || 0), 0);
    const percentage = totalWeight ? (weight / totalWeight) * 100 : 0;

    const list = materials
      .slice()
      .sort((a, b) => (b.grams || 0) - (a.grams || 0))
      .map((item) => {
        const { profile } = getMaterialProfile(item.note);
        const tag = (profile?.families || [])[0] || 'Custom';
        return `${item.note} (${(item.percent || 0).toFixed(1)}% · ${tag})`;
      });

    return { level, weight, percentage, list };
  });

  const sortedFamilies = [...familyWeights.entries()].sort((a, b) => b[1] - a[1]);
  const dominantFamily = sortedFamilies[0]?.[0] ?? null;

  // punteggio livello: 100 se dentro range, penalità lineare fuori (2 punti per punto % fuori)
  function levelScore(level, pct) {
    const range = PYRAMID_TARGET[level] || { min: 0, max: 100 };
    if (pct >= range.min && pct <= range.max) return 100;
    const delta = pct < range.min ? (range.min - pct) : (pct - range.max);
    return Math.max(0, 100 - delta * 2);
  }

  // score medio dei livelli -> 1..10
  const perLevelScores = pyramidData.map(p => levelScore(p.level, p.percentage));
  const balanceScore100 = perLevelScores.length
    ? perLevelScores.reduce((a, b) => a + b, 0) / perLevelScores.length
    : 0;

  const rating10 = totalWeight ? Math.max(1, Math.round((balanceScore100 / 100) * 10)) : 1;

  // quote concentrato
  const concentratePercent = batchWeight ? (totalWeight / batchWeight) * 100 : 0;
  const quota = getTypeQuotaBounds();

  const suggestions = buildSuggestions({
    totalWeight,
    pyramidData,
    dominantFamily,
    sortedFamilies,
    batchWeight,
    concentratePercent,
    quota
  });

  return {
    pyramidData,
    dominantFamily,
    rating10,
    score: Math.round(balanceScore100),
    suggestions,
    totalWeight,
    concentratePercent,
    quota
  };
}

function buildSuggestions({ totalWeight, pyramidData, dominantFamily, sortedFamilies, batchWeight, concentratePercent, quota }) {
  const suggestions = [];
  if (!totalWeight) {
    suggestions.push('Aggiungi materie prime per generare piramide e suggerimenti mirati.');
    return suggestions;
  }

  // piramide vs range
  pyramidData.forEach(({ level, percentage }) => {
    const t = PYRAMID_TARGET[level];
    if (!t) return;
    if (percentage < t.min) {
      suggestions.push(`Aumenta le note di ${level.toLowerCase()} fino almeno a ~${t.min}%.`);
    } else if (percentage > t.max) {
      suggestions.push(`Riduci le note di ${level.toLowerCase()} verso ~${t.max}%.`);
    }
  });

  // famiglia
  if (!dominantFamily) {
    suggestions.push('Seleziona note dal catalogo per ottenere la famiglia olfattiva suggerita.');
  } else {
    suggestions.push(`La famiglia ${dominantFamily} è dominante: mantienila o integra famiglie complementari.`);
  }
  if (sortedFamilies.length < 2) {
    suggestions.push('Integra una seconda famiglia per aumentare la complessità.');
  }

  // quote concentrato per tipologia
  if (quota) {
    if (concentratePercent < quota.min) {
      suggestions.push(`Il concentrato è basso per la tipologia: porta il totale almeno al ${quota.min}%.`);
    } else if (concentratePercent > quota.max) {
      suggestions.push(`Il concentrato supera il massimo consigliato (${quota.max}%): riduci o cambia tipologia.`);
    }
  }

  return [...new Set(suggestions)];
}

function updateInsights() {
  const { pyramidData, dominantFamily, rating10, suggestions, totalWeight, concentratePercent, quota } = computeInsights();

  // Piramide
  if (pyramidList) {
    pyramidList.innerHTML = '';
    pyramidData.forEach(({ level, list, percentage }) => {
      const li = document.createElement('li');
      const title = document.createElement('div');
      title.className = 'pyramid-title';
      title.textContent = `${level} · ${percentage.toFixed(1)}%`;

      const details = document.createElement('div');
      details.className = 'pyramid-notes';
      details.textContent = list.length ? list.join(' • ') : 'Nessuna nota registrata';

      li.appendChild(title);
      li.appendChild(details);
      pyramidList.appendChild(li);
    });
  }

  // Famiglia dominante
  if (familyBadge) familyBadge.textContent = dominantFamily ?? '-';

  // Score/gauge
  if (totalWeight) {
    window.setBalanceScore?.(rating10);
  } else {
    if (scoreValue) scoreValue.textContent = '-';
    window.updateBalanceGauge?.(1);
  }

  // Suggerimenti
  if (improvementList) {
    improvementList.innerHTML = '';
    suggestions.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      improvementList.appendChild(li);
    });
  }

  // Indicatore quota concentrato (se presente in UI)
  if (concentrateBar) {
    const pct = Math.max(0, Math.min(100, concentratePercent || 0));
    concentrateBar.style.setProperty('--pct', pct);
    const ok = quota && pct >= quota.min && pct <= quota.max;
    concentrateBar.classList.toggle('ok', !!ok);
    concentrateBar.classList.toggle('warn', !ok);
  }
  if (concentrateLabel) {
    const q = quota ? ` (target ${quota.min}–${quota.max}%)` : '';
    concentrateLabel.textContent = `${formatDecimal(concentratePercent, 1)}%${q}`;
  }
}

/* ------------------------------ FORMULE --------------------------------- */

function collectFormula() {
  const batchWeight = getBatchWeight();
  const density = getDensity();
  return {
    id: state.editingId ?? `formula-${Date.now()}`,
    name: (formulaNameInput?.value || '').trim() || 'Formula senza titolo',
    type: (formulaTypeSelect?.value || 'EDP'),
    batchWeight,
    density,
    materials: state.materials.map(({ id, __unmapped, __suggestion, ...material }) => material),
    updatedAt: new Date().toISOString()
  };
}

function resetFormula() {
  state.editingId = null;
  if (formulaNameInput) formulaNameInput.value = '';
  if (formulaTypeSelect) formulaTypeSelect.value = 'EDP';
  if (batchWeightInput) batchWeightInput.value = 100;
  if (densityInput) densityInput.value = 0.94;
  clearMaterials();
  addInitialRows();
  updateBatchOutputs();
  formulaNameInput?.focus();
  clearDraft();
}

function saveFormula() {
  if (!state.materials.length) {
    alert('Aggiungi almeno una nota alla formula.');
    return;
  }
  const formula = collectFormula();
  const index = state.formulas.findIndex((item) => item.id === formula.id);
  if (index > -1) {
    state.formulas[index] = formula;
  } else {
    state.formulas.push(formula);
  }
  persistLibrary();
  renderLibrary();
  state.editingId = formula.id;
  // svuoto bozza dopo un salvataggio esplicito
  clearDraft();
}

function persistLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formulas));
}

function loadLibrary() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state.formulas = parsed;
  } catch (error) {
    console.error('Errore nel parsing della libreria', error);
  }
}

function renderLibrary() {
  if (!libraryList) return;
  libraryList.innerHTML = '';
  if (!state.formulas.length) {
    const empty = document.createElement('p');
    empty.className = 'microcopy';
    empty.textContent = 'Nessuna formula salvata finora.';
    libraryList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.formulas
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((formula) => {
      const item = document.createElement('article');
      item.className = 'library-item';

      const header = document.createElement('header');
      const title = document.createElement('h3');
      title.textContent = formula.name;
      const subtitle = document.createElement('span');
      subtitle.className = 'microcopy';
      const date = new Date(formula.updatedAt);
      subtitle.textContent = `${formula.type} · aggiornato il ${date.toLocaleDateString('it-IT')}`;
      header.appendChild(title);
      header.appendChild(subtitle);

      const actions = document.createElement('div');
      actions.className = 'library-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.textContent = 'Carica';
      loadBtn.addEventListener('click', () => loadFormula(formula.id));

      const duplicateBtn = document.createElement('button');
      duplicateBtn.type = 'button';
      duplicateBtn.className = 'ghost-btn';
      duplicateBtn.textContent = 'Duplica';
      duplicateBtn.addEventListener('click', () => duplicateFormula(formula.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ghost-btn';
      deleteBtn.textContent = 'Elimina';
      deleteBtn.addEventListener('click', () => deleteFormula(formula.id));

      actions.append(loadBtn, duplicateBtn, deleteBtn);

      const notesSummary = document.createElement('p');
      notesSummary.className = 'microcopy';
      const materialNames = (formula.materials || [])
        .filter((item) => item.note)
        .map((item) => item.note)
        .slice(0, 6)
        .join(' · ');
      notesSummary.textContent = materialNames || 'Nessuna nota indicata.';

      header.appendChild(actions);
      item.appendChild(header);
      item.appendChild(notesSummary);
      fragment.appendChild(item);
    });

  libraryList.appendChild(fragment);
}

function loadFormula(id) {
  const formula = state.formulas.find((item) => item.id === id);
  if (!formula) return;
  state.editingId = formula.id;
  if (formulaNameInput) formulaNameInput.value = formula.name;
  if (formulaTypeSelect) formulaTypeSelect.value = formula.type;
  if (batchWeightInput) batchWeightInput.value = formula.batchWeight;
  if (densityInput) densityInput.value = formula.density;

  if (materialsTable) materialsTable.innerHTML = '';
  state.materials = (formula.materials || []).map((material) => {
    const res = resolveNoteProfile(material.note);
    return {
      ...recalcMaterial({ ...material, id: uid() }, 'sync'),
      __unmapped: res.unmapped,
      __suggestion: res.unmapped ? (res.profile?.name || '') : ''
    };
  });
  state.materials.forEach((m) => createMaterialRow(m));
  updateBatchOutputs();
}

function duplicateFormula(id) {
  const formula = state.formulas.find((item) => item.id === id);
  if (!formula) return;
  const clone = {
    ...formula,
    id: `formula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${formula.name} (copia)`,
    updatedAt: new Date().toISOString(),
    materials: (formula.materials || []).map((item) => ({ ...item }))
  };
  state.formulas.push(clone);
  persistLibrary();
  renderLibrary();
}

function deleteFormula(id) {
  if (!confirm('Vuoi eliminare definitivamente questa formula?')) return;
  state.formulas = state.formulas.filter((item) => item.id !== id);
  persistLibrary();
  renderLibrary();
}

/* --------------------------- IMPORT/EXPORT ------------------------------- */

function computeMaterialTotals(materials) {
  return (materials || []).reduce(
    (acc, item) => {
      const grams = Number(item.grams) || 0;
      const ml    = Number(item.ml) || 0;
      const drops = Number(item.drops) || 0;
      const percent = Number(item.percent) || 0;
      return {
        grams: acc.grams + grams,
        ml:    acc.ml + ml,
        drops: acc.drops + drops,
        percent: acc.percent + percent
      };
    },
    { grams: 0, ml: 0, drops: 0, percent: 0 }
  );
}

function exportFormula() {
  hydrateStateFromForm();
  if (!state.materials.length) {
    alert('Nessuna formula da esportare.');
    return;
  }
  const formula = collectFormula();
  const blob = new Blob([JSON.stringify(formula, null, 2)], { type: 'application/json' });
  downloadFile(blob, buildSafeFileName(formula.name, 'json'));
}

function exportFormulaExcel() {
  hydrateStateFromForm();
  if (!state.materials.length) {
    alert('Nessuna formula da esportare.');
    return;
  }

  const formula = collectFormula();
  const totals = computeMaterialTotals(formula.materials);
  const generatedAt = new Date().toLocaleString('it-IT');

  const metadataRows = [
    ['Nome formula', formula.name],
    ['Tipologia', formula.type],
    ['Lotto (g)', formatDecimal(formula.batchWeight, 2)],
    ['Densità (g/ml)', formatDecimal(formula.density, 3)],
    ['Note inserite', `${formula.materials.length}`],
    ['Generato il', generatedAt]
  ];

  const metadataTable = metadataRows
    .map(([label, value]) =>
      `<tr><th style="text-align:left;background:#eef1ff;padding:8px 12px;">${escapeHtml(label)}</th><td style="padding:8px 12px;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const materialsHeader =
    '<tr style="background:#f7f7fb;font-weight:600;">' +
    ['Nota', 'Grammi', 'Millilitri', 'Gocce', '%', 'Diluizione (%)']
      .map((heading) => `<th style="padding:8px 12px;border-bottom:1px solid #dcdfee;text-align:left;">${escapeHtml(heading)}</th>`)
      .join('') +
    '</tr>';

  const materialsRows = (formula.materials || []).map((material) => {
      const cells = [
        material.note || '—',
        formatDecimal(material.grams, 2),
        formatDecimal(material.ml, 2),
        formatDecimal(material.drops, 0),
        formatDecimal(material.percent, 2),
        formatDecimal(Number(material.dilution ?? 100), 1)
      ];
      return (
        '<tr>' +
        cells.map((value) => `<td style="padding:6px 12px;border-bottom:1px solid #eef0f7;vertical-align:top;">${escapeHtml(value)}</td>`).join('') +
        '</tr>'
      );
    }).join('');

  const totalsRow =
    '<tr>' +
    [
      'Totale',
      formatDecimal(totals.grams, 2),
      formatDecimal(totals.ml, 2),
      formatDecimal(Math.round(totals.drops), 0),
      formatDecimal(totals.percent, 2),
      '—'
    ]
      .map((value, index) =>
        `<td style="padding:8px 12px;font-weight:${index === 0 ? 600 : 500};background:#f3f4f9;">${escapeHtml(value)}</td>`
      )
      .join('') +
    '</tr>';

  const htmlDocument = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(formula.name || 'formula')}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#111118;">
  <h1 style="font-size:20px;">Parfum Formulator · ${escapeHtml(formula.name)}</h1>
  <table style="border-collapse:collapse;margin-bottom:24px;min-width:320px;">
    ${metadataTable}
  </table>
  <table style="border-collapse:collapse;min-width:480px;">
    ${materialsHeader}
    ${materialsRows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#6b6b7c;">Nessuna materia prima registrata.</td></tr>'}
    ${formula.materials.length ? totalsRow : ''}
  </table>
</body>
</html>`;

  const blob = new Blob([htmlDocument], { type: 'application/vnd.ms-excel' });
  downloadFile(blob, buildSafeFileName(formula.name, 'xls'));
}

function sanitizePdfText(value = '') {
  return value.toString()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function generatePdfBlob(lines) {
  const encoder = new TextEncoder();
  const header = '%PDF-1.3\n';
  const lineHeight = 16;
  const startY = 800;
  const contentCommands = ['BT', '/F1 12 Tf'];
  lines.forEach((line, index) => {
    const y = startY - index * lineHeight;
    contentCommands.push(`1 0 0 1 50 ${y} Tm`);
    contentCommands.push(`(${sanitizePdfText(line)}) Tj`);
  });
  contentCommands.push('ET');
  const contentStream = contentCommands.join('\n');
  const contentBytes = encoder.encode(contentStream);

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  const headerBytes = encoder.encode(header);
  const chunks = [];
  const offsets = [];
  let position = headerBytes.length;

  objects.forEach((object) => {
    const bytes = encoder.encode(object);
    offsets.push(position);
    chunks.push(bytes);
    position += bytes.length;
  });

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  xref += offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
  if (!xref.endsWith('\n')) xref += '\n';

  const startXref = position;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  const xrefBytes = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);

  const totalLength = headerBytes.length +
    chunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    xrefBytes.length + trailerBytes.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  buffer.set(headerBytes, offset); offset += headerBytes.length;
  chunks.forEach((chunk) => { buffer.set(chunk, offset); offset += chunk.length; });
  buffer.set(xrefBytes, offset); offset += xrefBytes.length;
  buffer.set(trailerBytes, offset);

  return new Blob([buffer], { type: 'application/pdf' });
}

function exportFormulaPdf() {
  hydrateStateFromForm();
  if (!state.materials.length) {
    alert('Nessuna formula da esportare.');
    return;
  }

  const formula = collectFormula();
  const totals = computeMaterialTotals(formula.materials);

  const lines = [
    'Parfum Formulator',
    `Formula: ${formula.name}`,
    `Tipologia: ${formula.type}`,
    `Lotto: ${formatDecimal(formula.batchWeight, 2)} g`,
    `Densita: ${formatDecimal(formula.density, 3)} g/ml`,
    ''
  ];

  lines.push('Materie prime:');
  if (formula.materials.length) {
    formula.materials.forEach((material, index) => {
      const note = material.note || `Nota ${index + 1}`;
      const grams = formatDecimal(material.grams, 2);
      const percent = formatDecimal(material.percent, 2);
      const dilution = Number.isFinite(Number(material.dilution))
        ? formatDecimal(Number(material.dilution), 1)
        : '-';
      lines.push(`${index + 1}. ${note} · ${grams} g · ${percent}% · diluizione ${dilution}%`);
    });
  } else {
    lines.push('Nessuna materia prima registrata.');
  }

  lines.push('');
  lines.push(
    `Totale: ${formatDecimal(totals.grams, 2)} g · ${formatDecimal(totals.percent, 2)}% · ${formatDecimal(Math.round(totals.drops), 0)} gocce`
  );
  lines.push(`Generato il: ${new Date().toLocaleString('it-IT')}`);

  const blob = generatePdfBlob(lines);
  downloadFile(blob, buildSafeFileName(formula.name, 'pdf'));
}

/* ------------------------------- IMPORT --------------------------------- */

function validateImportedFormula(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('JSON non valido.');
  if (!Array.isArray(obj.materials)) obj.materials = [];
  obj.name        = String(obj.name || 'Formula importata');
  obj.type        = String(obj.type || 'EDP');
  obj.batchWeight = Number(obj.batchWeight || 100);
  obj.density     = Number(obj.density || 0.94);
  obj.materials = obj.materials.map((m, i) => ({
    note: String(m?.note || `Nota ${i + 1}`),
    grams: Number(m?.grams || 0),
    ml: Number(m?.ml || 0),
    drops: Number(m?.drops || 0),
    percent: Number(m?.percent || 0),
    dilution: Number.isFinite(Number(m?.dilution)) ? Number(m.dilution) : 100
  }));
  return obj;
}

function importFormulaObject(obj) {
  const f = validateImportedFormula(obj);

  if (formulaNameInput)  formulaNameInput.value  = f.name;
  if (formulaTypeSelect) formulaTypeSelect.value = f.type;
  if (batchWeightInput)  batchWeightInput.value  = f.batchWeight;
  if (densityInput)      densityInput.value      = f.density;

  // reset completo
  state.materials = [];
  if (materialsTable) materialsTable.innerHTML = '';

  const batchWeight = getBatchWeight();

  (f.materials || []).forEach((m) => {
    const grams = Number.isFinite(m.grams)
      ? m.grams
      : (Number.isFinite(m.percent) ? (m.percent / 100) * batchWeight : 0);

    const res = resolveNoteProfile(m.note);

    const material = recalcMaterial(
      {
        id: uid(),
        note: res.profile?.name || m.note,
        grams,
        ml: 0, drops: 0,
        percent: Number.isFinite(m.percent) ? m.percent : 0,
        dilution: clampPercentage(m.dilution),
        __unmapped: res.unmapped,
        __suggestion: res.unmapped ? (res.profile?.name || '') : ''
      },
      'sync'
    );

    state.materials.push(material);
    createMaterialRow(material);
  });

  updateBatchOutputs();
  updateInsights();
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(String(e.target.result || ''));
      importFormulaObject(obj);
      if (typeof location !== 'undefined') location.hash = '#/step/2';
    } catch (err) {
      alert('JSON non valido.');
    } finally {
      if (importFile) importFile.value = '';
    }
  };
  reader.onerror = () => {
    alert('Impossibile leggere il file selezionato.');
    if (importFile) importFile.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

/* ----------------------------- AUTOSAVE BOZZA --------------------------- */

let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const draft = collectFormula();
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, 500);
}

function loadDraftIfAny() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || !draft.materials) return false;
    importFormulaObject(draft);
    return true;
  } catch { return false; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

/* ------------------------------ CATALOGO -------------------------------- */

let lastFocused = null;

function openCatalog() {
  if (!catalogModal) return;
  lastFocused = document.activeElement;
  catalogModal.setAttribute('aria-hidden', 'false');
  if (catalogSearch) catalogSearch.value = '';
  if (catalogGroup)  catalogGroup.value  = '';
  renderCatalog();
  setTimeout(() => catalogSearch?.focus(), 50);
}
function closeCatalog() {
  if (!catalogModal) return;
  catalogModal.setAttribute('aria-hidden', 'true');
  lastFocused?.focus?.();
}

function fuzzyFilterAndSort(q, list) {
  if (!q) return list.slice(0, 400);
  const scored = list.map(item => ({ item, s: fuzzyScore(q, item.name) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.map(x => x.item).slice(0, 400);
}

function renderCatalog() {
  if (!catalogList) return;
  const q   = (catalogSearch?.value || '').trim().toLowerCase();
  const grp = (catalogGroup?.value  || '').trim().toLowerCase();

  let rows = (MASTER_LIBRARY || []).map(it => ({
    name: it.name,
    families: it.families || [],
    pyramid: it.pyramid || [],
    group: it.group || ''
  }));

  if (grp) rows = rows.filter(item => (item.group || '').toLowerCase() === grp);
  rows = fuzzyFilterAndSort(q, rows);

  catalogList.innerHTML = '';
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'microcopy';
    p.textContent = 'Nessun risultato.';
    catalogList.appendChild(p);
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach(item => {
    const card = document.createElement('div');
    card.className = 'catalog-item';

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'catalog-item__name';
    title.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'catalog-item__meta';
    const fam = (item.families || []).join(' · ') || '—';
    const pyr = (item.pyramid  || []).join(' · ') || '—';
    meta.textContent = `${item.group || '—'} · Famiglie: ${fam} · Piramide: ${pyr}`;

    info.appendChild(title);
    info.appendChild(meta);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Aggiungi';
    btn.addEventListener('click', () => { addMaterial(item.name); closeCatalog(); });

    card.appendChild(info);
    card.appendChild(btn);
    frag.appendChild(card);
  });
  catalogList.appendChild(frag);
}

/* ------------------------------- EVENTI --------------------------------- */

function hydrateStateFromForm() {
  if (!materialsTable) return;
  state.materials = Array.from(materialsTable.querySelectorAll('.material-row')).map((row) => {
    const id = row.dataset.id || uid();
    const noteVal = row.querySelector('.note-input')?.value || '';
    const res = resolveNoteProfile(noteVal);
    const grams = parseNumber(row.querySelector('.grams-input')?.value);
    const ml    = parseNumber(row.querySelector('.ml-input')?.value);
    const drops = parseNumber(row.querySelector('.drops-input')?.value);
    const percent = parseNumber(row.querySelector('.percent-input')?.value);
    const dilution = clampPercentage(parseNumber(row.querySelector('.dilution-input')?.value || '100'));
    return {
      id,
      note: res.profile?.name || noteVal,
      grams, ml, drops, percent, dilution,
      __unmapped: res.unmapped,
      __suggestion: res.unmapped ? (res.profile?.name || '') : ''
    };
  });
}

function addInitialRows() {
  if (!state.materials.length) addMaterial();
}

function initEvents() {
  addMaterialBtn?.addEventListener('click', () => addMaterial());
  clearMaterialsBtn?.addEventListener('click', clearMaterials);

  batchWeightInput?.addEventListener('input', debounce(updateBatchOutputs, 150));
  densityInput?.addEventListener('input', debounce(updateBatchOutputs, 150));

  saveFormulaBtn?.addEventListener('click', () => {
    hydrateStateFromForm();
    saveFormula();
  });

  exportFormulaBtn?.addEventListener('click', exportFormula);
  exportExcelBtn?.addEventListener('click', exportFormulaExcel);
  exportPdfBtn?.addEventListener('click', exportFormulaPdf);
  newFormulaBtn?.addEventListener('click', resetFormula);

  // Import JSON
  importBtn?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', (e) => handleImportFile(e.target.files?.[0]));

  // Catalogo
  browseCatalogBtn?.addEventListener('click', openCatalog);
  catalogCloseBtn?.addEventListener('click', closeCatalog);
  catalogCloseBtn2?.addEventListener('click', closeCatalog);
  catalogModal?.addEventListener('click', (e) => { if (e.target === catalogModal) closeCatalog(); });
  catalogSearch?.addEventListener('input', debounce(renderCatalog, 120));
  catalogGroup?.addEventListener('change', renderCatalog);

  // Shortcut: Ctrl/Cmd+S salva
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      hydrateStateFromForm();
      saveFormula();
    }
    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault(); undoOnce();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault(); redoOnce();
    }
  });

  // Drag & Drop import (area hero se presente)
  const hero = document.querySelector('.hero');
  if (hero) {
    ['dragenter','dragover'].forEach(ev =>
      hero.addEventListener(ev, e => { e.preventDefault(); hero.classList.add('drop-ready'); })
    );
    ['dragleave','drop'].forEach(ev =>
      hero.addEventListener(ev, e => { e.preventDefault(); hero.classList.remove('drop-ready'); })
    );
    hero.addEventListener('drop', e => {
      const file = e.dataTransfer?.files?.[0];
      if (file && /\.json$/i.test(file.name)) handleImportFile(file);
    });
  }
}

/* ------------------------------- INIT ----------------------------------- */

function init() {
  loadNoteLibrary();
  loadLibrary();
  renderLibrary();

  // prova a ripristinare bozza se presente (prima dei default)
  const restored = loadDraftIfAny();
  if (!restored) {
    addInitialRows();
    updateBatchOutputs();
    updateInsights();
  } else {
    // se draft ripristinato, già ha aggiornato UI
  }
}

/* --------------------------- GAUGE INTEGRAZIONE ------------------------- */
// Sincronizza gauge con #scoreValue se presente
(function () {
  const scoreEl = document.getElementById('scoreValue');
  if (!scoreEl) return;

  function syncGaugeFromText() {
    const raw = (scoreEl.textContent || '').trim().replace(',', '.');
    const n = Math.max(1, Math.min(10, Number(raw)));
    if (!Number.isFinite(n)) return;
    window.updateBalanceGauge?.(n);
  }

  const mo = new MutationObserver(syncGaugeFromText);
  mo.observe(scoreEl, { childList: true, characterData: true, subtree: true });

  syncGaugeFromText();

  window.setBalanceScore = function (value) {
    const n = Math.max(1, Math.min(10, Math.round(Number(value) || 1)));
    scoreEl.textContent = String(n);
    window.updateBalanceGauge?.(n);
  };
})();

/* --------------------------- WIZARD BRIDGE ------------------------------ */
window.__wizardApi = {
  hydrate: hydrateStateFromForm,
  updateBatch: updateBatchOutputs,
  updateInsights,
  getBatchWeight,
  state
};

/* ------------------------------ BOOT ------------------------------------ */
initTheme();
init();
