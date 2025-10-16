// assets/batch-mixer.js
(() => {
  // --- Config diluenti (puoi estendere) ---
  const DILUENTS = [
    { key: "ethanol_96", name: "Ethanol 96°", group: "Solvente", density: 0.809, neutral: true },
    { key: "dpg",        name: "DPG (Dipropylene Glycol)", group: "Diluente", density: 1.02, neutral: true },
    { key: "tec",        name: "TEC (Trietil Citrato)",    group: "Diluente", density: 1.14, neutral: true },
    { key: "ipm",        name: "IPM (Isopropyl Myristate)",group: "Diluente", density: 0.85, neutral: true },
    { key: "decanol",    name: "Decanolo",                 group: "Modificatore", density: 0.83, neutral: false },
  ];
  const TYPE_RANGE = { EDC:[2,6], EDT:[8,12], EDP:[12,20], Extrait:[20,40] };

  // --- Stato ---
  let batchMl = 10;
  let juiceType = "EDP";
  let items = []; // {id,type:'note'|'diluent',name,ml,dilution?}
  let selectedDils = []; // {key,name,percent}
  let autoFill = true;

  // --- Helpers DOM ---
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const pretty = n => Number(n.toFixed(2));
  const id = () => Math.random().toString(36).slice(2,9);

  // --- Riferimenti ---
  const root = $("#batch-mixer");
  const inpBatch = $("#bm-batch");
  const btnTypes = $$("#bm-types button");
  const barFill = $("#bm-bar-fill");
  const txtConc  = $("#bm-conc");
  const txtTotal = $("#bm-total");
  const txtRemain= $("#bm-remaining");
  const tblBody  = $("#bm-rows");
  const noteName = $("#bm-note-name");
  const noteMl   = $("#bm-note-ml");
  const btnAddNote = $("#bm-add-note");
  const btnOpenDil = $("#bm-open-diluent");
  const modal = $("#bm-modal");
  const modalMask = $("#bm-modal-mask");
  const dilGrid = $("#bm-diluent-grid");
  const autoFillSwitch = $("#bm-autofill");
  const splitBox = $("#bm-split-box");
  const splitRows = $("#bm-split-rows");
  const btnEven = $("#bm-even");
  const btnConfirm = $("#bm-confirm");
  const btnCancel  = $("#bm-cancel");
  const rangeHint  = $("#bm-range-hint");

  // --- Init diluent grid ---
  DILUENTS.forEach(d=>{
    const b=document.createElement("button");
    b.className="bm-dil-card";
    b.dataset.key=d.key; b.dataset.name=d.name;
    b.innerHTML = `<div class="bm-dil-name">${d.name}</div>
      <div class="bm-dil-sub">${d.group} • densità ${d.density}</div>`;
    b.addEventListener("click",()=>{
      const i = selectedDils.findIndex(x=>x.key===d.key);
      if(i>=0){ selectedDils.splice(i,1); b.classList.remove("active"); renderSplit(); }
      else { selectedDils.push({key:d.key,name:d.name,percent:0}); b.classList.add("active"); renderSplit(); }
    });
    dilGrid.appendChild(b);
  });

  // --- Eventi base ---
  inpBatch.addEventListener("input", e=>{
    batchMl = Math.max(0, parseFloat(e.target.value || "0"));
    render();
  });
  btnTypes.forEach(b=>{
    b.addEventListener("click", ()=>{
      btnTypes.forEach(x=>x.classList.remove("active"));
      b.classList.add("active"); juiceType = b.dataset.type; render();
    });
  });

  btnAddNote.addEventListener("click", ()=>{
    const name=(noteName.value||"").trim();
    const ml=parseFloat(noteMl.value||"0");
    if(!name || !ml || ml<=0) return;
    items.push({id:id(), type:"note", name, ml, dilution:100});
    noteName.value=""; render();
  });

  tblBody.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-del]");
    if(!btn) return;
    const rid = btn.getAttribute("data-del");
    items = items.filter(x=>x.id!==rid);
    render();
  });

  // --- Modal ---
  const openModal=()=>{ modal.classList.add("open"); };
  const closeModal=()=>{
    modal.classList.remove("open");
    selectedDils = []; autoFill = true; autoFillSwitch.checked = true;
    // reset cards
    $$(".bm-dil-card").forEach(c=>c.classList.remove("active"));
    renderSplit();
  };

  btnOpenDil.addEventListener("click", ()=>{
    const remain = remainingMl();
    if(remain <= 0) return;
    openModal();
  });
  modalMask.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);

  autoFillSwitch.addEventListener("change",(e)=>{
    autoFill = e.target.checked; renderSplit();
  });

  btnEven.addEventListener("click", ()=>{
    if(selectedDils.length===0) return;
    const even = 100/selectedDils.length;
    selectedDils = selectedDils.map(d=>({...d, percent: even}));
    renderSplit();
  });

  btnConfirm.addEventListener("click", ()=>{
    const remain = remainingMl();
    if(remain<=0) return;

    let plan = selectedDils.length ? [...selectedDils] : [{key:"ethanol_96",name:"Ethanol 96°",percent:100}];
    // normalize %
    const sum = plan.reduce((a,b)=>a+(b.percent||0),0) || 100;
    plan = plan.map(p=>({...p, percent: (p.percent/sum)*100}));

    plan.forEach(p=>{
      const d = DILUENTS.find(x=>x.key===p.key);
      items.push({
        id:id(), type:"diluent", name: d?d.name:p.name, ml: remain*(p.percent/100)
      });
    });
    render(); closeModal();
  });

  splitRows.addEventListener("input",(e)=>{
    const li = e.target.closest("[data-k]");
    if(!li) return;
    const key = li.getAttribute("data-k");
    const idx = selectedDils.findIndex(x=>x.key===key);
    if(idx<0) return;
    const val = Math.max(0, Math.min(100, parseFloat(e.target.value||"0")));
    selectedDils[idx].percent = val;
    renderSplit();
  });

  // --- Calcoli ---
  const concMl = () => items.filter(i=>i.type==="note").reduce((a,b)=>a+b.ml,0);
  const dilMl  = () => items.filter(i=>i.type==="diluent").reduce((a,b)=>a+b.ml,0);
  const totalMl= () => concMl()+dilMl();
  const remainingMl = () => Math.max(0, batchMl - totalMl());

  // --- Render principali ---
  function render(){
    const cMl = concMl();
    const tMl = totalMl();
    const rem = remainingMl();
    const pct = batchMl>0 ? (cMl/batchMl)*100 : 0;

    // header
    txtConc.textContent = `${pretty(cMl)} mL (${pretty(pct)}%)`;
    txtTotal.textContent = `${pretty(tMl)} / ${batchMl} mL`;
    txtRemain.textContent= `${pretty(rem)} mL`;

    // barra
    barFill.style.width = `${Math.min(100,pct)}%`;
    const [min,max]=TYPE_RANGE[juiceType];
    barFill.classList.toggle("ok", pct>=min && pct<=max);
    barFill.classList.toggle("warn", !(pct>=min && pct<=max));
    rangeHint.textContent = `Range consigliato per ${juiceType}: ${min}% – ${max}%`;

    // tabella
    tblBody.innerHTML = items.length? "" : `<tr><td colspan="4" class="bm-empty">Nessun ingrediente ancora.</td></tr>`;
    items.forEach(i=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td class="name">${i.name}</td>
        <td class="type">${i.type==="note"?"Nota":"Diluente"}</td>
        <td class="ml">${pretty(i.ml)}</td>
        <td class="act"><button class="bm-del" data-del="${i.id}" title="Rimuovi">✕</button></td>
      `;
      tblBody.appendChild(tr);
    });
  }

  function renderSplit(){
    if(autoFill || selectedDils.length===0){ splitBox.style.display="none"; return; }
    splitBox.style.display="block";
    const rem = remainingMl();
    splitRows.innerHTML = "";
    selectedDils.forEach(d=>{
      const li=document.createElement("div");
      li.className="bm-split-row"; li.setAttribute("data-k", d.key);
      const ml = rem * (d.percent/100);
      li.innerHTML = `
        <div class="bm-split-name">${d.name}</div>
        <div class="bm-split-ml">${pretty(ml)} mL</div>
        <div class="bm-split-input"><input type="number" min="0" max="100" step="1" value="${d.percent||0}"> <span>%</span></div>
      `;
      splitRows.appendChild(li);
    });
  }

  // espone funzioni utili se servono altrove
  window.ParfumMixer = {
    addNote: (name, ml, dilution=100)=>{ items.push({id:id(),type:"note",name,ml,dilution}); render(); },
    getState: ()=>({ batchMl, juiceType, items }),
  };

  // primo render
  render();
})();
