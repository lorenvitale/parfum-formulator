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
const libraryList = document.getElementById('libraryList');
const newFormulaBtn = document.getElementById('newFormulaBtn');
const formulaNameInput = document.getElementById('formulaName');
const formulaTypeSelect = document.getElementById('formulaType');

const DROPS_PER_ML = 20;
const STORAGE_KEY = 'parfum-formulator__formulas';

const NOTE_INDEX = new Map(NOTES_DATA.map((note) => [normaliseName(note.name), note]));
const DEFAULT_LEVELS = DEFAULT_PYRAMID;

let syncing = false;

const state = {
  materials: [],
  formulas: [],
  editingId: null
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

function uid() {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadNoteLibrary() {
  noteLibrary.innerHTML = '';
  const fragment = document.createDocumentFragment();
  NOTES_DATA.sort((a, b) => a.name.localeCompare(b.name, 'it')).forEach((note) => {
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
  const dilutionInput = clone.querySelector('.dilution-input');
  const mlInput = clone.querySelector('.ml-input');
  const dropsInput = clone.querySelector('.drops-input');
  const percentInput = clone.querySelector('.percent-input');
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

  dilutionInput.addEventListener('input', (event) => {
    if (syncing) return;
    const inputValue = event.target.value;
    const rawValue = inputValue === '' ? 100 : parseNumber(inputValue);
    const safeRaw = Number.isFinite(rawValue) ? rawValue : 100;
    const dilution = Math.max(0, Math.min(100, safeRaw));
    event.target.value = dilution.toString();
    updateMaterial(material.id, { dilution });
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
  row.querySelector('.note-input').value = material.note || '';
  row.querySelector('.grams-input').value = material.grams ? material.grams.toFixed(2) : '';
  const dilutionValue = Number.isFinite(material.dilution) ? material.dilution : 100;
  row.querySelector('.dilution-input').value = dilutionValue.toString();
  row.querySelector('.ml-input').value = material.ml ? material.ml.toFixed(2) : '';
  row.querySelector('.drops-input').value = material.drops ? Math.round(material.drops) : '';
  row.querySelector('.percent-input').value = material.percent ? material.percent.toFixed(2) : '';
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
  return {
    id: state.editingId ?? `formula-${Date.now()}`,
    name: formulaNameInput.value.trim() || 'Formula senza titolo',
    type: formulaTypeSelect.value,
    batchWeight,
    density,
    materials: state.materials.map(
      ({ id, note, grams, ml, drops, percent, dilution = 100 }) => ({
        note,
        grams,
        ml,
        drops,
        percent,
        dilution
      })
    ),
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
  state.formulas = state.formulas.map((formula) => ({
    ...formula,
    materials: formula.materials.map((material) => {
      const numericDilution = Number(material.dilution);
      return {
        ...material,
        dilution: Number.isFinite(numericDilution) ? numericDilution : 100
      };
    })
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formulas));
}

function loadLibrary() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.formulas = parsed.map((formula) => ({
        ...formula,
        materials: Array.isArray(formula.materials)
          ? formula.materials.map((material) => {
              const numericDilution = Number(material.dilution);
              return {
                ...material,
                dilution: Number.isFinite(numericDilution) ? numericDilution : 100
              };
            })
          : []
      }));
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
  state.materials = formula.materials.map((material) => {
    const { dilution = 100, ...rest } = material;
    const numericDilution = Number.isFinite(Number(dilution)) ? Number(dilution) : 100;
    return { ...rest, dilution: numericDilution, id: uid() };
  });
  state.materials.forEach((material) => createMaterialRow(material));
  updateBatchOutputs();
}

function duplicateFormula(id) {
  const formula = state.formulas.find((item) => item.id === id);
  if (!formula) return;
  const clone = {
    ...formula,
    id: `formula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${formula.name} (copia)`
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${formula.name.replace(/\s+/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function hydrateStateFromForm() {
  state.materials = Array.from(materialsTable.querySelectorAll('.material-row')).map((row) => {
    const id = row.dataset.id || uid();
    const dilutionField = row.querySelector('.dilution-input');
    const dilutionRaw = dilutionField ? dilutionField.value : '100';
    const parsedDilution = dilutionRaw === '' ? 100 : parseNumber(dilutionRaw);
    const dilution = Math.max(
      0,
      Math.min(100, Number.isFinite(parsedDilution) ? parsedDilution : 100)
    );
    return {
      id,
      note: row.querySelector('.note-input').value,
      grams: parseNumber(row.querySelector('.grams-input').value),
      ml: parseNumber(row.querySelector('.ml-input').value),
      drops: parseNumber(row.querySelector('.drops-input').value),
      percent: parseNumber(row.querySelector('.percent-input').value),
      dilution
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

init();
