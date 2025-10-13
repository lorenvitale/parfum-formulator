// assets/library-data.js
// Estendi liberamente questo array: aggiungi tutto ciò che vuoi.
// Campi minimi: name, group; consigliati: families, pyramid.
export const MASTER_LIBRARY = [
  // Oli essenziali
  { name: "Lavanda Fine", group: "Olio essenziale", families: ["Aromatica","Fiorita"], pyramid: ["Testa","Cuore"] },
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

  // Solventi / veicoli (se vuoi mostrarli a catalogo)
  { name: "Etanolo 96°", group: "Solvente", families: ["Pulita","Moderna"], pyramid: ["Testa","Fondo"] },
  { name: "DPG", group: "Solvente", families: ["Pulita"], pyramid: ["Fondo"] },
];
