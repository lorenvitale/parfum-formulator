// app.js
// -------------------------------------------------------------
// Parfum Formulator – core logic
// pulizia, fix import JSON, ID univoci, listener corretti,
// controllo concentrazione in base al tipo formula, catalogo, export
// -------------------------------------------------------------

import { NOTES_DATA, OLFACTIVE_FAMILIES, DEFAULT_PYRAMID } from './assets/notes-data.js';
import { MASTER_LIBRARY } from './assets/library-data.js';

// ====== DOM refs ======
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

const libraryList         = document.getElementById('libraryList');
const newFormulaBtn       = document.getElementById('newFormulaBtn');

const themeToggle         = document.getElementById('themeToggle');
const formulaNameInput    = document.getElementById('formulaName');
const formulaTypeSelect   = document.getElementById('formulaType');

// Catalogo (modal)
const browseCatalogBtn    = document.getElementById('browseCatalogBtn');
const catalogModal        = document.getElementById('catalogModal');
const catalogCloseBtn     = document.getElementById('catalogCloseBtn');
const catalogCloseBtn2    = document.getElementById('catalogCloseBtn2');
const catalogSearch       = document.getElementById('catalogSearch');
const catalogGroup        = document.getElementById('catalogGroup');
const catalogList         = document.getElementById('catalogList');

// Import JSON (header/hero)
const importBtn           = document.getElementById('importBtn');
const importFile          = document.getElementById('importFile');

// Import JSON (azione all’inizio – se usi un secondo bottone)
const importRecipeBtn     = document.getElementById('importRecipeBtn');
const importRecipeInput   = document.getElementById('importRecipeInput');

// Progress concentrazione (opzionali – se non presenti, no-op)
const concentrateProgress = document.getElementById('concentrateProgress');
const concentrateHelp     = document.getElementById('concentrateHelp');

// ====== Costanti ======
const DROPS_PER_ML       = 20;
const STORAGE_KEY        = 'parfum-formulator__formulas';
const THEME_STORAGE_KEY  = 'parfum-formulator__theme';
const { index: NOTE_INDEX, list: NOTE_LIBRARY } = buildNoteCatalog(NOTES_DATA);
const DEFAULT_LEVELS     = DEFAULT_PYRAMID;

const themeMediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

// Limiti concentrazione indicativi per tipologia (puoi ajustarli)
const TYPE_LIMITS = {
  EDT: 15,   // %
  EDP: 20,   // %
  PARFUM: 30, // %
  EDC: 8,    // %
  EDCM: 5,   // colonia molto leggera
  // default fallback:
  _DEFAULT: 30
};

// ====== Stato ======
let syncing = false;
const state = {
  materials: [],
  formulas: [],
  editingId: null
};

// ====== Utils base ======
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
    .toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSafeFileName(name, extension) {
  const base = name
    ? name.toString().trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').toLowerCase()
    : '';
  return `${base || 'formula'}.${extension}`;
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
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

// ====== Tema ======
function readStoredTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
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
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      storeThemePreference(next);
      applyTheme(next);
    });
  }
  if (themeMediaQuery) {
    themeMediaQuery.addEventListener('change', (ev) => {
      if (readStoredTheme()) return; // se c'è preferenza salvata, non seguo sistema
      applyTheme(ev.matches ? 'dark' : 'light');
    });
  }
}

// ====== Dataset note ======
function buildNoteCatalog(notes) {
  const index = new Map();
  const list = [];
  notes.forEach((note) => {
    if (!note || !note.name) return;
    const key = normaliseName(note.name);
    const families = Array.isArray(note.families) ? note.families : [];
    const pyramid = Array.isArray(note.pyramid) ? note.pyramid : [];
    if (index.has(key)) {
      const existing = index.get(key);
      families.forEach((f) => { if (!existing.families.includes(f)) existing.families.push(f); });
      pyramid.forEach((l) => { if (!existing.pyramid.includes(l)) existing.pyramid.push(l); });
    } else {
      const entry = { name: note.name, families: [...families], pyramid: [...pyramid] };
      index.set(key, entry);
      list.push(entry);
    }
  });
  list.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return { index, list };
}

function getMaterialProfile(noteName) {
  const normalised = normaliseName(noteName);
  return NOTE_INDEX.get(normalised) || null;
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

// ====== Batch/densità ======
function getBatchWeight() {
  return parseNumber(batchWeightInput?.value);
}
function getDensity() {
  const d = parseNumber(densityInput?.value);
  return d > 0 ? d : 1;
}

// ====== Material rows ======
function recalcMaterial(material, source, value) {
  const density = getDensity();
  const batchWeight = getBatchWeight();
  const m = { ...material };
  m.dilution = clampPercentage(material.dilution ?? 100);

  switch (source) {
    case 'grams':
      m.grams = value;
      m.ml = density ? value / density : 0;
      m.drops = m.ml * DROPS_PER_ML;
      m.percent = batchWeight ? (value / batchWeight) * 100 : 0;
      break;
    case 'ml':
      m.ml = value;
      m.grams = value * density;
      m.drops = value * DROPS_PER_ML;
      m.percent = batchWeight ? (m.grams / batchWeight) * 100 : 0;
      break;
    case 'drops':
      m.drops = value;
      m.ml = value / DROPS_PER_ML;
      m.grams = m.ml * density;
      m.percent = batchWeight ? (m.grams / batchWeight) * 100 : 0;
      break;
    case 'percent':
      m.percent = value;
      m.grams = (value / 100) * batchWeight;
      m.ml = density ? m.grams / density : 0;
      m.drops = m.ml * DROPS_PER_ML;
      break;
    default:
      // sync ricalcolo generico
      m.grams = Number(m.grams) || 0;
      m.ml = density ? m.grams / density : 0;
      m.drops = m.ml * DROPS_PER_ML;
      m.percent = batchWeight ? (m.grams / batchWeight) * 100 : 0;
  }
  return m;
}

function getMaterial(id) {
  return state.materials.find((it) => it.id === id);
}

function updateMaterial(id, payload) {
  const idx = state.materials.findIndex((it) => it.id === id);
  if (idx === -1) return;
  state.materials[idx] = { ...state.materials[idx], ...payload };
  syncMaterialRow(id);
  updateBatchOutputs();   // mantiene tutto coerente
  updateInsights();
}

function syncMaterialRow(id) {
  const material = state.materials.find((it) => it.id === id);
  const row = materialsTable?.querySelector(`[data-id="${id}"]`);
  if (!material || !row) return;

  syncing = true;
  const noteInput    = row.querySelector('.note-input');
  const gramsInput   = row.querySelector('.grams-input');
  const mlInput      = row.querySelector('.ml-input');
  const dropsInput   = row.querySelector('.drops-input');
  const percentInput = row.querySelector('.percent-input');
  const dilutionInput= row.querySelector('.dilution-input');

  if (document.activeElement !== noteInput)    noteInput.value    = material.note || '';
  if (document.activeElement !== gramsInput)   gramsInput.value   = material.grams ? material.grams.toFixed(2) : '';
  if (document.activeElement !== mlInput)      mlInput.value      = material.ml ? material.ml.toFixed(2) : '';
  if (document.activeElement !== dropsInput)   dropsInput.value   = material.drops ? Math.round(material.drops) : '';
  if (document.activeElement !== percentInput) percentInput.value = material.percent ? material.percent.toFixed(2) : '';
  if (document.activeElement !== dilutionInput)dilutionInput.value= material.dilution ?? 100;
  syncing = false;
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

  noteInput.addEventListener('input', (e) => { if (!syncing) updateMaterial(material.id, { note: e.target.value }); });
  gramsInput.addEventListener('input', (e) => { if (!syncing) updateMaterial(material.id, recalcMaterial(getMaterial(material.id), 'grams', parseNumber(e.target.value))); });
  mlInput.addEventListener('input', (e) => { if (!syncing) updateMaterial(material.id, recalcMaterial(getMaterial(material.id), 'ml', parseNumber(e.target.value))); });
  dropsInput.addEventListener('input', (e) => { if (!syncing) updateMaterial(material.id, recalcMaterial(getMaterial(material.id), 'drops', parseNumber(e.target.value))); });
  percentInput.addEventListener('input', (e) => { if (!syncing) updateMaterial(material.id, recalcMaterial(getMaterial(material.id), 'percent', parseNumber(e.target.value))); });
  dilutionInput.addEventListener('input', (e) => { if (!syncing) updateMaterial(material.id, { dilution: clampPercentage(parseNumber(e.target.value)) }); });

  removeBtn.addEventListener('click', () => removeMaterial(material.id));

  materialsTable.appendChild(clone);
  syncMaterialRow(material.id);
}

function addMaterial(note = '') {
  const material = recalcMaterial({
    id: uid(),
    note,
    grams: 0, ml: 0, drops: 0, percent: 0, dilution: 100
  }, 'sync');

  state.materials.push(material);
  createMaterialRow(material);
  updateInsights();
}

function removeMaterial(id) {
  const idx = state.materials.findIndex((it) => it.id === id);
  if (idx === -1) return;
  state.materials.splice(idx, 1);
  const row = materialsTable?.querySelector(`[data-id="${id}"]`);
  if (row) row.remove();
  updateBatchOutputs();
  updateInsights();
}

function clearMaterials() {
  state.materials = [];
  if (materialsTable) materialsTable.innerHTML = '';
  updateBatchOutputs();
  updateInsights();
}

function hydrateStateFromForm() {
  state.materials = Array.from(materialsTable?.querySelectorAll('.material-row') || []).map((row) => {
    const id = row.dataset.id || uid();
    return {
      id,
      note: row.querySelector('.note-input').value,
      grams: parseNumber(row.querySelector('.grams-input').value),
      ml: parseNumber(row.querySelector('.ml-input').value),
      drops: parseNumber(row.querySelector('.drops-input').value),
      percent: parseNumber(row.querySelector('.percent-input').value),
      dilution: clampPercentage(parseNumber(row.querySelector('.dilution-input').value || '100'))
    };
  });
}

// ====== Batch outputs & concentrazione ======
function updateBatchOutputs() {
  const weight = getBatchWeight();
  const density = getDensity();
  const volume = density ? weight / density : 0;
  const drops  = volume * DROPS_PER_ML;

  if (batchVolumeOutput) batchVolumeOutput.textContent = formatter.format(volume);
  if (batchDropsOutput)  batchDropsOutput.textContent  = formatter.format(drops);

  // ricalcolo per tutte le righe
  state.materials = state.materials.map((m) => recalcMaterial(m, 'sync'));
  state.materials.forEach((m) => syncMaterialRow(m.id));

  // aggiorna barra concentrazione se disponibile
  updateConcentrateUI();
}

// Calcola concentrazione e aggiorna UI (se presente)
function getTypeLimit() {
  const t = (formulaTypeSelect?.value || '').toUpperCase();
  return TYPE_LIMITS[t] ?? TYPE_LIMITS._DEFAULT;
}

function computeConcentratePercent() {
  const totalWeight = state.materials.reduce((sum, it) => sum + (Number(it.grams) || 0), 0);
  const batchWeight = getBatchWeight();
  return batchWeight ? (totalWeight / batchWeight) * 100 : 0;
}

function updateConcentrateUI() {
  const pct  = computeConcentratePercent();
  const max  = getTypeLimit();

  if (concentrateProgress) {
    const clamped = Math.max(0, Math.min(100, pct));
    concentrateProgress.value = clamped;
    concentrateProgress.max   = max;
  }
  if (concentrateHelp) {
    const msg = pct > max
      ? `Attenzione: il concentrato ${pct.toFixed(1)}% supera il limite per ${formulaTypeSelect.value} (${max}%). Riduci materie prime o aumenta solvente.`
      : `Concentrato: ${pct.toFixed(1)}% (limite ${max}% per ${formulaTypeSelect.value}).`;
    concentrateHelp.textContent = msg;
  }
}

// ====== Insights & suggerimenti ======
function computeInsights() {
  const batchWeight = getBatchWeight();
  const totalWeight = state.materials.reduce((sum, it) => sum + it.grams, 0);

  const pyramid = new Map(DEFAULT_LEVELS.map((lvl) => [lvl, []]));
  const familyWeights = new Map();

  state.materials.forEach((m) => {
    if (!m.note || m.grams <= 0) return;
    const prof = getMaterialProfile(m.note);
    if (prof) {
      prof.pyramid.forEach((lvl) => {
        if (!pyramid.has(lvl)) pyramid.set(lvl, []);
        pyramid.get(lvl).push(m);
      });
      prof.families.forEach((f) => {
        const cur = familyWeights.get(f) || 0;
        familyWeights.set(f, cur + m.grams);
      });
    } else {
      pyramid.get('Cuore')?.push(m); // fallback
    }
  });

  const pyramidData = DEFAULT_LEVELS.map((lvl) => {
    const arr = pyramid.get(lvl) || [];
    const weight = arr.reduce((s, it) => s + it.grams, 0);
    const percentage = totalWeight ? (weight / totalWeight) * 100 : 0;
    const list = arr.slice().sort((a, b) => b.grams - a.grams).map((it) => {
      const np = getMaterialProfile(it.note);
      const tag = np ? (np.families?.[0] || '—') : 'Custom';
      return `${it.note} (${it.percent.toFixed(1)}% · ${tag})`;
    });
    return { level: lvl, weight, percentage, list };
  });

  const sortedFamilies = [...familyWeights.entries()].sort((a, b) => b[1] - a[1]);
  const dominantFamily = sortedFamilies[0]?.[0] ?? null;

  const values = pyramidData.map((pd) => (totalWeight ? pd.weight / totalWeight : 0));
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const balanceScore = totalWeight ? Math.max(0, 100 - spread * 100) : 0;
  const rating = totalWeight ? (balanceScore / 20).toFixed(1) : '-';

  const suggestions = buildSuggestions({
    totalWeight, pyramidData, dominantFamily, sortedFamilies, batchWeight
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
  const out = [];
  if (!totalWeight) {
    out.push('Aggiungi materie prime per generare una piramide e suggerimenti mirati.');
    return out;
  }
  pyramidData.forEach(({ level, percentage }) => {
    if (percentage < 15) out.push(`Valuta di rafforzare la sezione di ${level.toLowerCase()} oltre il 15%.`);
  });

  if (!dominantFamily) out.push('Seleziona note dal catalogo per ottenere la famiglia olfattiva suggerita.');
  else out.push(`La famiglia ${dominantFamily} è dominante: mantienila oppure integra famiglie complementari.`);

  if (sortedFamilies.length < 2) out.push('Integra una seconda famiglia per ampliare la complessità.');

  const base = pyramidData.find((it) => it.level === 'Fondo');
  if (base && base.percentage < 25) out.push('Aumenta le note di fondo per una maggiore persistenza sulla pelle.');

  const top = pyramidData.find((it) => it.level === 'Testa');
  if (top && top.percentage > 40) out.push('Riduci leggermente le note di testa per evitare un inizio troppo volatile.');

  const concentratePercent = batchWeight ? (totalWeight / batchWeight) * 100 : 0;
  const max = getTypeLimit();
  if (concentratePercent < 5) out.push('Il concentrato è molto basso: aumenta le materie prime o riduci il solvente.');
  if (concentratePercent > max) out.push(`Il concentrato (${concentratePercent.toFixed(1)}%) supera il limite per ${formulaTypeSelect.value} (${max}%).`);

  return [...new Set(out)];
}

function updateInsights() {
  const { pyramidData, dominantFamily, rating, totalWeight, suggestions } = computeInsights();

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

  if (familyBadge) familyBadge.textContent = dominantFamily ?? '-';

  if (totalWeight) {
    // rating su 5 -> gauge su 10
    const value10 = Math.round((Number(rating) / 5) * 10);
    window.setBalanceScore?.(value10);
  } else {
    if (scoreValue) scoreValue.textContent = '-';
    window.updateBalanceGauge?.(1);
  }

  if (improvementList) {
    improvementList.innerHTML = '';
    suggestions.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      improvementList.appendChild(li);
    });
  }

  // progress concentrazione
  updateConcentrateUI();
}

// ====== Formula CRUD + Export ======
function addInitialRows() {
  if (!state.materials.length) addMaterial();
}

function collectFormula() {
  const batchWeight = getBatchWeight();
  const density = getDensity();
  return {
    id: state.editingId ?? `formula-${Date.now()}`,
    name: (formulaNameInput?.value || '').trim() || 'Formula senza titolo',
    type: formulaTypeSelect?.value || 'EDP',
    batchWeight, density,
    materials: state.materials.map(({ id, ...m }) => m),
    updatedAt: new Date().toISOString()
  };
}

function resetFormula() {
  state.editingId = null;
  if (formulaNameInput)  formulaNameInput.value = '';
  if (formulaTypeSelect) formulaTypeSelect.value = 'EDP';
  if (batchWeightInput)  batchWeightInput.value = 100;
  if (densityInput)      densityInput.value = 0.94;
  clearMaterials();
  addInitialRows();
  updateBatchOutputs();
  formulaNameInput?.focus();
}

function saveFormula() {
  if (!state.materials.length) { alert('Aggiungi almeno una nota alla formula.'); return; }
  const f = collectFormula();
  const idx = state.formulas.findIndex((it) => it.id === f.id);
  if (idx > -1) state.formulas[idx] = f; else state.formulas.push(f);
  persistLibrary();
  renderLibrary();
  state.editingId = f.id;
}

function persistLibrary() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formulas)); } catch {}
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state.formulas = parsed;
  } catch (err) {
    console.error('Errore nel parsing della libreria', err);
  }
}

function renderLibrary() {
  if (!libraryList) return;
  libraryList.innerHTML = '';
  if (!state.formulas.length) {
    const p = document.createElement('p');
    p.className = 'microcopy';
    p.textContent = 'Nessuna formula salvata finora.';
    libraryList.appendChild(p);
    return;
  }
  const frag = document.createDocumentFragment();
  state.formulas.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).forEach((f) => {
    const item = document.createElement('article');
    item.className = 'library-item';

    const header = document.createElement('header');
    const title = document.createElement('h3'); title.textContent = f.name;
    const subtitle = document.createElement('span');
    subtitle.className = 'microcopy';
    const date = new Date(f.updatedAt);
    subtitle.textContent = `${f.type} · aggiornato il ${date.toLocaleDateString('it-IT')}`;
    header.appendChild(title);
    header.appendChild(subtitle);

    const actions = document.createElement('div');
    actions.className = 'library-actions';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button'; loadBtn.textContent = 'Carica';
    loadBtn.addEventListener('click', () => loadFormula(f.id));

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button'; duplicateBtn.className = 'ghost-btn';
    duplicateBtn.textContent = 'Duplica';
    duplicateBtn.addEventListener('click', () => duplicateFormula(f.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button'; deleteBtn.className = 'ghost-btn';
    deleteBtn.textContent = 'Elimina';
    deleteBtn.addEventListener('click', () => deleteFormula(f.id));

    actions.append(loadBtn, duplicateBtn, deleteBtn);

    const notesSummary = document.createElement('p');
    notesSummary.className = 'microcopy';
    const materialNames = f.materials.filter((it) => it.note).map((it) => it.note).slice(0, 6).join(' · ');
    notesSummary.textContent = materialNames || 'Nessuna nota indicata.';

    header.appendChild(actions);
    item.appendChild(header);
    item.appendChild(notesSummary);

    frag.appendChild(item);
  });
  libraryList.appendChild(frag);
}

function loadFormula(id) {
  const f = state.formulas.find((it) => it.id === id);
  if (!f) return;
  state.editingId = f.id;
  if (formulaNameInput)  formulaNameInput.value = f.name;
  if (formulaTypeSelect) formulaTypeSelect.value = f.type;
  if (batchWeightInput)  batchWeightInput.value = f.batchWeight;
  if (densityInput)      densityInput.value = f.density;

  if (materialsTable) materialsTable.innerHTML = '';
  state.materials = f.materials.map((m) => ({ ...m, id: uid() }));
  state.materials.forEach(createMaterialRow);
  updateBatchOutputs();
}

function duplicateFormula(id) {
  const f = state.formulas.find((it) => it.id === id);
  if (!f) return;
  const clone = {
    ...f,
    id: `formula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${f.name} (copia)`,
    updatedAt: new Date().toISOString(),
    materials: f.materials.map((it) => ({ ...it }))
  };
  state.formulas.push(clone);
  persistLibrary();
  renderLibrary();
}

function deleteFormula(id) {
  if (!confirm('Vuoi eliminare definitivamente questa formula?')) return;
  state.formulas = state.formulas.filter((it) => it.id !== id);
  persistLibrary();
  renderLibrary();
}

// ====== Export ======
function exportFormula() {
  hydrateStateFromForm();
  if (!state.materials.length) { alert('Nessuna formula da esportare.'); return; }
  const formula = collectFormula();
  const blob = new Blob([JSON.stringify(formula, null, 2)], { type: 'application/json' });
  downloadFile(blob, buildSafeFileName(formula.name, 'json'));
}

function computeMaterialTotals(materials) {
  return materials.reduce((acc, it) => ({
    grams:  acc.grams  + (Number(it.grams)  || 0),
    ml:     acc.ml     + (Number(it.ml)     || 0),
    drops:  acc.drops  + (Number(it.drops)  || 0),
    percent:acc.percent+ (Number(it.percent)|| 0)
  }), { grams: 0, ml: 0, drops: 0, percent: 0 });
}

function exportFormulaExcel() {
  hydrateStateFromForm();
  if (!state.materials.length) { alert('Nessuna formula da esportare.'); return; }
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
  const metadataTable = metadataRows.map(([label, value]) =>
    `<tr><th style="text-align:left;background:#eef1ff;padding:8px 12px;">${escapeHtml(label)}</th><td style="padding:8px 12px;">${escapeHtml(value)}</td></tr>`
  ).join('');

  const materialsHeader =
    '<tr style="background:#f7f7fb;font-weight:600;">' +
    ['Nota', 'Grammi', 'Millilitri', 'Gocce', '%', 'Diluizione (%)']
      .map((h) => `<th style="padding:8px 12px;border-bottom:1px solid #dcdfee;text-align:left;">${escapeHtml(h)}</th>`)
      .join('') + '</tr>';

  const materialsRows = formula.materials.map((m) => {
    const cells = [
      m.note || '—',
      formatDecimal(m.grams, 2),
      formatDecimal(m.ml, 2),
      formatDecimal(m.drops, 0),
      formatDecimal(m.percent, 2),
      formatDecimal(Number(m.dilution ?? 100), 1)
    ];
    return '<tr>' + cells.map((v) =>
      `<td style="padding:6px 12px;border-bottom:1px solid #eef0f7;vertical-align:top;">${escapeHtml(v)}</td>`
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
<html lang="it">
<head><meta charset="UTF-8" /><title>${escapeHtml(formula.name || 'formula')}</title>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#111118;">
  <h1 style="font-size:20px;">Parfum Formulator · ${escapeHtml(formula.name)}</h1>
  <table style="border-collapse:collapse;margin-bottom:24px;min-width:320px;">${metadataTable}</table>
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
  return value.toString().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
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
  lines.forEach((line, i) => {
    const y = startY - i * lineHeight;
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
  const chunks = [];
  const offsets = [];
  let position = headerBytes.length;

  objects.forEach((obj) => {
    const bytes = encoder.encode(obj);
    offsets.push(position);
    chunks.push(bytes);
    position += bytes.length;
  });

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  xref += offsets.map((off) => `${off.toString().padStart(10, '0')} 00000 n \n`).join('');
  if (!xref.endsWith('\n')) xref += '\n';

  const startXref = position;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  const xrefBytes = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);

  const totalLen = headerBytes.length + chunks.reduce((s, c) => s + c.length, 0) + xrefBytes.length + trailerBytes.length;
  const buffer = new Uint8Array(totalLen);
  let offset = 0;
  buffer.set(headerBytes, offset); offset += headerBytes.length;
  chunks.forEach((c) => { buffer.set(c, offset); offset += c.length; });
  buffer.set(xrefBytes, offset); offset += xrefBytes.length;
  buffer.set(trailerBytes, offset);
  return new Blob([buffer], { type: 'application/pdf' });
}

function exportFormulaPdf() {
  hydrateStateFromForm();
  if (!state.materials.length) { alert('Nessuna formula da esportare.'); return; }
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
      const grams = formatDecimal(m.grams, 2);
      const percent = formatDecimal(m.percent, 2);
      const dilution = Number.isFinite(Number(m.dilution)) ? formatDecimal(Number(m.dilution), 1) : '-';
      lines.push(`${i + 1}. ${note} · ${grams} g · ${percent}% · diluizione ${dilution}%`);
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

// ====== Import JSON (UNICA implementazione) ======
function importFormulaObject(obj) {
  if (!obj || typeof obj !== 'object') { alert('File non valido.'); return; }

  if (typeof obj.name === 'string')   formulaNameInput.value  = obj.name;
  if (typeof obj.type === 'string')   formulaTypeSelect.value = obj.type;
  if (Number.isFinite(obj.batchWeight)) batchWeightInput.value = obj.batchWeight;
  if (Number.isFinite(obj.density))     densityInput.value     = obj.density;

  // reset
  state.materials = [];
  if (materialsTable) materialsTable.innerHTML = '';

  const batchWeight = getBatchWeight();
  const rows = Array.isArray(obj.materials) ? obj.materials : [];

  rows.forEach((m) => {
    const note      = (m.note || '').toString();
    const gramsIn   = Number(m.grams);
    const percentIn = Number(m.percent);
    const dilIn     = Number.isFinite(Number(m.dilution)) ? Number(m.dilution) : 100;

    const grams = Number.isFinite(gramsIn)
      ? gramsIn
      : (Number.isFinite(percentIn) ? (percentIn / 100) * batchWeight : 0);

    const calc = recalcMaterial({
      id: uid(),
      note,
      grams,
      ml: 0,
      drops: 0,
      percent: Number.isFinite(percentIn) ? percentIn : 0,
      dilution: clampPercentage(dilIn)
    }, 'sync');

    const material = { id: uid(), ...calc }; // ID univoco garantito
    state.materials.push(material);
    createMaterialRow(material);
  });

  updateBatchOutputs();
  updateInsights();

  // vai allo step Note se usi router a hash
  try { if (typeof location !== 'undefined') location.hash = '#/step/2'; } catch {}
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(String(e.target.result || ''));
      importFormulaObject(obj);
    } catch (err) { alert('JSON non valido.'); }
    finally {
      if (importFile) importFile.value = '';
      if (importRecipeInput) importRecipeInput.value = '';
    }
  };
  reader.onerror = () => { alert('Impossibile leggere il file selezionato.'); };
  reader.readAsText(file, 'utf-8');
}

// ====== Catalogo (modal) ======
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

  const rows = MASTER_LIBRARY.filter((item) => {
    const hitText  = item.name.toLowerCase().includes(q) || (item.families || []).some((f) => f.toLowerCase().includes(q));
    const hitGroup = !grp || (item.group || '').toLowerCase() === grp;
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
  rows.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'catalog-item';

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'catalog-item__name';
    title.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'catalog-item__meta';
    const fam = (item.families || []).join(' · ') || '—';
    const pyr = (item.pyramid || []).join(' · ') || '—';
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

// ====== Eventi ======
function initEvents() {
  addMaterialBtn?.addEventListener('click', () => addMaterial());
  clearMaterialsBtn?.addEventListener('click', clearMaterials);

  batchWeightInput?.addEventListener('input', () => { updateBatchOutputs(); updateInsights(); });
  densityInput?.addEventListener('input', () => { updateBatchOutputs(); updateInsights(); });
  formulaTypeSelect?.addEventListener('change', () => { updateConcentrateUI(); updateInsights(); });

  saveFormulaBtn?.addEventListener('click', () => { hydrateStateFromForm(); saveFormula(); });

  exportFormulaBtn?.addEventListener('click', exportFormula);
  exportExcelBtn?.addEventListener('click', exportFormulaExcel);
  exportPdfBtn?.addEventListener('click', exportFormulaPdf);
  newFormulaBtn?.addEventListener('click', resetFormula);

  // Catalogo
  browseCatalogBtn?.addEventListener('click', openCatalog);
  catalogCloseBtn?.addEventListener('click', closeCatalog);
  catalogCloseBtn2?.addEventListener('click', closeCatalog);
  catalogModal?.addEventListener('click', (e) => { if (e.target === catalogModal) closeCatalog(); });
  catalogSearch?.addEventListener('input', renderCatalog);
  catalogGroup?.addEventListener('change', renderCatalog);

  // Import – pulsante/i visibili
  importBtn?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', (e) => handleImportFile(e.target.files?.[0]));

  importRecipeBtn?.addEventListener('click', () => importRecipeInput?.click());
  importRecipeInput?.addEventListener('change', (e) => handleImportFile(e.target.files?.[0]));

  // Drag & drop sulla hero (se presente)
  const hero = document.querySelector('.hero');
  if (hero) {
    ['dragenter','dragover'].forEach((ev) =>
      hero.addEventListener(ev, (e) => { e.preventDefault(); hero.classList.add('drop-ready'); })
    );
    ['dragleave','drop'].forEach((ev) =>
      hero.addEventListener(ev, (e) => { e.preventDefault(); hero.classList.remove('drop-ready'); })
    );
    hero.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file && /\.json$/i.test(file.name)) handleImportFile(file);
    });
  }
}

// ====== Init ======
function init() {
  loadNoteLibrary();
  loadLibrary();
  renderLibrary();
  addInitialRows();
  initEvents();
  updateBatchOutputs();
  updateInsights();
}

initTheme();
init();

// ====== Gauge sync (tachimetro) ======
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

// ====== Wizard bridge (router hash) ======
window.__wizardApi = {
  hydrate: hydrateStateFromForm,
  updateBatch: updateBatchOutputs,
  updateInsights,
  getBatchWeight,
  state
};
