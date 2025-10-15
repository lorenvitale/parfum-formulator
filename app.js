/* ============================================================================
 * Parfum Formulator — app.js (clean & improved)
 * - Tema chiaro/scuro con preferenza persistente
 * - Catalogo note + Master Library (modal) con ricerca/filtri
 * - Import/Export (JSON, “Excel” HTML, PDF)
 * - Ricalcolo batch + sincronizzazione UI
 * - Heuristics per note non presenti a catalogo (family/pyramid guess)
 * - Drag & Drop JSON in hero
 * - Wizard bridge per router
 * ========================================================================== */

import { NOTES_DATA, OLFACTIVE_FAMILIES, DEFAULT_PYRAMID } from './assets/notes-data.js';
import { MASTER_LIBRARY } from './assets/library-data.js';

/* ======= DOM refs ======= */
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
const newFormulaBtn       = document.getElementById('newFormulaBtn');
const libraryList         = document.getElementById('libraryList');

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

const importBtn           = document.getElementById('importBtn');          // header/hero
const importFile          = document.getElementById('importFile');         // header/hero
const importRecipeBtn     = document.getElementById('importRecipeBtn');    // in scheda materiali
const importRecipeInput   = document.getElementById('importRecipeInput');  // in scheda materiali

const requestNotesCta      = document.getElementById('requestNotesCta');
const requestNotesForm     = document.getElementById('requestNotesForm');
const requestNotesInput    = document.getElementById('requestNotesInput');
const requestNotesSend     = document.getElementById('requestNotesSend');
const requestNotesFeedback = document.getElementById('requestNotesFeedback');


/* ======= Costanti & stato ======= */
const DROPS_PER_ML       = 20;
const STORAGE_KEY        = 'parfum-formulator__formulas';
const THEME_STORAGE_KEY  = 'parfum-formulator__theme';

const { index: NOTE_INDEX, list: NOTE_LIBRARY } = buildNoteCatalog(NOTES_DATA);
const DEFAULT_LEVELS     = DEFAULT_PYRAMID;

const themeMediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

let syncing = false;

const state = {
  materials: [],
  formulas: [],
  editingId: null
};

/* ======= Helpers generali ======= */
const formatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function formatDecimal(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits });
}
function normaliseName(value = '') {
  return value.toString().trim().toLowerCase();
}
function escapeHtml(value = '') {
  return value
    .toString().replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function buildSafeFileName(name, extension) {
  const base = name ? name.toString().trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').toLowerCase() : '';
  const safeBase = base || 'formula';
  return `${safeBase}.${extension}`;
}
function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
function uid() {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ======= Tema ======= */
function readStoredTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
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
    themeToggle.setAttribute('title', isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura');
  }
}
function initTheme() {
  applyTheme(getPreferredTheme());
  themeToggle?.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    storeThemePreference(nextTheme);
    applyTheme(nextTheme);
  });
  themeMediaQuery?.addEventListener('change', (event) => {
    if (readStoredTheme()) return; // se l'utente ha scelto manualmente non sovrascrivo
    applyTheme(event.matches ? 'dark' : 'light');
  });
}

/* ======= Data structures ======= */
function buildNoteCatalog(notes) {
  const index = new Map();
  const list = [];
  notes.forEach((note) => {
    if (!note || !note.name) return;
    const key = normaliseName(note.name);
    const families = Array.isArray(note.families) ? note.families : [];
    const pyramid  = Array.isArray(note.pyramid)  ? note.pyramid  : [];
    if (index.has(key)) {
      const existing = index.get(key);
      families.forEach((f) => { if (!existing.families.includes(f)) existing.families.push(f); });
      pyramid.forEach((p)  => { if (!existing.pyramid.includes(p))  existing.pyramid.push(p);  });
    } else {
      const entry = { name: note.name, families: [...families], pyramid: [...pyramid] };
      index.set(key, entry);
      list.push(entry);
    }
  });
  list.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return { index, list };
}

/* ======= Preferenze batch ======= */
function getBatchWeight() {
  return parseNumber(batchWeightInput.value);
}
function getDensity() {
  const density = parseNumber(densityInput.value);
  return density > 0 ? density : 1;
}

/* ======= Heuristics per note “sconosciute” ======= */
/* Prova a inferire famiglia/piramide da parole chiave e Master Library */
const FAMILY_KEYWORDS = [
  { kw: ['citrus','bergamot','lemon','lime','orange','mandarin','grapefruit','neroli','petitgrain','yuzu'], family: 'Agrumata', pyramid: ['Testa'] },
  { kw: ['lavender','aromatic','rosemary','sage','basil','thyme'], family: 'Aromatica', pyramid: ['Testa','Cuore'] },
  { kw: ['rose','jasmine','ylang','tiare','fleur','violet','iris','lily','tuberose','peony'], family: 'Fiorita', pyramid: ['Cuore'] },
  { kw: ['cedar','vetiver','sandal','patchouli','oud','amber','musk','leather','labdanum'], family: 'Legnosa/Ambrata', pyramid: ['Fondo'] },
  { kw: ['vanilla','tonka','praline','caramel','coumarin'], family: 'Gourmand', pyramid: ['Fondo'] },
  { kw: ['marine','ozone','aqua','sea'], family: 'Marina', pyramid: ['Testa','Cuore'] },
  { kw: ['green','galbanum','leaf','herbal','bamboo'], family: 'Verde', pyramid: ['Testa','Cuore'] },
  { kw: ['spice','pepper','cardamom','cinnamon','clove','nutmeg','ginger'], family: 'Speziata', pyramid: ['Testa','Cuore'] },
];

function guessProfileFromText(name) {
  const n = normaliseName(name);
  for (const rule of FAMILY_KEYWORDS) {
    if (rule.kw.some(k => n.includes(k))) {
      return { families: [rule.family], pyramid: [...rule.pyramid] };
    }
  }
  return null;
}

function getMaterialProfile(noteName) {
  if (!noteName) return null;
  const normalised = normaliseName(noteName);

  // 1) Catalogo noto
  const direct = NOTE_INDEX.get(normalised);
  if (direct) return direct;

  // 2) Master library match
  const libHit = MASTER_LIBRARY.find(it => normaliseName(it.name) === normalised);
  if (libHit) {
    return {
      name: libHit.name,
      families: Array.isArray(libHit.families) && libHit.families.length ? libHit.families : ['Custom'],
      pyramid:  Array.isArray(libHit.pyramid)  && libHit.pyramid.length  ? libHit.pyramid  : ['Cuore']
    };
  }
  /* === UNMAPPED (note non in libreria) === */
function isUnmappedNote(note) {
  if (!note) return false;
  const prof = getMaterialProfile(note);
  return !prof || !prof.families || !prof.families.length || prof.families[0] === 'Custom';
}

function applyUnmappedStyle(rowEl, note) {
  const unmapped = isUnmappedNote(note);
  rowEl.classList.toggle('is-unmapped', unmapped);
  const input = rowEl.querySelector('.note-input');
  if (input) {
    input.setAttribute('aria-invalid', unmapped ? 'true' : 'false');
    input.title = unmapped ? 'Nota non presente a catalogo (verrà stimata)' : '';
  }
}


  // 3) Fuzzy: contiene / alias semplici
  const containsHit = MASTER_LIBRARY.find(it => normaliseName(it.name).includes(normalised) || normaliseName(noteName).includes(normaliseName(it.name)));
  if (containsHit) {
    return {
      name: containsHit.name,
      families: containsHit.families?.length ? containsHit.families : ['Custom'],
      pyramid:  containsHit.pyramid?.length  ? containsHit.pyramid  : ['Cuore']
    };
  }

  // 4) Heuristic fallback
  const heur = guessProfileFromText(noteName);
  if (heur) return { name: noteName, ...heur };

  // 5) Default totale
  return { name: noteName, families: ['Custom'], pyramid: ['Cuore'] };
}
/* === UNMAPPED (note non in libreria) === */
function isUnmappedNote(note) {
  if (!note) return false;
  const prof = getMaterialProfile(note);
  // Considero "unmapped" quando il profilo non esiste o è marcato Custom
  return !prof || !prof.families || !prof.families.length || prof.families[0] === 'Custom';
}

function applyUnmappedStyle(rowEl, note) {
  const unmapped = isUnmappedNote(note);
  rowEl.classList.toggle('is-unmapped', unmapped);
  const input = rowEl.querySelector('.note-input');
  if (input) {
    input.setAttribute('aria-invalid', unmapped ? 'true' : 'false');
    input.title = unmapped ? 'Nota non presente a catalogo (verrà stimata)' : '';
  }
}

/* ======= Material calc ======= */
function recalcMaterial(material, source, value) {
  const density     = getDensity();
  const batchWeight = getBatchWeight();
  const payload     = { ...material };
  payload.dilution  = clampPercentage(material.dilution ?? 100);

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
    default:
      payload.grams  = material.grams;
      payload.ml     = density ? payload.grams / density : 0;
      payload.drops  = payload.ml * DROPS_PER_ML;
      payload.percent= batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
  }
  return payload;
}

/* ======= UI righe materiali ======= */
function getMaterial(id) {
  return state.materials.find((item) => item.id === id);
}

function createMaterialRow(material) {
  const clone = materialTemplate.content.firstElementChild.cloneNode(true);
  clone.dataset.id = material.id;

  const noteInput     = clone.querySelector('.note-input');
  const gramsInput    = clone.querySelector('.grams-input');
  const mlInput       = clone.querySelector('.ml-input');
  const dropsInput    = clone.querySelector('.drops-input');
  const percentInput  = clone.querySelector('.percent-input');
  const dilutionInput = clone.querySelector('.dilution-input');
  const removeBtn     = clone.querySelector('.remove-btn');

  applyUnmappedStyle(clone, material.note);

  noteInput.addEventListener('input', (e) => {
    if (syncing) return;
    updateMaterial(material.id, { note: e.target.value });
    applyUnmappedStyle(clone, event.target.value);
  });
  gramsInput.addEventListener('input', (e) => {
    if (syncing) return;
    updateMaterial(material.id, recalcMaterial(getMaterial(material.id) ?? material, 'grams', parseNumber(e.target.value)));
  });
  mlInput.addEventListener('input', (e) => {
    if (syncing) return;
    updateMaterial(material.id, recalcMaterial(getMaterial(material.id) ?? material, 'ml', parseNumber(e.target.value)));
  });
  dropsInput.addEventListener('input', (e) => {
    if (syncing) return;
    updateMaterial(material.id, recalcMaterial(getMaterial(material.id) ?? material, 'drops', parseNumber(e.target.value)));
  });
  percentInput.addEventListener('input', (e) => {
    if (syncing) return;
    updateMaterial(material.id, recalcMaterial(getMaterial(material.id) ?? material, 'percent', parseNumber(e.target.value)));
  });
  dilutionInput.addEventListener('input', (e) => {
    if (syncing) return;
    updateMaterial(material.id, { dilution: clampPercentage(parseNumber(e.target.value)) });
  });
  removeBtn.addEventListener('click', () => removeMaterial(material.id));

  materialsTable.appendChild(clone);
  syncMaterialRow(material.id);
}

function syncMaterialRow(id) {
  const material = state.materials.find((item) => item.id === id);
  const row      = materialsTable.querySelector(`[data-id="${id}"]`);
  if (!material || !row) return;

  syncing = true;
  const noteInput     = row.querySelector('.note-input');
  const gramsInput    = row.querySelector('.grams-input');
  const mlInput       = row.querySelector('.ml-input');
  const dropsInput    = row.querySelector('.drops-input');
  const percentInput  = row.querySelector('.percent-input');
  const dilutionInput = row.querySelector('.dilution-input');

  if (document.activeElement !== noteInput)     noteInput.value     = material.note || '';
  if (document.activeElement !== gramsInput)    gramsInput.value    = material.grams ? material.grams.toFixed(2)   : '';
  if (document.activeElement !== mlInput)       mlInput.value       = material.ml    ? material.ml.toFixed(2)      : '';
  if (document.activeElement !== dropsInput)    dropsInput.value    = material.drops ? Math.round(material.drops)  : '';
  if (document.activeElement !== percentInput)  percentInput.value  = material.percent ? material.percent.toFixed(2): '';
  if (document.activeElement !== dilutionInput) dilutionInput.value = material.dilution ?? 100;

  applyUnmappedStyle(row, material.note);
  syncing = false;
}

function addMaterial(note = '') {
  const material = recalcMaterial({
    id: uid(),
    note,
    grams: 0,
    ml: 0,
    drops: 0,
    percent: 0,
    dilution: 100
  }, 'init');

  state.materials.push(material);
  createMaterialRow(material);
  updateInsights();
}

function removeMaterial(id) {
  const index = state.materials.findIndex((item) => item.id === id);
  if (index === -1) return;
  state.materials.splice(index, 1);
  materialsTable.querySelector(`[data-id="${id}"]`)?.remove();
  updateInsights();
}

function clearMaterials() {
  state.materials = [];
  materialsTable.innerHTML = '';
  updateInsights();
}

/* ======= Batch outputs ======= */
function updateBatchOutputs() {
  const weight = getBatchWeight();
  const density= getDensity();
  const volume = density ? weight / density : 0;
  const drops  = volume * DROPS_PER_ML;

  batchVolumeOutput.textContent = formatter.format(volume);
  batchDropsOutput.textContent  = formatter.format(drops);

  state.materials = state.materials.map((m) => recalcMaterial(m, 'sync'));
  state.materials.forEach((m) => syncMaterialRow(m.id));
  updateInsights();
}

/* ======= Insights (piramide, family, punteggio) ======= */
function computeInsights() {
  const batchWeight = getBatchWeight();
  const totalWeight = state.materials.reduce((sum, item) => sum + (item.grams || 0), 0);

  const pyramid       = new Map(DEFAULT_LEVELS.map((level) => [level, []]));
  const familyWeights = new Map();

  state.materials.forEach((material) => {
    if (!material.note || material.grams <= 0) return;

    const profile = getMaterialProfile(material.note);
    const levels  = profile?.pyramid?.length ? profile.pyramid : ['Cuore'];
    const fams    = profile?.families?.length ? profile.families : ['Custom'];

    levels.forEach((level) => {
      if (!pyramid.has(level)) pyramid.set(level, []);
      pyramid.get(level).push(material);
    });

    fams.forEach((family) => {
      const current = familyWeights.get(family) || 0;
      familyWeights.set(family, current + material.grams);
    });
  });

  const pyramidData = DEFAULT_LEVELS.map((level) => {
    const materials  = pyramid.get(level) || [];
    const weight     = materials.reduce((sum, item) => sum + (item.grams || 0), 0);
    const percentage = totalWeight ? (weight / totalWeight) * 100 : 0;
    const list = materials
      .slice()
      .sort((a, b) => b.grams - a.grams)
      .map((item) => {
        const prof = getMaterialProfile(item.note);
        const tag  = prof?.families?.[0] || 'Custom';
        return `${item.note} (${item.percent.toFixed(1)}% · ${tag})`;
      });
    return { level, weight, percentage, list };
  });

  const sortedFamilies = [...familyWeights.entries()].sort((a, b) => b[1] - a[1]);
  const dominantFamily = sortedFamilies[0]?.[0] ?? null;

  // punteggio bilanciamento (meno penalizzante per "Custom")
  const values = pyramidData.map((pd) => (totalWeight ? pd.weight / totalWeight : 0));
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  let balanceScore = totalWeight ? Math.max(0, 100 - spread * 100) : 0;

  // riduci penalità se molte note non erano in catalogo ma mappate con heuristic
  const unknownCount = state.materials.filter(m => {
    const prof = NOTE_INDEX.get(normaliseName(m.note));
    return !prof;
  }).length;
  if (unknownCount >= 3) {
    balanceScore = Math.min(100, balanceScore + 8); // micro boost anti-penalità
  }

  const rating = totalWeight ? (balanceScore / 20).toFixed(1) : '-';

  const suggestions = buildSuggestions({
    totalWeight,
    pyramidData,
    dominantFamily,
    sortedFamilies,
    batchWeight
  });

  return {
    pyramidData,
    dominantFamily,
    rating,
    score: Math.round(balanceScore),
    suggestions,
    totalWeight,
    concentratePercent: batchWeight ? (totalWeight / batchWeight) * 100 : 0
  };
}

function buildSuggestions({ totalWeight, pyramidData, dominantFamily, sortedFamilies, batchWeight }) {
  const suggestions = [];
  if (!totalWeight) {
    suggestions.push('Aggiungi materie prime per generare una piramide e suggerimenti mirati.');
    return suggestions;
  }

  pyramidData.forEach(({ level, percentage }) => {
    if (percentage < 15) suggestions.push(`Valuta di rafforzare la sezione di ${level.toLowerCase()} oltre il 15%.`);
  });

  if (!dominantFamily) {
    suggestions.push('Seleziona note dal catalogo per ottenere la famiglia olfattiva suggerita.');
  } else {
    suggestions.push(`La famiglia ${dominantFamily} è dominante: mantienila oppure integra famiglie complementari.`);
  }

  if (sortedFamilies.length < 2) suggestions.push('Integra una seconda famiglia per ampliare la complessità.');

  const baseLevel = pyramidData.find((i) => i.level === 'Fondo');
  if (baseLevel && baseLevel.percentage < 25) suggestions.push('Aumenta le note di fondo per una maggiore persistenza sulla pelle.');

  const topLevel = pyramidData.find((i) => i.level === 'Testa');
  if (topLevel && topLevel.percentage > 40) suggestions.push('Riduci leggermente le note di testa per evitare un inizio troppo volatile.');

  const concentratePercent = batchWeight ? (totalWeight / batchWeight) * 100 : 0;
  if (concentratePercent < 10)      suggestions.push('Il concentrato totale è basso: valuta di aumentare le materie prime o ridurre il solvente.');
  else if (concentratePercent > 30) suggestions.push('Il concentrato supera il 30%: verifica la compatibilità con la tipologia scelta.');

  return [...new Set(suggestions)];
}

function updateInsights() {
  const { pyramidData, dominantFamily, rating, score, suggestions, totalWeight } = computeInsights();

  pyramidList.innerHTML = '';
  pyramidData.forEach(({ level, list, percentage }) => {
    const li     = document.createElement('li');
    const title  = document.createElement('div');
    title.className = 'pyramid-title';
    title.textContent = `${level} · ${percentage.toFixed(1)}%`;
    const details = document.createElement('div');
    details.className = 'pyramid-notes';
    details.textContent = list.length ? list.join(' • ') : 'Nessuna nota registrata';
    li.appendChild(title);
    li.appendChild(details);
    pyramidList.appendChild(li);
  });

  familyBadge.textContent = dominantFamily ?? '-';

  if (totalWeight) {
    const value10 = Math.round((rating / 5) * 10); // scala 1..10
    window.setBalanceScore?.(value10);
  } else {
    scoreValue.textContent = '-';
    window.updateBalanceGauge?.(1);
  }

  improvementList.innerHTML = '';
  suggestions.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    improvementList.appendChild(li);
  });
}

/* ======= Libreria formule ======= */
function collectFormula() {
  const batchWeight = getBatchWeight();
  const density     = getDensity();
  return {
    id: state.editingId ?? `formula-${Date.now()}`,
    name: (formulaNameInput.value || '').trim() || 'Formula senza titolo',
    type: formulaTypeSelect.value,
    batchWeight,
    density,
    materials: state.materials.map(({ id, ...m }) => m),
    updatedAt: new Date().toISOString()
  };
}

function resetFormula() {
  state.editingId = null;
  formulaNameInput.value = '';
  formulaTypeSelect.value = 'EDP';
  batchWeightInput.value = 100;
  densityInput.value = 0.94;
  clearMaterials();
  addInitialRows();
  updateBatchOutputs();
  formulaNameInput.focus();
}

function saveFormula() {
  if (!state.materials.length) {
    alert('Aggiungi almeno una nota alla formula.');
    return;
  }
  const formula = collectFormula();
  const index   = state.formulas.findIndex((f) => f.id === formula.id);
  if (index > -1) state.formulas[index] = formula;
  else            state.formulas.push(formula);
  persistLibrary();
  renderLibrary();
  state.editingId = formula.id;
}

function persistLibrary() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formulas)); } catch {}
}
function loadLibrary() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state.formulas = parsed;
  } catch (e) { console.error('Errore nel parsing della libreria', e); }
}

function renderLibrary() {
  libraryList.innerHTML = '';
  if (!state.formulas.length) {
    const p = document.createElement('p');
    p.className = 'microcopy';
    p.textContent = 'Nessuna formula salvata finora.';
    libraryList.appendChild(p);
    return;
  }
  const frag = document.createDocumentFragment();
  state.formulas
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((formula) => {
      const item  = document.createElement('article');
      item.className = 'library-item';

      const header = document.createElement('header');
      const title  = document.createElement('h3');
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
      loadBtn.type = 'button'; loadBtn.textContent = 'Carica';
      loadBtn.addEventListener('click', () => loadFormula(formula.id));

      const duplicateBtn = document.createElement('button');
      duplicateBtn.type = 'button'; duplicateBtn.className = 'ghost-btn'; duplicateBtn.textContent = 'Duplica';
      duplicateBtn.addEventListener('click', () => duplicateFormula(formula.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button'; deleteBtn.className = 'ghost-btn'; deleteBtn.textContent = 'Elimina';
      deleteBtn.addEventListener('click', () => deleteFormula(formula.id));

      actions.append(loadBtn, duplicateBtn, deleteBtn);

      const notesSummary = document.createElement('p');
      notesSummary.className = 'microcopy';
      const materialNames = formula.materials.filter((m) => m.note).map((m) => m.note).slice(0, 6).join(' · ');
      notesSummary.textContent = materialNames || 'Nessuna nota indicata.';

      header.appendChild(actions);
      item.appendChild(header);
      item.appendChild(notesSummary);

      frag.appendChild(item);
    });
  libraryList.appendChild(frag);
}

function loadFormula(id) {
  const formula = state.formulas.find((f) => f.id === id);
  if (!formula) return;
  state.editingId = formula.id;
  formulaNameInput.value = formula.name;
  formulaTypeSelect.value= formula.type;
  batchWeightInput.value = formula.batchWeight;
  densityInput.value     = formula.density;

  materialsTable.innerHTML = '';
  state.materials = formula.materials.map((m) => ({ ...m, id: uid() }));
  state.materials.forEach(createMaterialRow);
  updateBatchOutputs();
}

function duplicateFormula(id) {
  const formula = state.formulas.find((f) => f.id === id);
  if (!formula) return;
  const clone = {
    ...formula,
    id: `formula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${formula.name} (copia)`,
    updatedAt: new Date().toISOString(),
    materials: formula.materials.map((m) => ({ ...m }))
  };
  state.formulas.push(clone);
  persistLibrary();
  renderLibrary();
}

function deleteFormula(id) {
  if (!confirm('Vuoi eliminare definitivamente questa formula?')) return;
  state.formulas = state.formulas.filter((f) => f.id !== id);
  persistLibrary();
  renderLibrary();
}

/* ======= Export ======= */
function exportFormula() {
  hydrateStateFromForm();
  if (!state.materials.length) return alert('Nessuna formula da esportare.');
  const formula = collectFormula();
  const blob = new Blob([JSON.stringify(formula, null, 2)], { type: 'application/json' });
  downloadFile(blob, buildSafeFileName(formula.name, 'json'));
}

function computeMaterialTotals(materials) {
  return materials.reduce((acc, item) => {
    const grams   = Number(item.grams)   || 0;
    const ml      = Number(item.ml)      || 0;
    const drops   = Number(item.drops)   || 0;
    const percent = Number(item.percent) || 0;
    return {
      grams: acc.grams + grams,
      ml: acc.ml + ml,
      drops: acc.drops + drops,
      percent: acc.percent + percent
    };
  }, { grams: 0, ml: 0, drops: 0, percent: 0 });
}

function exportFormulaExcel() {
  hydrateStateFromForm();
  if (!state.materials.length) return alert('Nessuna formula da esportare.');
  const formula = collectFormula();
  const totals  = computeMaterialTotals(formula.materials);
  const generatedAt = new Date().toLocaleString('it-IT');

  const metadataRows = [
    ['Nome formula', formula.name],
    ['Tipologia',    formula.type],
    ['Lotto (g)',    formatDecimal(formula.batchWeight, 2)],
    ['Densità (g/ml)', formatDecimal(formula.density, 3)],
    ['Note inserite', `${formula.materials.length}`],
    ['Generato il',  generatedAt]
  ];
  const metadataTable = metadataRows.map(([label, value]) =>
    `<tr><th style="text-align:left;background:#eef1ff;padding:8px 12px;">${escapeHtml(label)}</th><td style="padding:8px 12px;">${escapeHtml(value)}</td></tr>`
  ).join('');

  const materialsHeader =
    '<tr style="background:#f7f7fb;font-weight:600;">' +
    ['Nota','Grammi','Millilitri','Gocce','%','Diluizione (%)']
      .map(h => `<th style="padding:8px 12px;border-bottom:1px solid #dcdfee;text-align:left;">${escapeHtml(h)}</th>`).join('') +
    '</tr>';

  const materialsRows = formula.materials.map((m) => {
    const cells = [
      m.note || '—',
      formatDecimal(m.grams, 2),
      formatDecimal(m.ml, 2),
      formatDecimal(m.drops, 0),
      formatDecimal(m.percent, 2),
      formatDecimal(Number(m.dilution ?? 100), 1)
    ];
    return '<tr>' + cells.map(val =>
      `<td style="padding:6px 12px;border-bottom:1px solid #eef0f7;vertical-align:top;">${escapeHtml(val)}</td>`
    ).join('') + '</tr>';
  }).join('');

  const totalsRow =
    '<tr>' + [
      'Totale',
      formatDecimal(totals.grams, 2),
      formatDecimal(totals.ml, 2),
      formatDecimal(Math.round(totals.drops), 0),
      formatDecimal(totals.percent, 2),
      '—'
    ].map((v, i) =>
      `<td style="padding:8px 12px;font-weight:${i === 0 ? 600 : 500};background:#f3f4f9;">${escapeHtml(v)}</td>`
    ).join('') + '</tr>';

  const htmlDocument = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8" /><title>${escapeHtml(formula.name || 'formula')}</title>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head>
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
</body></html>`;

  const blob = new Blob([htmlDocument], { type: 'application/vnd.ms-excel' });
  downloadFile(blob, buildSafeFileName(formula.name, 'xls'));
}

function sanitizePdfText(value = '') {
  return value.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function generatePdfBlob(lines) {
  const encoder = new TextEncoder();
  const header  = '%PDF-1.3\n';

  const lineHeight = 16;
  const startY     = 800;
  const contentCommands = ['BT', '/F1 12 Tf'];
  lines.forEach((line, index) => {
    const y = startY - index * lineHeight;
    contentCommands.push(`1 0 0 1 50 ${y} Tm`);
    contentCommands.push(`(${sanitizePdfText(line)}) Tj`);
  });
  contentCommands.push('ET');

  const contentStream = contentCommands.join('\n');
  const contentBytes  = encoder.encode(contentStream);

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  const headerBytes = encoder.encode(header);
  const chunks  = [];
  const offsets = [];
  let position  = headerBytes.length;

  objects.forEach((object) => {
    const bytes = encoder.encode(object);
    offsets.push(position);
    chunks.push(bytes);
    position += bytes.length;
  });

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  xref += offsets.map((off) => `${off.toString().padStart(10, '0')} 00000 n \n`).join('');
  if (!xref.endsWith('\n')) xref += '\n';

  const startXref = position;
  const trailer   = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  const xrefBytes    = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);

  const totalLength = headerBytes.length + chunks.reduce((s, c) => s + c.length, 0) + xrefBytes.length + trailerBytes.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  buffer.set(headerBytes, offset); offset += headerBytes.length;
  chunks.forEach((c) => { buffer.set(c, offset); offset += c.length; });
  buffer.set(xrefBytes, offset);   offset += xrefBytes.length;
  buffer.set(trailerBytes, offset);

  return new Blob([buffer], { type: 'application/pdf' });
}

function exportFormulaPdf() {
  hydrateStateFromForm();
  if (!state.materials.length) return alert('Nessuna formula da esportare.');
  const formula = collectFormula();
  const totals  = computeMaterialTotals(formula.materials);

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
    formula.materials.forEach((m, i) => {
      const note = m.note || `Nota ${i + 1}`;
      const grams= formatDecimal(m.grams, 2);
      const perc = formatDecimal(m.percent, 2);
      const dil  = Number.isFinite(Number(m.dilution)) ? formatDecimal(Number(m.dilution), 1) : '-';
      lines.push(`${i + 1}. ${note} · ${grams} g · ${perc}% · diluizione ${dil}%`);
    });
  } else {
    lines.push('Nessuna materia prima registrata.');
  }

  lines.push('');
  lines.push(`Totale: ${formatDecimal(totals.grams, 2)} g · ${formatDecimal(totals.percent, 2)}% · ${formatDecimal(Math.round(totals.drops), 0)} gocce`);
  lines.push(`Generato il: ${new Date().toLocaleString('it-IT')}`);

  const blob = generatePdfBlob(lines);
  downloadFile(blob, buildSafeFileName(formula.name, 'pdf'));
}

/* ======= Import JSON ======= */
function importFormulaObject(obj) {
  if (!obj || typeof obj !== 'object') return alert('File non valido.');

  if (typeof obj.name === 'string')              formulaNameInput.value   = obj.name;
  if (typeof obj.type === 'string')              formulaTypeSelect.value  = obj.type;
  if (Number.isFinite(Number(obj.batchWeight)))  batchWeightInput.value   = Number(obj.batchWeight);
  if (Number.isFinite(Number(obj.density)))      densityInput.value       = Number(obj.density);

  state.materials = [];
  materialsTable.innerHTML = '';

  const batchWeight = getBatchWeight();
  const rows = Array.isArray(obj.materials) ? obj.materials : [];

  rows.forEach((m, idx) => {
    const note      = (m?.note || `Nota ${idx + 1}`).toString();
    const gramsIn   = Number(m?.grams);
    const percentIn = Number(m?.percent);
    const dilIn     = Number.isFinite(Number(m?.dilution)) ? Number(m?.dilution) : 100;

    const grams = Number.isFinite(gramsIn) ? gramsIn : (Number.isFinite(percentIn) ? (percentIn / 100) * batchWeight : 0);

    const material = recalcMaterial({
      id: uid(),
      note,
      grams,
      ml: 0,
      drops: 0,
      percent: Number.isFinite(percentIn) ? percentIn : 0,
      dilution: clampPercentage(dilIn)
    }, 'sync');

    state.materials.push(material);
    createMaterialRow(material);
  });

  updateBatchOutputs();
  updateInsights();

  // porta l’utente allo step delle materie prime (se usi router hash)
  if (typeof location !== 'undefined') location.hash = '#/step/2';
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(String(e.target.result || ''));
      importFormulaObject(obj);
    } catch {
      alert('JSON non valido.');
    }
    if (importFile) importFile.value = '';
    if (importRecipeInput) importRecipeInput.value = '';
  };
  reader.onerror = () => {
    alert('Impossibile leggere il file selezionato.');
    if (importFile) importFile.value = '';
    if (importRecipeInput) importRecipeInput.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

/* ======= Catalogo (modal) ======= */
function openCatalog() {
  catalogModal?.setAttribute('aria-hidden', 'false');
  if (catalogSearch) catalogSearch.value = '';
  if (catalogGroup)  catalogGroup.value  = '';
  renderCatalog();
  setTimeout(() => catalogSearch?.focus(), 50);
}
function closeCatalog() {
  catalogModal?.setAttribute('aria-hidden', 'true');
}
function renderCatalog() {
  if (!catalogList) return;
  const q   = (catalogSearch?.value || '').trim().toLowerCase();
  const grp = (catalogGroup?.value  || '').trim().toLowerCase();

  const rows = MASTER_LIBRARY.filter(item => {
    const nameHit = item.name.toLowerCase().includes(q);
    const famHit  = (item.families || []).some(f => f.toLowerCase().includes(q));
    const hitText = !q || nameHit || famHit;
    const hitGroup= !grp || (item.group || '').toLowerCase() === grp;
    return hitText && hitGroup;
  });

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

    const info  = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'catalog-item__name';
    title.textContent = item.name;

    const meta  = document.createElement('div');
    meta.className = 'catalog-item__meta';
    const fam = (item.families || []).join(' · ') || '—';
    const pyr = (item.pyramid || []).join(' · ')  || '—';
    meta.textContent = `${item.group || '—'} · Famiglie: ${fam} · Piramide: ${pyr}`;

    info.appendChild(title);
    info.appendChild(meta);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Aggiungi';
    btn.addEventListener('click', () => {
      addMaterial(item.name);
      closeCatalog();
    });

    card.appendChild(info);
    card.appendChild(btn);
    frag.appendChild(card);
  });
  catalogList.appendChild(frag);
}

/* ======= Hydrate dallo stato UI ======= */
function hydrateStateFromForm() {
  state.materials = Array.from(materialsTable.querySelectorAll('.material-row')).map((row) => {
    const id = row.dataset.id || uid();
    return {
      id,
      note:   row.querySelector('.note-input')?.value || '',
      grams:  parseNumber(row.querySelector('.grams-input')?.value),
      ml:     parseNumber(row.querySelector('.ml-input')?.value),
      drops:  parseNumber(row.querySelector('.drops-input')?.value),
      percent:parseNumber(row.querySelector('.percent-input')?.value),
      dilution: clampPercentage(parseNumber(row.querySelector('.dilution-input')?.value || '100'))
    };
  });
}

/* ======= Init / Eventi ======= */
function addInitialRows() {
  if (!state.materials.length) addMaterial();
}

function initEvents() {
  // Material table
  addMaterialBtn?.addEventListener('click', () => addMaterial());
  clearMaterialsBtn?.addEventListener('click', clearMaterials);

  // Batch inputs
  batchWeightInput?.addEventListener('input', updateBatchOutputs);
  densityInput?.addEventListener('input', updateBatchOutputs);

  // Save / Export
  saveFormulaBtn?.addEventListener('click', () => { hydrateStateFromForm(); saveFormula(); });
  exportFormulaBtn?.addEventListener('click', exportFormula);
  exportExcelBtn?.addEventListener('click', exportFormulaExcel);
  exportPdfBtn?.addEventListener('click', exportFormulaPdf);

  // New formula
  newFormulaBtn?.addEventListener('click', resetFormula);

  // Catalogo
  browseCatalogBtn?.addEventListener('click', openCatalog);
  catalogCloseBtn?.addEventListener('click', closeCatalog);
  catalogCloseBtn2?.addEventListener('click', closeCatalog);
  catalogModal?.addEventListener('click', (e) => { if (e.target === catalogModal) closeCatalog(); });
  catalogSearch?.addEventListener('input', renderCatalog);
  catalogGroup?.addEventListener('change', renderCatalog);

  // Import (header/hero)
  importBtn?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', (e) => {
    handleImportFile(e.target.files?.[0]);
    e.target.value = '';

    // === CTA mancano note ===
requestNotesCta?.addEventListener('click', () => {
  const isHidden = requestNotesForm?.hasAttribute('hidden');
  if (isHidden) {
    requestNotesForm?.removeAttribute('hidden');
    requestNotesInput?.focus();
  } else {
    requestNotesForm?.setAttribute('hidden', '');
  }
});

requestNotesSend?.addEventListener('click', () => {
  const text = (requestNotesInput?.value || '').trim();
  if (!text) {
    requestNotesFeedback.textContent = 'Scrivi almeno una nota.';
    return;
  }

  // 1) salvo localmente una coda (ti torna utile per inviarla più avanti)
  try {
    const key = 'parfum-formulator__missingNotes';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push({ text, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(prev));
  } catch {}

  // 2) apro un'email precompilata (se vuoi cambiare indirizzo, fallo qui)
  const mailto = `mailto:info@tua-mail.it?subject=${encodeURIComponent('Richiesta nuove note')}&body=${encodeURIComponent(text)}`;
  window.location.href = mailto;

  // 3) feedback UI
  requestNotesFeedback.textContent = 'Grazie! Aprirà il tuo client email con il testo precompilato.';
  requestNotesInput.value = '';
});

  });

  // Import (scheda materiali)
  importRecipeBtn?.addEventListener('click', () => importRecipeInput?.click());
  importRecipeInput?.addEventListener('change', (e) => {
    handleImportFile(e.target.files?.[0]);
    e.target.value = '';
  });

  // Drag & drop sulla hero
  const hero = document.querySelector('.hero');
  if (hero) {
    ['dragenter','dragover'].forEach(ev =>
      hero.addEventListener(ev, (e) => { e.preventDefault(); hero.classList.add('drop-ready'); })
    );
    ['dragleave','drop'].forEach(ev =>
      hero.addEventListener(ev, (e) => { e.preventDefault(); hero.classList.remove('drop-ready'); })
    );
    hero.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file && /\.json$/i.test(file.name)) handleImportFile(file);
    });
  }
}

function init() {
  loadNoteLibrary();
  loadLibrary();
  renderLibrary();
  addInitialRows();
  initEvents();
  updateBatchOutputs();
  updateInsights();
}

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

/* ======= Bootstrap ======= */
initTheme();
init();

/* ======= Gauge bridge ======= */
(function () {
  const scoreEl = document.getElementById('scoreValue');
  if (!scoreEl) return;

  function syncGaugeFromText() {
    const raw = (scoreEl.textContent || '').trim().replace(',', '.');
    const n   = Math.max(1, Math.min(10, Number(raw)));
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

/* ======= Wizard bridge (per router in index.html) ======= */
window.__wizardApi = {
  hydrate: hydrateStateFromForm,
  updateBatch: updateBatchOutputs,
  updateInsights,
  getBatchWeight,
  state
};
