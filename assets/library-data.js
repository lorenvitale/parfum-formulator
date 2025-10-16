// assets/library-data.js
// Estendi liberamente questo array: aggiungi tutto ciò che vuoi.
// Campi minimi: name, group; consigliati: families, pyramid.
export const MASTER_LIBRARY = [
  // Oli essenziali
  { name: "Lavanda EO", group: "Olio essenziale", families: ["Aromatica","Fiorita"], pyramid: ["Testa","Cuore"] },
  { name: "Bergamotto FCF", group: "Olio essenziale", families: ["Agrumata","Aromatica"], pyramid: ["Testa"] },
  { name: "Patchouli", group: "Olio essenziale", families: ["Legnosa","Terrosa"], pyramid: ["Fondo"] },

  // Assolute / CO2
  { name: "Assoluta di Rosa", group: "Assoluta", families: ["Fiorita"], pyramid: ["Cuore"] },
  { name: "Gelsomino CO2", group: "CO2", families: ["Fiorita"], pyramid: ["Cuore"] },

  // Tinture
  { name: "Tintura di Vaniglia (EtOH)", group: "Tintura", families: ["Gourmand","Dolce"], pyramid: ["Fondo"] },
  { name: "Tintura di Labdano (EtOH)", group: "Tintura", families: ["Ambrata","Resinosa"], pyramid: ["Fondo"] },

  // Burri & cere
  { name: "Burro di Karité", group: "Burro/Cera", families: ["Lattata","Morbida"], pyramid: ["Fondo"] },

  // Acque aromatiche / idrolati
  { name: "Acqua di Rosa (Idrolato)", group: "Acqua aromatica", families: ["Fiorita"], pyramid: ["Testa","Cuore"] },

  // Solventi / veicoli (esclusi dalla piramide olfattiva)
  { name: "Etanolo 96°", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["diluente","veicolo","standard profumeria"] },
  { name: "DPG", group: "Solvente", families: ["Pulita"], pyramid: [], use: ["diluente","co-solvente","fissante lieve"] },
  { name: "Trietil Citrato (TEC)", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["diluente","co-solvente","stabilizzante esteri"] },
  { name: "Propylene Glycol (PG)", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["diluente","umettante","co-solubilizzante"] },
  { name: "Isopropyl Myristate (IPM)", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["diluente","veicolo oleoso","ammorbidente scia"] },
  { name: "Trigliceridi Caprilico/Caprico (MCT)", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["veicolo Jojoba-like","olio secco","fixing"] },
  { name: "Benzyl Benzoate", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["solvente alto-boiling","fissante","co-solubilizzante"], regulatory: ["EU:allergen"] },
  { name: "Transcutol (DEGEE)", group: "Solvente", families: ["Neutra"], pyramid: [], use: ["penetrazione/trascinamento","co-solvente"] },
  { name: "PEG-40 Hydrogenated Castor Oil", group: "Solubilizzante", families: ["Neutra"], pyramid: [], use: ["solubilizzante acqua/alcol","tensioattivo non ionico"] },
  { name: "Polysorbate-20 (Tween 20)", group: "Solubilizzante", families: ["Neutra"], pyramid: [], use: ["solubilizzante acqua/alcol","tensioattivo non ionico"] },

  // Esempio aggiuntivo di ingrediente per continuità
  { name: "Benzoino Italiano (Styrax officinalis)", group: "Balsamica", families: ["Balsamica","Vanigliata","Resinosa"], pyramid: ["Base"] }
];
