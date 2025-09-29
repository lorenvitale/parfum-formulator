import { NOTES_DATA, OLFACTIVE_FAMILIES, DEFAULT_PYRAMID } from './assets/notes-data.js';

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
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const libraryList = document.getElementById('libraryList');
const newFormulaBtn = document.getElementById('newFormulaBtn');
const formulaNameInput = document.getElementById('formulaName');
const formulaTypeSelect = document.getElementById('formulaType');
const themeToggleBtn = document.getElementById('themeToggle');
const customNoteForm = document.getElementById('customNoteForm');
const customNoteIdInput = document.getElementById('customNoteId');
const customNoteNameInput = document.getElementById('customNoteName');
const customNotePyramidGroup = document.getElementById('customNotePyramidGroup');
const customNoteFamiliesSelect = document.getElementById('customNoteFamilies');
const resetCustomNoteBtn = document.getElementById('resetCustomNoteBtn');
const customNotesList = document.getElementById('customNotesList');

const DROPS_PER_ML = 20;
const STORAGE_KEY = 'parfum-formulator__formulas';
const THEME_KEY = 'parfum-formulator__theme';
const CUSTOM_NOTES_KEY = 'parfum-formulator__notes';

const DEFAULT_LEVELS = DEFAULT_PYRAMID;

let syncing = false;
let noteIndex = new Map();

const state = {
  materials: [],
  formulas: [],
  editingId: null,
  customNotes: []
};

function getMaterial(id) {
  return state.materials.find((item) => item.id === id);
}

const formatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function normaliseName(value = '') {
  return value.toString().trim().toLowerCase();
}

function slugify(value = '') {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function safeNumber(value, fallback = 0) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim() !== '');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()];
  }
  return [];
}

function hasExportableMaterials() {
  return state.materials.some((material) => {
    return (
      (material.note && material.note.trim() !== '') ||
      safeNumber(material.grams) > 0 ||
      safeNumber(material.ml) > 0 ||
      safeNumber(material.drops) > 0 ||
      safeNumber(material.percent) > 0
    );
  });
}

function uid() {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function detectPreferredTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch (error) {
    console.warn('Impossibile leggere il tema salvato', error);
  }
  return detectPreferredTheme();
}

function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = next;
  if (themeToggleBtn) {
    const label = next === 'dark' ? 'Passa alla modalità chiara' : 'Passa alla modalità scura';
    themeToggleBtn.setAttribute('aria-label', label);
    themeToggleBtn.setAttribute('title', label);
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.warn('Impossibile salvare il tema', error);
  }
}

function toggleTheme() {
  const current = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  persistTheme(next);
}

function normaliseCatalogEntry(note) {
  if (!note || typeof note.name !== 'string') return null;
  const name = note.name.trim();
  if (!name) return null;

  const families = ensureArray(note.families)
    .map((family) => family.trim())
    .filter((family) => family.length > 0);

  const pyramid = ensureArray(note.pyramid)
    .map((level) => {
      const normalised = level.trim();
      const match = DEFAULT_LEVELS.find((item) => item.toLowerCase() === normalised.toLowerCase());
      return match || null;
    })
    .filter(Boolean);

  const safeFamilies = families.length
    ? [...new Set(families)].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
    : ['Personalizzata'];

  const safePyramid = pyramid.length
    ? [...new Set(pyramid)].sort((a, b) => DEFAULT_LEVELS.indexOf(a) - DEFAULT_LEVELS.indexOf(b))
    : ['Cuore'];

  return {
    ...note,
    name,
    families: safeFamilies,
    pyramid: safePyramid
  };
}

function buildNoteCatalog() {
  const baseNotes = Array.isArray(NOTES_DATA) ? [...NOTES_DATA] : [];
  const customNotes = Array.isArray(state.customNotes) ? [...state.customNotes] : [];
  const combined = [...baseNotes, ...customNotes]
    .map((note) => normaliseCatalogEntry(note))
    .filter((note) => note !== null);

  const merged = new Map();
  combined.forEach((note) => {
    const key = normaliseName(note.name);
    if (merged.has(key)) {
      const existing = merged.get(key);
      const families = [...new Set([...existing.families, ...note.families])].sort((a, b) =>
        a.localeCompare(b, 'it', { sensitivity: 'base' })
      );
      const pyramid = [...new Set([...existing.pyramid, ...note.pyramid])].sort(
        (a, b) => DEFAULT_LEVELS.indexOf(a) - DEFAULT_LEVELS.indexOf(b)
      );
      merged.set(key, { ...existing, families, pyramid });
    } else {
      merged.set(key, { ...note });
    }
  });

  const catalog = [...merged.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
  );

  noteIndex = new Map(catalog.map((note) => [normaliseName(note.name), note]));
  return catalog;
}

function loadNoteLibrary() {
  if (!noteLibrary) return;
  const catalog = buildNoteCatalog();
  noteLibrary.innerHTML = '';
  const fragment = document.createDocumentFragment();
  catalog.forEach((note) => {
    const option = document.createElement('option');
    option.value = note.name;
    fragment.appendChild(option);
  });
  noteLibrary.appendChild(fragment);
}

function renderCustomNoteControls() {
  if (!customNotePyramidGroup) return;
  customNotePyramidGroup.innerHTML = '';
  DEFAULT_LEVELS.forEach((level) => {
    const id = `custom-pyramid-${slugify(level)}`;
    const wrapper = document.createElement('label');
    wrapper.className = 'choice-chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'customNotePyramid';
    input.value = level;
    input.id = id;
    if (level === 'Cuore') {
      input.checked = true;
    }
    const span = document.createElement('span');
    span.textContent = level;
    span.setAttribute('data-label', level);
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    customNotePyramidGroup.appendChild(wrapper);
  });

  if (customNoteFamiliesSelect) {
    customNoteFamiliesSelect.innerHTML = '';
    const families = Array.isArray(OLFACTIVE_FAMILIES) ? [...OLFACTIVE_FAMILIES] : [];
    families
      .slice()
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      .forEach((family) => {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = family;
        customNoteFamiliesSelect.appendChild(option);
      });
  }
}

function getSelectedPyramidLevels() {
  if (!customNotePyramidGroup) return [];
  return Array.from(customNotePyramidGroup.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value
  );
}

function getSelectedFamilies() {
  if (!customNoteFamiliesSelect) return [];
  return Array.from(customNoteFamiliesSelect.selectedOptions).map((option) => option.value);
}

function normaliseCustomNote(note) {
  const normalised = normaliseCatalogEntry(note);
  if (!normalised) return null;
  const id =
    typeof note.id === 'string' && note.id.trim()
      ? note.id.trim()
      : `custom-${slugify(normalised.name) || Date.now().toString(36)}`;
  return {
    ...normalised,
    id
  };
}

function loadCustomNotes() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(CUSTOM_NOTES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.customNotes = parsed
        .map((note) => normaliseCustomNote(note))
        .filter((note) => note !== null);
    }
  } catch (error) {
    console.warn('Impossibile caricare le note personalizzate', error);
    state.customNotes = [];
  }
}

function persistCustomNotes() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_NOTES_KEY, JSON.stringify(state.customNotes));
  } catch (error) {
    console.warn('Impossibile salvare le note personalizzate', error);
  }
}

function renderCustomNotes() {
  if (!customNotesList) return;
  customNotesList.innerHTML = '';
  if (!state.customNotes.length) {
    const empty = document.createElement('p');
    empty.className = 'microcopy';
    empty.textContent = 'Salva qui le tue note personalizzate per riutilizzarle velocemente.';
    customNotesList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.customNotes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))
    .forEach((note) => {
      const item = document.createElement('article');
      item.className = 'custom-note-card';
      item.dataset.id = note.id;

      const title = document.createElement('h4');
      title.textContent = note.name;
      item.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'microcopy';
      const families = note.families.join(', ');
      const pyramid = note.pyramid.join(' · ');
      meta.textContent = `${families} · Piramide: ${pyramid}`;
      item.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'custom-note-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ghost-btn';
      editBtn.textContent = 'Modifica';
      editBtn.addEventListener('click', () => populateCustomNoteForm(note));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ghost-btn';
      deleteBtn.textContent = 'Elimina';
      deleteBtn.addEventListener('click', () => deleteCustomNote(note.id));

      actions.append(editBtn, deleteBtn);
      item.appendChild(actions);
      fragment.appendChild(item);
    });

  customNotesList.appendChild(fragment);
}

function resetCustomNoteForm() {
  if (!customNoteForm) return;
  customNoteForm.reset();
  if (customNoteIdInput) {
    customNoteIdInput.value = '';
  }
  if (customNotePyramidGroup) {
    customNotePyramidGroup
      .querySelectorAll('input[type="checkbox"]')
      .forEach((input) => {
        input.checked = input.value === 'Cuore';
      });
  }
  if (customNoteFamiliesSelect) {
    Array.from(customNoteFamiliesSelect.options).forEach((option) => {
      option.selected = false;
    });
  }
}

function populateCustomNoteForm(note) {
  if (!customNoteForm || !note || !customNoteNameInput) return;
  if (customNoteIdInput) {
    customNoteIdInput.value = note.id;
  }
  customNoteNameInput.value = note.name;
  if (customNotePyramidGroup) {
    const selected = new Set(note.pyramid);
    customNotePyramidGroup
      .querySelectorAll('input[type="checkbox"]')
      .forEach((input) => {
        input.checked = selected.has(input.value);
      });
  }
  if (customNoteFamiliesSelect) {
    const selectedFamilies = new Set(note.families);
    Array.from(customNoteFamiliesSelect.options).forEach((option) => {
      option.selected = selectedFamilies.has(option.value);
    });
  }
  customNoteNameInput.focus();
}

function deleteCustomNote(id) {
  state.customNotes = state.customNotes.filter((note) => note.id !== id);
  persistCustomNotes();
  loadNoteLibrary();
  renderCustomNotes();
  updateInsights();
}

function handleCustomNoteSubmit(event) {
  event.preventDefault();
  if (!customNoteForm || !customNoteNameInput) return;
  const name = customNoteNameInput.value.trim();
  if (!name) {
    alert('Inserisci un nome per la nota personalizzata.');
    customNoteNameInput.focus();
    return;
  }

  const baseExists = NOTES_DATA.some((note) => normaliseName(note.name) === normaliseName(name));
  if (baseExists) {
    alert('Esiste già una nota con questo nome nel catalogo. Scegli un nome differente o aggiungi una variante.');
    return;
  }

  const pyramid = getSelectedPyramidLevels();
  if (!pyramid.length) {
    alert('Seleziona almeno un livello della piramide olfattiva.');
    return;
  }

  let families = getSelectedFamilies();
  if (!families.length) {
    families = ['Personalizzata'];
  }

  const id = customNoteIdInput ? customNoteIdInput.value.trim() : '';
  const duplicate = state.customNotes.find(
    (note) => note.id !== id && normaliseName(note.name) === normaliseName(name)
  );
  if (duplicate) {
    alert('Hai già salvato una nota personalizzata con questo nome.');
    return;
  }

  const payload = {
    id: id || `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    pyramid,
    families
  };

  const normalised = normaliseCustomNote(payload);
  if (!normalised) return;

  const index = state.customNotes.findIndex((note) => note.id === normalised.id);
  if (index > -1) {
    state.customNotes[index] = normalised;
  } else {
    state.customNotes.push(normalised);
  }

  persistCustomNotes();
  loadNoteLibrary();
  renderCustomNotes();
  updateInsights();
  resetCustomNoteForm();
}

function createMaterialRow(material) {
  const clone = materialTemplate.content.firstElementChild.cloneNode(true);
  clone.dataset.id = material.id;

  const noteInput = clone.querySelector('.note-input');
  const gramsInput = clone.querySelector('.grams-input');
  const mlInput = clone.querySelector('.ml-input');
  const dropsInput = clone.querySelector('.drops-input');
  const percentInput = clone.querySelector('.percent-input');
  const dilutionInput = clone.querySelector('.dilution-input');
  const removeBtn = clone.querySelector('.remove-btn');

  noteInput.addEventListener('input', (event) => {
    if (syncing) return;
    updateMaterial(material.id, { note: event.target.value });
  });

  gramsInput.addEventListener('input', (event) => {
    if (syncing) return;
    const grams = Math.max(0, parseNumber(event.target.value));
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'grams', grams));
  });

  mlInput.addEventListener('input', (event) => {
    if (syncing) return;
    const ml = Math.max(0, parseNumber(event.target.value));
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'ml', ml));
  });

  dropsInput.addEventListener('input', (event) => {
    if (syncing) return;
    const drops = Math.max(0, parseNumber(event.target.value));
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'drops', drops));
  });

  percentInput.addEventListener('input', (event) => {
    if (syncing) return;
    const percent = Math.min(100, Math.max(0, parseNumber(event.target.value)));
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'percent', percent));
  });

  dilutionInput.addEventListener('input', (event) => {
    if (syncing) return;
    const dilution = clampPercentage(parseNumber(event.target.value));
    updateMaterial(material.id, { dilution });
  });

  removeBtn.addEventListener('click', () => {
    removeMaterial(material.id);
  });

  materialsTable.appendChild(clone);
  syncMaterialRow(material.id);
}

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function normaliseStoredMaterial(material) {
  const source = material && typeof material === 'object' ? material : {};
  const note = typeof source.note === 'string' ? source.note.trim() : '';
  const grams = Math.max(0, safeNumber(source.grams));
  const ml = Math.max(0, safeNumber(source.ml));
  const drops = Math.max(0, safeNumber(source.drops));
  const percent = Math.max(0, safeNumber(source.percent));
  const dilution = clampPercentage(safeNumber(source.dilution, 100));

  return {
    note,
    grams,
    ml,
    drops,
    percent,
    dilution
  };
}

function normaliseStoredFormula(formula) {
  if (!formula || typeof formula !== 'object') return null;

  const id =
    typeof formula.id === 'string' && formula.id.trim()
      ? formula.id.trim()
      : `formula-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const name =
    typeof formula.name === 'string' && formula.name.trim()
      ? formula.name.trim()
      : 'Formula senza titolo';

  const type =
    typeof formula.type === 'string' && formula.type.trim()
      ? formula.type.trim()
      : 'EDP';

  const batchWeight = Math.max(0, safeNumber(formula.batchWeight));
  const densityRaw = safeNumber(formula.density, 1);
  const density = densityRaw > 0 ? densityRaw : 1;

  const materials = Array.isArray(formula.materials)
    ? formula.materials.map((material) => normaliseStoredMaterial(material))
    : [];

  let updatedAt;
  if (typeof formula.updatedAt === 'string') {
    const parsed = Date.parse(formula.updatedAt);
    updatedAt = Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
  } else {
    updatedAt = new Date().toISOString();
  }

  return {
    id,
    name,
    type,
    batchWeight,
    density,
    materials,
    updatedAt
  };
}

function getBatchWeight() {
  return parseNumber(batchWeightInput.value);
}

function getDensity() {
  const density = parseNumber(densityInput.value);
  return density > 0 ? density : 1;
}

function recalcMaterial(material, source, value) {
  const density = getDensity();
  const batchWeight = getBatchWeight();
  const payload = { ...material };
  payload.dilution = clampPercentage(material.dilution ?? 100);

  switch (source) {
    case 'grams':
      payload.grams = value;
      payload.ml = density ? value / density : 0;
      payload.drops = payload.ml * DROPS_PER_ML;
      payload.percent = batchWeight ? (value / batchWeight) * 100 : 0;
      break;
    case 'ml':
      payload.ml = value;
      payload.grams = value * density;
      payload.drops = value * DROPS_PER_ML;
      payload.percent = batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
    case 'drops':
      payload.drops = value;
      payload.ml = value / DROPS_PER_ML;
      payload.grams = payload.ml * density;
      payload.percent = batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
    case 'percent':
      payload.percent = value;
      payload.grams = (value / 100) * batchWeight;
      payload.ml = density ? payload.grams / density : 0;
      payload.drops = payload.ml * DROPS_PER_ML;
      break;
    default:
      payload.grams = material.grams;
      payload.ml = density ? payload.grams / density : 0;
      payload.drops = payload.ml * DROPS_PER_ML;
      payload.percent = batchWeight ? (payload.grams / batchWeight) * 100 : 0;
      break;
  }

  return payload;
}

function updateMaterial(id, payload) {
  const index = state.materials.findIndex((item) => item.id === id);
  if (index === -1) return;
  state.materials[index] = { ...state.materials[index], ...payload };
  syncMaterialRow(id);
  updateInsights();
}

function syncMaterialRow(id) {
  const material = state.materials.find((item) => item.id === id);
  const row = materialsTable.querySelector(`[data-id="${id}"]`);
  if (!material || !row) return;

  syncing = true;
  const noteInput = row.querySelector('.note-input');
  const gramsInput = row.querySelector('.grams-input');
  const mlInput = row.querySelector('.ml-input');
  const dropsInput = row.querySelector('.drops-input');
  const percentInput = row.querySelector('.percent-input');
  const dilutionInput = row.querySelector('.dilution-input');

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
  syncing = false;
}

function addMaterial(note = '') {
  const material = recalcMaterial(
    {
      id: uid(),
      note,
      grams: 0,
      ml: 0,
      drops: 0,
      percent: 0,
      dilution: 100
    },
    'init'
  );

  state.materials.push(material);
  createMaterialRow(material);
  updateInsights();
}

function removeMaterial(id) {
  const index = state.materials.findIndex((item) => item.id === id);
  if (index === -1) return;
  state.materials.splice(index, 1);
  const row = materialsTable.querySelector(`[data-id="${id}"]`);
  if (row) {
    row.remove();
  }
  updateInsights();
}

function clearMaterials() {
  state.materials = [];
  materialsTable.innerHTML = '';
  updateInsights();
}

function updateBatchOutputs() {
  const weight = getBatchWeight();
  const density = getDensity();
  const volume = density ? weight / density : 0;
  const drops = volume * DROPS_PER_ML;

  batchVolumeOutput.textContent = formatter.format(volume);
  batchDropsOutput.textContent = formatter.format(drops);

  state.materials = state.materials.map((material) => recalcMaterial(material, 'sync'));
  state.materials.forEach((material) => syncMaterialRow(material.id));
  updateInsights();
}

function getMaterialProfile(noteName) {
  if (!noteName) return null;
  const normalised = normaliseName(noteName);
  return noteIndex.get(normalised) || null;
}

function computeInsights() {
  const batchWeight = getBatchWeight();
  const totalWeight = state.materials.reduce((sum, item) => sum + item.grams, 0);

  const pyramid = new Map(DEFAULT_LEVELS.map((level) => [level, []]));
  const familyWeights = new Map();

  state.materials.forEach((material) => {
    if (!material.note || material.grams <= 0) return;
    const profile = getMaterialProfile(material.note);
    if (profile) {
      profile.pyramid.forEach((level) => {
        if (!pyramid.has(level)) {
          pyramid.set(level, []);
        }
        pyramid.get(level).push(material);
      });

      profile.families.forEach((family) => {
        const current = familyWeights.get(family) || 0;
        familyWeights.set(family, current + material.grams);
      });
    } else {
      // Se la nota non esiste nel dataset, colloca in Cuore come fallback
      pyramid.get('Cuore').push(material);
    }
  });

  const pyramidData = DEFAULT_LEVELS.map((level) => {
    const materials = pyramid.get(level) || [];
    const weight = materials.reduce((sum, item) => sum + item.grams, 0);
    const percentage = totalWeight ? (weight / totalWeight) * 100 : 0;
    const list = materials
      .slice()
      .sort((a, b) => b.grams - a.grams)
      .map((item) => {
        const noteProfile = getMaterialProfile(item.note);
        const tag = noteProfile ? noteProfile.families[0] : 'Custom';
        return `${item.note} (${item.percent.toFixed(1)}% · ${tag})`;
      });

    return {
      level,
      weight,
      percentage,
      list
    };
  });

  const sortedFamilies = [...familyWeights.entries()].sort((a, b) => b[1] - a[1]);
  const dominantFamily = sortedFamilies[0]?.[0] ?? null;

  const levelPercentages = pyramidData.reduce((acc, item) => {
    acc[item.level] = item.percentage / 100;
    return acc;
  }, {});

  const percentSpread = (() => {
    const values = pyramidData.map((item) => (totalWeight ? item.weight / totalWeight : 0));
    if (!values.length) return 0;
    return Math.max(...values) - Math.min(...values);
  })();

  const balanceScore = totalWeight ? Math.max(0, 100 - percentSpread * 100) : 0;
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
    if (percentage < 15) {
      suggestions.push(`Valuta di rafforzare la sezione di ${level.toLowerCase()} oltre il 15%.`);
    }
  });

  if (!dominantFamily) {
    suggestions.push('Seleziona note dal catalogo per ottenere la famiglia olfattiva suggerita.');
  } else {
    suggestions.push(`La famiglia ${dominantFamily} è dominante: mantienila oppure integra famiglie complementari.`);
  }

  if (sortedFamilies.length < 2) {
    suggestions.push('Integra una seconda famiglia per ampliare la complessità.');
  }

  const baseLevel = pyramidData.find((item) => item.level === 'Fondo');
  if (baseLevel && baseLevel.percentage < 25) {
    suggestions.push('Aumenta le note di fondo per una maggiore persistenza sulla pelle.');
  }

  const topLevel = pyramidData.find((item) => item.level === 'Testa');
  if (topLevel && topLevel.percentage > 40) {
    suggestions.push('Riduci leggermente le note di testa per evitare un inizio troppo volatile.');
  }

  const concentratePercent = batchWeight ? (totalWeight / batchWeight) * 100 : 0;
  if (concentratePercent < 10) {
    suggestions.push('Il concentrato totale è basso: valuta di aumentare le materie prime o ridurre il solvente.');
  } else if (concentratePercent > 30) {
    suggestions.push('Il concentrato supera il 30%: verifica la compatibilità con la tipologia scelta.');
  }

  return [...new Set(suggestions)];
}

function updateInsights() {
  const { pyramidData, dominantFamily, rating, score, suggestions, totalWeight } = computeInsights();

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

  familyBadge.textContent = dominantFamily ?? '-';
  scoreValue.textContent = totalWeight ? `${rating} / 5` : '-';

  improvementList.innerHTML = '';
  suggestions.forEach((suggestion) => {
    const li = document.createElement('li');
    li.textContent = suggestion;
    improvementList.appendChild(li);
  });
}

function addInitialRows() {
  if (!state.materials.length) {
    addMaterial();
  }
}

function collectFormula() {
  const batchWeight = getBatchWeight();
  const density = getDensity();
  return normaliseStoredFormula({
    id: state.editingId ?? `formula-${Date.now()}`,
    name: formulaNameInput.value.trim() || 'Formula senza titolo',
    type: formulaTypeSelect.value,
    batchWeight,
    density,
    materials: state.materials.map(({ id, ...material }) => material),
    updatedAt: new Date().toISOString()
  });
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
  if (!formula) return;
  const index = state.formulas.findIndex((item) => item.id === formula.id);
  if (index > -1) {
    state.formulas[index] = formula;
  } else {
    state.formulas.push(formula);
  }
  persistLibrary();
  renderLibrary();
  state.editingId = formula.id;
}

function persistLibrary() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formulas));
  } catch (error) {
    console.warn('Impossibile salvare la libreria di formule', error);
  }
}

function loadLibrary() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.formulas = parsed
        .map((item) => normaliseStoredFormula(item))
        .filter((item) => item !== null);
    }
  } catch (error) {
    console.error('Errore nel parsing della libreria', error);
  }
}

function renderLibrary() {
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
      const materialNames = formula.materials
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
  formulaNameInput.value = formula.name;
  formulaTypeSelect.value = formula.type;
  batchWeightInput.value = formula.batchWeight;
  densityInput.value = formula.density;

  materialsTable.innerHTML = '';
  state.materials = formula.materials.map((material) => ({
    id: uid(),
    ...normaliseStoredMaterial(material)
  }));
  state.materials.forEach((material) => createMaterialRow(material));
  updateBatchOutputs();
}

function buildDuplicateName(name) {
  const base = (typeof name === 'string' && name.trim()) ? name.trim() : 'Formula senza titolo';
  const cleanBase = base.replace(/\s+\(copia(?:\s+\d+)?\)$/i, '');
  const existingNames = new Set(state.formulas.map((item) => item.name));
  let counter = 1;
  let candidate = `${cleanBase} (copia)`;
  while (existingNames.has(candidate)) {
    counter += 1;
    candidate = `${cleanBase} (copia ${counter})`;
  }
  return candidate;
}

function duplicateFormula(id) {
  const formula = state.formulas.find((item) => item.id === id);
  if (!formula) return;
  const clone = normaliseStoredFormula({
    ...formula,
    id: `formula-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: buildDuplicateName(formula.name),
    materials: Array.isArray(formula.materials)
      ? formula.materials.map((material) => normaliseStoredMaterial(material))
      : [],
    updatedAt: new Date().toISOString()
  });
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

function ensureExportableFormula() {
  hydrateStateFromForm();
  if (!state.materials.length || !hasExportableMaterials()) {
    alert('Aggiungi almeno una nota o un valore prima di esportare.');
    return null;
  }
  return collectFormula();
}

function exportFormulaAsPdf() {
  const formula = ensureExportableFormula();
  if (!formula) return;
  const jspdf = window.jspdf;
  if (!jspdf || typeof jspdf.jsPDF !== 'function') {
    alert('Impossibile generare il PDF: libreria non disponibile.');
    return;
  }
  const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text('Parfum Formulator', 40, 50);

  doc.setFontSize(14);
  doc.text(`Formula: ${formula.name}`, 40, 80);

  const metaStartY = 100;
  const meta = [
    `Tipologia: ${formula.type}`,
    `Lotto (g): ${formatter.format(formula.batchWeight)}`,
    `Densità media (g/ml): ${formatter.format(formula.density)}`,
    `Ultimo aggiornamento: ${new Date(formula.updatedAt).toLocaleString('it-IT')}`
  ];

  doc.setFontSize(11);
  meta.forEach((line, index) => {
    doc.text(line, 40, metaStartY + index * 16);
  });

  const startY = metaStartY + meta.length * 16 + 20;
  const tableRows = formula.materials.map((material, index) => [
    index + 1,
    material.note || '-',
    formatter.format(safeNumber(material.grams)),
    formatter.format(safeNumber(material.ml)),
    formatter.format(safeNumber(material.drops)),
    formatter.format(safeNumber(material.percent)),
    formatter.format(safeNumber(material.dilution))
  ]);

  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      head: [['#', 'Nota', 'Grammi', 'ml', 'Gocce', '%', 'Diluizione %']],
      body: tableRows,
      startY,
      styles: { font: 'helvetica', fontSize: 10 },
      headStyles: { fillColor: [52, 58, 64] }
    });
  } else {
    let y = startY;
    doc.setFontSize(12);
    doc.text('# Nota | g | ml | gocce | % | diluizione', 40, y);
    y += 18;
    doc.setFontSize(10);
    tableRows.forEach((row) => {
      doc.text(row.join(' | '), 40, y);
      y += 14;
    });
  }

  const filename = `${slugify(formula.name || 'formula') || 'formula'}.pdf`;
  doc.save(filename);
}

function exportFormulaAsExcel() {
  const formula = ensureExportableFormula();
  if (!formula) return;
  if (typeof window.XLSX === 'undefined') {
    alert('Impossibile generare il file Excel: libreria non disponibile.');
    return;
  }

  const workbook = window.XLSX.utils.book_new();
  const header = [
    ['Formula', formula.name],
    ['Tipologia', formula.type],
    ['Lotto (g)', safeNumber(formula.batchWeight)],
    ['Densità media (g/ml)', safeNumber(formula.density)],
    ['Ultimo aggiornamento', new Date(formula.updatedAt).toLocaleString('it-IT')],
    [],
    ['#', 'Nota', 'Grammi', 'ml', 'Gocce', '%', 'Diluizione %']
  ];
  const rows = formula.materials.map((material, index) => [
    index + 1,
    material.note || '',
    safeNumber(material.grams),
    safeNumber(material.ml),
    safeNumber(material.drops),
    safeNumber(material.percent),
    safeNumber(material.dilution)
  ]);

  const worksheet = window.XLSX.utils.aoa_to_sheet([...header, ...rows]);
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Formula');

  const filename = `${slugify(formula.name || 'formula') || 'formula'}.xlsx`;
  window.XLSX.writeFile(workbook, filename);
}

function hydrateStateFromForm() {
  state.materials = Array.from(materialsTable.querySelectorAll('.material-row')).map((row) => {
    const id = row.dataset.id || uid();
    const material = normaliseStoredMaterial({
      note: row.querySelector('.note-input').value,
      grams: parseNumber(row.querySelector('.grams-input').value),
      ml: parseNumber(row.querySelector('.ml-input').value),
      drops: parseNumber(row.querySelector('.drops-input').value),
      percent: parseNumber(row.querySelector('.percent-input').value),
      dilution: parseNumber(row.querySelector('.dilution-input').value || '100')
    });
    return {
      id,
      ...material
    };
  });
}

function initEvents() {
  addMaterialBtn.addEventListener('click', () => addMaterial());
  clearMaterialsBtn.addEventListener('click', clearMaterials);
  batchWeightInput.addEventListener('input', () => updateBatchOutputs());
  densityInput.addEventListener('input', () => updateBatchOutputs());
  saveFormulaBtn.addEventListener('click', () => {
    hydrateStateFromForm();
    saveFormula();
  });
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportFormulaAsPdf);
  }
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportFormulaAsExcel);
  }
  newFormulaBtn.addEventListener('click', resetFormula);
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  if (customNoteForm) {
    customNoteForm.addEventListener('submit', handleCustomNoteSubmit);
  }
  if (resetCustomNoteBtn) {
    resetCustomNoteBtn.addEventListener('click', () => resetCustomNoteForm());
  }
}

function init() {
  applyTheme(getStoredTheme());
  renderCustomNoteControls();
  loadCustomNotes();
  loadNoteLibrary();
  renderCustomNotes();
  loadLibrary();
  renderLibrary();
  addInitialRows();
  initEvents();
  updateBatchOutputs();
  updateInsights();
}

init();
