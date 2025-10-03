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
const exportFormulaBtn = document.getElementById('exportFormulaBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const libraryList = document.getElementById('libraryList');
const newFormulaBtn = document.getElementById('newFormulaBtn');
const themeToggle = document.getElementById('themeToggle');
const formulaNameInput = document.getElementById('formulaName');
const formulaTypeSelect = document.getElementById('formulaType');

const DROPS_PER_ML = 20;
const STORAGE_KEY = 'parfum-formulator__formulas';
const THEME_STORAGE_KEY = 'parfum-formulator__theme';

const { index: NOTE_INDEX, list: NOTE_LIBRARY } = buildNoteCatalog(NOTES_DATA);
const DEFAULT_LEVELS = DEFAULT_PYRAMID;
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

function readStoredTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch (error) {
    return null;
  }
}

function storeThemePreference(theme) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Ignora errori di salvataggio (es. storage pieno o disabilitato)
  }
}

function getPreferredTheme() {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (themeMediaQuery) {
    return themeMediaQuery.matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme(theme) {
  const selected = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = selected;
  if (themeToggle) {
    const isDark = selected === 'dark';
    themeToggle.setAttribute('aria-checked', String(isDark));
    themeToggle.setAttribute(
      'aria-label',
      isDark ? 'Attiva modalità chiara' : 'Attiva modalità scura'
    );
    themeToggle.setAttribute(
      'title',
      isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'
    );
  }
}

function initTheme() {
  applyTheme(getPreferredTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      storeThemePreference(nextTheme);
      applyTheme(nextTheme);
    });
  }

  if (themeMediaQuery) {
    themeMediaQuery.addEventListener('change', (event) => {
      if (readStoredTheme()) return;
      applyTheme(event.matches ? 'dark' : 'light');
    });
  }
}

function getMaterial(id) {
  return state.materials.find((item) => item.id === id);
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
  return value.toString().trim().toLowerCase();
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
    ? name
        .toString()
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
    : '';
  const safeBase = base || 'formula';
  return `${safeBase}.${extension}`;
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

      families.forEach((family) => {
        if (!existing.families.includes(family)) {
          existing.families.push(family);
        }
      });

      pyramid.forEach((level) => {
        if (!existing.pyramid.includes(level)) {
          existing.pyramid.push(level);
        }
      });
    } else {
      const entry = {
        name: note.name,
        families: [...families],
        pyramid: [...pyramid]
      };

      index.set(key, entry);
      list.push(entry);
    }
  });

  list.sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return { index, list };
}

function uid() {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadNoteLibrary() {
  noteLibrary.innerHTML = '';
  const fragment = document.createDocumentFragment();
  NOTE_LIBRARY.forEach((note) => {
    const option = document.createElement('option');
    option.value = note.name;
    fragment.appendChild(option);
  });
  noteLibrary.appendChild(fragment);
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
    const grams = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'grams', grams));
  });

  mlInput.addEventListener('input', (event) => {
    if (syncing) return;
    const ml = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'ml', ml));
  });

  dropsInput.addEventListener('input', (event) => {
    if (syncing) return;
    const drops = parseNumber(event.target.value);
    const current = getMaterial(material.id) ?? material;
    updateMaterial(material.id, recalcMaterial(current, 'drops', drops));
  });

  percentInput.addEventListener('input', (event) => {
    if (syncing) return;
    const percent = parseNumber(event.target.value);
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
  const normalised = normaliseName(noteName);
  return NOTE_INDEX.get(normalised) || null;
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
  if (totalWeight) {
  // conversione: se rating è su 5, lo porto su scala 10
  const value10 = Math.round((rating / 5) * 10);
  window.setBalanceScore(value10);
} else {
  scoreValue.textContent = '-';
  window.updateBalanceGauge?.(1); // reset gauge al minimo
}


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
  return {
    id: state.editingId ?? `formula-${Date.now()}`,
    name: formulaNameInput.value.trim() || 'Formula senza titolo',
    type: formulaTypeSelect.value,
    batchWeight,
    density,
    materials: state.materials.map(({ id, ...material }) => material),
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formulas));
}

function loadLibrary() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.formulas = parsed;
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
  state.materials = formula.materials.map((material) => ({ ...material, id: uid() }));
  state.materials.forEach((material) => createMaterialRow(material));
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
    materials: formula.materials.map((item) => ({ ...item }))
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

function computeMaterialTotals(materials) {
  return materials.reduce(
    (acc, item) => {
      const grams = Number(item.grams) || 0;
      const ml = Number(item.ml) || 0;
      const drops = Number(item.drops) || 0;
      const percent = Number(item.percent) || 0;
      return {
        grams: acc.grams + grams,
        ml: acc.ml + ml,
        drops: acc.drops + drops,
        percent: acc.percent + percent
      };
    },
    { grams: 0, ml: 0, drops: 0, percent: 0 }
  );
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
    .map(
      ([label, value]) =>
        `<tr><th style="text-align:left;background:#eef1ff;padding:8px 12px;">${escapeHtml(
          label
        )}</th><td style="padding:8px 12px;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const materialsHeader =
    '<tr style="background:#f7f7fb;font-weight:600;">' +
    ['Nota', 'Grammi', 'Millilitri', 'Gocce', '%', 'Diluizione (%)']
      .map((heading) => `<th style="padding:8px 12px;border-bottom:1px solid #dcdfee;text-align:left;">${escapeHtml(heading)}</th>`)
      .join('') +
    '</tr>';

  const materialsRows = formula.materials
    .map((material) => {
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
        cells
          .map(
            (value) =>
              `<td style="padding:6px 12px;border-bottom:1px solid #eef0f7;vertical-align:top;">${escapeHtml(value)}</td>`
          )
          .join('') +
        '</tr>'
      );
    })
    .join('');

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
      .map(
        (value, index) =>
          `<td style="padding:8px 12px;font-weight:${index === 0 ? 600 : 500};background:#f3f4f9;">${escapeHtml(
            value
          )}</td>`
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
    ${materialsRows ||
      '<tr><td colspan="6" style="padding:12px;text-align:center;color:#6b6b7c;">Nessuna materia prima registrata.</td></tr>'}
    ${formula.materials.length ? totalsRow : ''}
  </table>
</body>
</html>`;

  const blob = new Blob([htmlDocument], { type: 'application/vnd.ms-excel' });
  downloadFile(blob, buildSafeFileName(formula.name, 'xls'));
}

function sanitizePdfText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
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
  xref += offsets
    .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
    .join('');
  if (!xref.endsWith('\n')) {
    xref += '\n';
  }

  const startXref = position;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  const xrefBytes = encoder.encode(xref);
  const trailerBytes = encoder.encode(trailer);

  const totalLength = headerBytes.length +
    chunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    xrefBytes.length +
    trailerBytes.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  buffer.set(headerBytes, offset);
  offset += headerBytes.length;
  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.length;
  });
  buffer.set(xrefBytes, offset);
  offset += xrefBytes.length;
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
      lines.push(
        `${index + 1}. ${note} · ${grams} g · ${percent}% · diluizione ${dilution}%`
      );
    });
  } else {
    lines.push('Nessuna materia prima registrata.');
  }

  lines.push('');
  lines.push(
    `Totale: ${formatDecimal(totals.grams, 2)} g · ${formatDecimal(totals.percent, 2)}% · ${formatDecimal(
      Math.round(totals.drops),
      0
    )} gocce`
  );
  lines.push(`Generato il: ${new Date().toLocaleString('it-IT')}`);

  const blob = generatePdfBlob(lines);
  downloadFile(blob, buildSafeFileName(formula.name, 'pdf'));
}

function hydrateStateFromForm() {
  state.materials = Array.from(materialsTable.querySelectorAll('.material-row')).map((row) => {
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

function initEvents() {
  addMaterialBtn.addEventListener('click', () => addMaterial());
  clearMaterialsBtn.addEventListener('click', clearMaterials);
  batchWeightInput.addEventListener('input', () => updateBatchOutputs());
  densityInput.addEventListener('input', () => updateBatchOutputs());
  saveFormulaBtn.addEventListener('click', () => {
    hydrateStateFromForm();
    saveFormula();
  });
  exportFormulaBtn.addEventListener('click', exportFormula);
  exportExcelBtn.addEventListener('click', exportFormulaExcel);
  exportPdfBtn.addEventListener('click', exportFormulaPdf);
  newFormulaBtn.addEventListener('click', resetFormula);
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

initTheme();
init();
// --- Tachimetro: sincronizzazione automatica con #scoreValue ---
// Si appoggia all'API globale definita in index.html: window.updateBalanceGauge(score)

(function () {
  const scoreEl = document.getElementById('scoreValue');
  if (!scoreEl) return;

  // Converte il testo in numero 1..10 e aggiorna il gauge
  function syncGaugeFromText() {
    const raw = (scoreEl.textContent || '').trim().replace(',', '.');
    const n = Math.max(1, Math.min(10, Number(raw)));
    if (!Number.isFinite(n)) return;
    window.updateBalanceGauge?.(n);
  }

  // Osserva qualsiasi cambio di testo (anche fatto dal tuo codice attuale)
  const mo = new MutationObserver(syncGaugeFromText);
  mo.observe(scoreEl, { childList: true, characterData: true, subtree: true });

  // Primo allineamento (se c'è già un valore)
  syncGaugeFromText();

  // Helper opzionale: usa questa funzione ovunque al posto di scoreEl.textContent = ...
  // Così aggiorni UI + gauge con una sola riga.
  window.setBalanceScore = function (value) {
    const n = Math.max(1, Math.min(10, Math.round(Number(value) || 1)));
    scoreEl.textContent = String(n);
    window.updateBalanceGauge?.(n);
  };
})();
