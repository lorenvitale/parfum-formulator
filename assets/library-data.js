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

  { name: "Tintura di legno di carrubo", group: "Tintura", families: ["Legnosa", "Balsamica"], pyramid: ["Fondo"] },
{ name: "Tintura di foglie di noce", group: "Tintura", families: ["Verde", "Erbacea"], pyramid: ["Cuore", "Fondo"] },
{ name: "Helional", group: "Sintetico", families: ["Fiorita", "Aldeidica", "Marina"], pyramid: ["Testa", "Cuore"] },
{ name: "Indolo", group: "Sintetico", families: ["Animalica", "Fiorita"], pyramid: ["Fondo"] },
{ name: "Tibettolide", group: "Sintetico", families: ["Muschio", "Pulita", "Ambrata"], pyramid: ["Fondo"] },
{ name: "Etilene brassolato", group: "Sintetico", families: ["Muschio", "Ambrata"], pyramid: ["Fondo"] },
{ name: "Isoamyl salicilato", group: "Sintetico", families: ["Floreale", "Verde"], pyramid: ["Cuore"] },
{ name: "Methyl ionone gamma", group: "Sintetico", families: ["Fiorita", "Legnosa"], pyramid: ["Cuore", "Fondo"] },
{ name: "Hedione HC", group: "Sintetico", families: ["Fiorita", "Trasparente"], pyramid: ["Cuore"] },
{ name: "Exaltolide", group: "Sintetico", families: ["Muschio", "Pulita"], pyramid: ["Fondo"] },
{ name: "Okoumal", group: "Sintetico", families: ["Legnosa", "Ambrata"], pyramid: ["Fondo"] },
{ name: "Velvione", group: "Sintetico", families: ["Muschio", "Pulita"], pyramid: ["Fondo"] },
{ name: "Fixolide", group: "Sintetico", families: ["Muschio", "Pulita"], pyramid: ["Fondo"] },
{ name: "Ambrettolide", group: "Sintetico", families: ["Muschio", "Ambrata"], pyramid: ["Fondo"] },
{ name: "Ambrox Super", group: "Sintetico", families: ["Ambrata", "Legnosa"], pyramid: ["Fondo"] },
{ name: "Geosmina", group: "Sintetico", families: ["Terrosa", "Verde"], pyramid: ["Fondo"] },
{ name: "Cyclopentadecanolide", group: "Sintetico", families: ["Muschio", "Dolce"], pyramid: ["Fondo"] },
{ name: "Cetalox", group: "Sintetico", families: ["Ambrata", "Legnosa"], pyramid: ["Fondo"] },
{ name: "Iso E Super Plus", group: "Sintetico", families: ["Legnosa", "Ambrata"], pyramid: ["Cuore", "Fondo"] },
{ name: "Cashmeran", group: "Sintetico", families: ["Ambrata", "Legnosa", "Muschio"], pyramid: ["Fondo"] },
{ name: "Suederal", group: "Sintetico", families: ["Cuoiata", "Animalica"], pyramid: ["Fondo"] },
{ name: "Aldehyde C-10", group: "Sintetico", families: ["Aldeidica", "Citrica"], pyramid: ["Testa"] },
{ name: "Aldehyde C-12 MNA", group: "Sintetico", families: ["Aldeidica", "Fresca"], pyramid: ["Testa"] },
{ name: "Aldehyde C-11 undecylenic", group: "Sintetico", families: ["Aldeidica", "Marina"], pyramid: ["Testa"] },
{ name: "Phenyl Ethyl Alcohol", group: "Sintetico", families: ["Fiorita", "Rosa"], pyramid: ["Cuore"] },
{ name: "Hydroxycitronellal", group: "Sintetico", families: ["Fiorita", "Fresca"], pyramid: ["Cuore"] },
{ name: "Lyral", group: "Sintetico", families: ["Fiorita", "Fresca"], pyramid: ["Cuore"] },
{ name: "Ethyl Maltol", group: "Sintetico", families: ["Gourmand", "Dolce"], pyramid: ["Fondo"] },
{ name: "Vanitrope", group: "Sintetico", families: ["Gourmand", "Vanigliata"], pyramid: ["Fondo"] },
{ name: "Karanal", group: "Sintetico", families: ["Ambrata", "Legnosa"], pyramid: ["Fondo"] },
{ name: "Timberol", group: "Sintetico", families: ["Legnosa", "Ambrata"], pyramid: ["Fondo"] },
{ name: "Moxalone", group: "Sintetico", families: ["Muschio", "Pulita"], pyramid: ["Fondo"] },
{ name: "Ambermax", group: "Sintetico", families: ["Ambrata", "Legnosa"], pyramid: ["Fondo"] },
{ name: "Z11", group: "Sintetico", families: ["Legnosa", "Secca"], pyramid: ["Fondo"] },
{ name: "Rosaphen", group: "Sintetico", families: ["Fiorita", "Rosa"], pyramid: ["Cuore"] },
{ name: "Peonile", group: "Sintetico", families: ["Fiorita", "Fresca"], pyramid: ["Cuore"] },
{ name: "Magnolan", group: "Sintetico", families: ["Fiorita", "Fresca"], pyramid: ["Cuore"] },
{ name: "Floralozone", group: "Sintetico", families: ["Marina", "Ozonic"], pyramid: ["Testa"] },
{ name: "Undecavertol", group: "Sintetico", families: ["Verde", "Erbacea"], pyramid: ["Testa", "Cuore"] },
{ name: "Stemone", group: "Sintetico", families: ["Verde", "Fruttata"], pyramid: ["Cuore"] },
{ name: "Precyclemone B", group: "Sintetico", families: ["Marina", "Aldeidica"], pyramid: ["Testa"] },
{ name: "Cis-3-Hexenol", group: "Sintetico", families: ["Verde", "Erbacea"], pyramid: ["Testa"] },
{ name: "Methyl Pamplemousse", group: "Sintetico", families: ["Agrumata", "Fruttata"], pyramid: ["Testa"] },
{ name: "Allyl Amyl Glycolate", group: "Sintetico", families: ["Fruttata", "Tropicale"], pyramid: ["Testa"] },
{ name: "Galaxolide 50 DEP", group: "Sintetico", families: ["Muschio", "Pulita"], pyramid: ["Fondo"] },
{ name: "Ambrofix", group: "Sintetico", families: ["Ambrata", "Legnosa"], pyramid: ["Fondo"] },
{ name: "Benzoin resinoide", group: "Assoluta", families: ["Balsamica", "Dolce"], pyramid: ["Fondo"] },
{ name: "Labdanum absolute", group: "Assoluta", families: ["Ambrata", "Balsamica"], pyramid: ["Fondo"] },
{ name: "Tolu balsam", group: "Resina", families: ["Balsamica", "Dolce"], pyramid: ["Fondo"] },
{ name: "Opoponax resinoide", group: "Resina", families: ["Balsamica", "Ambrata"], pyramid: ["Fondo"] },
{ name: "Styrax resinoide", group: "Resina", families: ["Balsamica", "Animalica"], pyramid: ["Fondo"] },
{ name: "Civetone", group: "Sintetico", families: ["Animalica", "Muschio"], pyramid: ["Fondo"] },
{ name: "Habanolide", group: "Sintetico", families: ["Muschio", "Pulita"], pyramid: ["Fondo"] },

];
