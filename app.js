// app.js — Parfum Formulator (build UX+calc migliorata)

// ===== Imports =====
import { NOTES_DATA, OLFACTIVE_FAMILIES, DEFAULT_PYRAMID } from './assets/notes-data.js';
import { MASTER_LIBRARY } from './assets/library-data.js';

// ===== DOM refs =====
const materialsTable = document.getElementById('materialsTable');
const materialTemplate = document.getElementById('materialRowTemplate');
const noteLibrary = document.getElementById('noteLibrary');

const batchWeightInput = document.getElementById('batchWeight');
const densityInput = document.getElementById('density');
const batchVolumeOutput = document.getElementById('batchVolume');
const batchDropsOutput = document.getElementById('batchDrops');

const addMaterialBtn = document.getElementById('addMaterialBtn');
const clearMaterialsBtn = document.getElementById('clearMaterialsBtn');

const pyramidList = document.getElementById('pyramidList');
const familyBadge = document.getElementById('familyBadge');
const scoreValue = document.getElementById('scoreValue');
const improvementList = document.getElementById('improvementList');

const saveFormulaBtn = document.getElementById('saveFormulaBtn');
const exportFormulaBtn = document.getElementById('exportFormulaBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const libraryList = document.getElementById('libraryList');

const newFormulaBtn = document.getElementById('newFormulaBtn');
const themeToggle = document.getElementById('themeToggle');
const formulaNameInput = document.getElementById('formulaName');
const formulaTypeSelect = document.getElementById('formulaType');

// Catalogo
const browseCatalogBtn = document.getElementById('browseCatalogBtn');
const catalogModal   = document.getElementById('catalogModal');
const catalogCloseBtn = document.getElementById('catalogCloseBtn');
const catalogCloseBtn2 = document.getElementById('catalogCloseBtn2');
const catalogSearch  = document.getElementById('catalogSearch');
const catalogGroup   = document.getElementById('catalogGroup');
const catalogList    = document.getElementById('catalogList');

// Import
const importBtn  = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const importRecipeBtn   = document.getElementById('importRecipeBtn');
const importRecipeInput = document.getElementById('importRecipeInput');

// Opzionali
const concentrationBar = document.getElementById('concentrationBar');
const concentrationLabel = document.getElementById('concentrationLabel');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

// ===== Costanti & Storage keys =====
const DROPS_PER_ML = 20;
const STORAGE_KEY = 'parfum-formulator__formulas';
const THEME_STORAGE_KEY = 'parfum-formulator__theme';
const DRAFT_KEY = 'parfum-formulator__draft';
const USER_ALIAS_KEY = 'parfum-formulator__aliases';

// Target concentrazione indicativi (puoi adattarli)
const TYPE_TARGETS = {
  EDC:  { min: 2,  max: 6,   top: 5,  heart: 50, base: 45, tol: 8 },
  EDT:  { min: 5,  max: 12,  top: 30, heart: 40, base: 30, tol: 8 },
  EDP:  { min: 12, max: 22,  top: 20, heart: 45, base: 35, tol: 8 },
  Extrait: { min: 22, max: 40, top: 15, heart: 40, base: 45, tol: 10 }
};

// ===== Util =====
function debounce(fn, ms = 200) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
const formatter = new Intl.NumberFormat('it-IT',{ minimumFractionDigits:0, maximumFractionDigits:2 });
function formatDecimal(v, max=2){ return Number.isFinite(v) ? v.toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:max}) : '-'; }
function normaliseName(v=''){ return v.toString().trim().toLowerCase(); }
function escapeHtml(v=''){ return v.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function buildSafeFileName(name, extension){
  const base = (name||'').toString().trim().replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,'-').toLowerCase() || 'formula';
  return `${base}.${extension}`;
}
function parseNumber(v){ const p = parseFloat(v); return Number.isFinite(p) ? p : 0; }
function clampPercentage(v){ if(!Number.isFinite(v)) return 0; return Math.min(100, Math.max(0, v)); }
function uid(){ return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }

// ===== Tema =====
const themeMediaQuery = (typeof window!=='undefined' && typeof window.matchMedia==='function')
  ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function readStoredTheme(){ try{ return localStorage.getItem(THEME_STORAGE_KEY); }catch{return null;} }
function storeThemePreference(t){ try{ localStorage.setItem(THEME_STORAGE_KEY, t);}catch{} }
function getPreferredTheme(){ const s=readStoredTheme(); if(s) return s; return themeMediaQuery?.matches ? 'dark':'light'; }
function applyTheme(t){
  const selected = t==='dark'? 'dark':'light';
  document.body.dataset.theme = selected;
  if (themeToggle) {
    const isDark = selected==='dark';
    themeToggle.setAttribute('aria-checked', String(isDark));
    themeToggle.setAttribute('aria-label', isDark?'Attiva modalità chiara':'Attiva modalità scura');
    themeToggle.setAttribute('title', isDark?'Passa alla modalità chiara':'Passa alla modalità scura');
  }
}
function initTheme(){
  applyTheme(getPreferredTheme());
  themeToggle?.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    storeThemePreference(next); applyTheme(next);
  });
  themeMediaQuery?.addEventListener('change', e => { if (readStoredTheme()) return; applyTheme(e.matches?'dark':'light'); });
}

// ===== Stato =====
let syncing = false;
const state = {
  materials: [],
  formulas: [],
  editingId: null
};

// ===== Note catalogo + Alias locali =====
function buildNoteCatalog(notes){
  const index = new Map(); const list=[];
  notes.forEach((note)=>{
    if(!note?.name) return;
    const key = normaliseName(note.name);
    const families = Array.isArray(note.families)? note.families: [];
    const pyramid  = Array.isArray(note.pyramid)?  note.pyramid : [];
    if(index.has(key)){
      const ex=index.get(key);
      families.forEach(f=>{ if(!ex.families.includes(f)) ex.families.push(f); });
      pyramid.forEach(l=>{ if(!ex.pyramid.includes(l)) ex.pyramid.push(l); });
    } else {
      const entry = { name: note.name, families:[...families], pyramid:[...pyramid] };
      index.set(key, entry); list.push(entry);
    }
  });
  list.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  return { index, list };
}

const { index: NOTE_INDEX, list: NOTE_LIBRARY } = buildNoteCatalog(NOTES_DATA);
const DEFAULT_LEVELS = DEFAULT_PYRAMID;

// alias utente persistenti (auto-map “custom” -> nota canonica)
function loadUserAliases(){ try{ return JSON.parse(localStorage.getItem(USER_ALIAS_KEY)||'[]'); }catch{ return []; } }
function saveUserAlias(alias, canonical){
  const list = loadUserAliases();
  const item = { alias: normaliseName(alias), canonical: normaliseName(canonical) };
  if(!list.find(x=>x.alias===item.alias)){
    list.push(item);
    try{ localStorage.setItem(USER_ALIAS_KEY, JSON.stringify(list)); }catch{}
  }
}
const userAliasIndex = new Map(loadUserAliases().map(a=>[a.alias,a.canonical]));

// fuzzy-match leggero per suggerire mapping
function scoreMatch(query, target){
  const q = normaliseName(query); const t = normaliseName(target);
  if (!q) return 0;
  if (t.startsWith(q)) return 100 - (t.length - q.length);
  if (t.includes(q)) return 60 - (t.indexOf(q));
  // penalità per distanza semplice (differenza lunghezza)
  return Math.max(0, 40 - Math.abs(t.length - q.length));
}
function suggestCanonicalName(name){
  const q = normaliseName(name);
  // 1) alias utente diretto
  if (userAliasIndex.has(q)) return NOTE_INDEX.get(userAliasIndex.get(q))?.name || null;
  // 2) exact by NOTE_INDEX
  if (NOTE_INDEX.has(q)) return NOTE_INDEX.get(q).name;
  // 3) fuzzy sui nomi catalogo
  let best = null; let bestScore = 0;
  NOTE_LIBRARY.forEach(n=>{
    const s = scoreMatch(q, n.name);
    if (s>bestScore){ bestScore=s; best=n.name; }
  });
  return bestScore>=25 ? best : null;
}

function getMaterialProfile(noteName){
  let norm = normaliseName(noteName);
  if (NOTE_INDEX.has(norm)) return NOTE_INDEX.get(norm);

  // prova alias utente
  if (userAliasIndex.has(norm)) {
    const canonical = userAliasIndex.get(norm);
    if (NOTE_INDEX.has(canonical)) return NOTE_INDEX.get(canonical);
  }

  // prova suggerimento fuzzy e chiedi mapping (una sola volta a focusout della riga)
  const suggestion = suggestCanonicalName(noteName);
  if (suggestion && NOTE_INDEX.has(normaliseName(suggestion))) {
    // non mappo immediatamente: ritorno profilo suggerito come "shadow"
    return { ...NOTE_INDEX.get(normaliseName(suggestion)), __suggestedFrom: noteName };
  }
  return null; // resterà "custom"
}

// ===== Libreria “Note” (datalist) =====
function loadNoteLibrary(){
  if (!noteLibrary) return;
  noteLibrary.innerHTML = '';
  const frag = document.createDocumentFragment();
  NOTE_LIBRARY.forEach(note => {
    const option = document.createElement('option');
    option.value = note.name;
    frag.appendChild(option);
  });
  noteLibrary.appendChild(frag);
}

// ===== File helpers =====
function downloadFile(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ===== Materiale =====
function getMaterial(id){ return state.materials.find(x=>x.id===id); }

function getBatchWeight(){ return parseNumber(batchWeightInput?.value); }
function getDensity(){ const d=parseNumber(densityInput?.value); return d>0 ? d : 1; }

function recalcMaterial(material, source, value){
  const density = getDensity();
  const batchWeight = getBatchWeight();
  const dropsPerMl = DROPS_PER_ML; // estendibile per-materia
  const payload = { ...material };
  payload.dilution = clampPercentage(material.dilution ?? 100);

  switch(source){
    case 'grams':
      payload.grams = value;
      payload.ml = density ? value/density : 0;
      payload.drops = payload.ml * dropsPerMl;
      payload.percent = batchWeight ? (value / batchWeight)*100 : 0;
      break;
    case 'ml':
      payload.ml = value;
      payload.grams = value * density;
      payload.drops = value * dropsPerMl;
      payload.percent = batchWeight ? (payload.grams / batchWeight)*100 : 0;
      break;
    case 'drops':
      payload.drops = value;
      payload.ml = value / dropsPerMl;
      payload.grams = payload.ml * density;
      payload.percent = batchWeight ? (payload.grams / batchWeight)*100 : 0;
      break;
    case 'percent':
      payload.percent = value;
      payload.grams = (value/100) * batchWeight;
      payload.ml = density ? payload.grams / density : 0;
      payload.drops = payload.ml * dropsPerMl;
      break;
    default:
      payload.grams = material.grams;
      payload.ml = density ? payload.grams / density : 0;
      payload.drops = payload.ml * dropsPerMl;
      payload.percent = batchWeight ? (payload.grams / batchWeight)*100 : 0;
  }
  return payload;
}

// ===== Undo/Redo (1+ livelli) =====
const historyStack = [];
const redoStack = [];
function snapshot(){
  return {
    materials: state.materials.map(m=>({ ...m })),
    batchWeight: getBatchWeight(),
    density: getDensity(),
    name: formulaNameInput?.value || '',
    type: formulaTypeSelect?.value || 'EDP'
  };
}
function pushHistory(){
  try{ historyStack.push(snapshot()); redoStack.length = 0; }catch{}
}
function canUndo(){ return historyStack.length>0; }
function canRedo(){ return redoStack.length>0; }
function doUndo(){
  if (!canUndo()) return;
  const prev = historyStack.pop();
  redoStack.push(snapshot());
  restoreSnapshot(prev);
}
function doRedo(){
  if (!canRedo()) return;
  const next = redoStack.pop();
  historyStack.push(snapshot());
  restoreSnapshot(next);
}
function restoreSnapshot(s){
  // campi base
  if (formulaNameInput) formulaNameInput.value = s.name;
  if (formulaTypeSelect) formulaTypeSelect.value = s.type;
  if (batchWeightInput) batchWeightInput.value = s.batchWeight;
  if (densityInput) densityInput.value = s.density;
  // righe
  state.materials = s.materials.map(m=>({ ...m, id: uid() }));
  materialsTable.innerHTML = '';
  state.materials.forEach(createMaterialRow);
  updateBatchOutputs(); updateInsights();
}

// ===== UI: creazione riga =====
function createMaterialRow(material){
  const clone = materialTemplate.content.firstElementChild.cloneNode(true);
  clone.dataset.id = material.id;

  const noteInput = clone.querySelector('.note-input');
  const gramsInput = clone.querySelector('.grams-input');
  const mlInput = clone.querySelector('.ml-input');
  const dropsInput = clone.querySelector('.drops-input');
  const percentInput = clone.querySelector('.percent-input');
  const dilutionInput = clone.querySelector('.dilution-input');
  const removeBtn = clone.querySelector('.remove-btn');

  // Badge unmapped + tooltip
  updateRowMappingBadge(clone, material.note);

  // Ascoltatori con debounce
  noteInput.addEventListener('input', debounce((e)=>{
    if (syncing) return;
    updateMaterial(material.id, { note: e.target.value });
    updateRowMappingBadge(clone, e.target.value);
  }, 160));

  // auto-suggest mapping a blur (se “custom” ma con suggerimento certo)
  noteInput.addEventListener('blur', ()=>{
    const prof = getMaterialProfile(noteInput.value);
    if (prof?.__suggestedFrom && prof.name && prof.name !== noteInput.value) {
      const ok = confirm(`Vuoi mappare “${noteInput.value}” su “${prof.name}”? (usa sempre in futuro)`);
      if (ok) {
        saveUserAlias(noteInput.value, prof.name);
        userAliasIndex.set(normaliseName(noteInput.value), normaliseName(prof.name));
        updateMaterial(material.id, { note: prof.name });
        noteInput.value = prof.name;
        updateRowMappingBadge(clone, prof.name);
        updateInsights();
      }
    }
  });

  gramsInput.addEventListener('input', debounce((e)=>{
    if (syncing) return;
    const grams = parseNumber(e.target.value);
    const current = getMaterial(material.id) ?? material;
    pushHistory();
    updateMaterial(material.id, recalcMaterial(current,'grams', grams));
  }, 180));

  mlInput.addEventListener('input', debounce((e)=>{
    if (syncing) return;
    const ml = parseNumber(e.target.value);
    const current = getMaterial(material.id) ?? material;
    pushHistory();
    updateMaterial(material.id, recalcMaterial(current,'ml', ml));
  }, 180));

  dropsInput.addEventListener('input', debounce((e)=>{
    if (syncing) return;
    const drops = parseNumber(e.target.value);
    const current = getMaterial(material.id) ?? material;
    pushHistory();
    updateMaterial(material.id, recalcMaterial(current,'drops', drops));
  }, 180));

  percentInput.addEventListener('input', debounce((e)=>{
    if (syncing) return;
    const percent = parseNumber(e.target.value);
    const current = getMaterial(material.id) ?? material;
    pushHistory();
    updateMaterial(material.id, recalcMaterial(current,'percent', percent));
  }, 180));

  dilutionInput.addEventListener('input', debounce((e)=>{
    if (syncing) return;
    const dilution = clampPercentage(parseNumber(e.target.value));
    pushHistory();
    updateMaterial(material.id, { dilution });
  }, 180));

  removeBtn.addEventListener('click', ()=>{
    pushHistory();
    removeMaterial(material.id);
  });

  materialsTable.appendChild(clone);
  syncMaterialRow(material.id);
}
function
