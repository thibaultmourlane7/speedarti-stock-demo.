/**
 * Pack global Ángel du module Stock.
 *
 * Règle SpeedArti : enrichir la base Ángel centrale, ne jamais créer une IA ou
 * une base de connaissances concurrente.
 */

export const ANGEL_STOCK_KNOWLEDGE_VERSION = "stock@1.1.0" as const;

export const ANGEL_STOCK_INTENTS = [
  "rechercher_produit",
  "connaitre_stock",
  "connaitre_disponibilite",
  "rechercher_emplacement",
  "rechercher_stock_faible",
  "rechercher_ruptures",
  "rechercher_chantier",
  "preparer_entree",
  "preparer_sortie",
  "preparer_transfert",
  "preparer_ajustement",
  "reserver",
  "liberer_reservation",
  "rechercher_chute",
  "rechercher_stock_fournisseur",
] as const;

export const ANGEL_STOCK_VOCABULARY = {
  productFamilies: {
    plaque_platre: ["BA13", "placo", "plaque de plâtre", "plaque de platre"],
    bois_structure: ["chevron", "liteau", "volige", "lambourde", "tasseau", "panne"],
    panneaux: ["OSB", "MDF", "contreplaqué", "contreplaque"],
    fixations: ["vis", "cheville", "chevilles"],
    couverture: ["tuile", "tuiles", "ardoise", "ardoises"],
    isolation: ["isolant", "laine de verre", "laine de roche"],
  },
  packaging: ["sac", "sacs", "boîte", "boite", "boîtes", "boites", "rouleau", "rouleaux", "palette", "palettes"],
  locations: ["dépôt", "depot", "atelier", "camion", "fourgon", "véhicule", "vehicule", "chantier"],
} as const;

export interface AngelStockKnowledge {
  knowledgeId: string;
  domain: "stock";
  version: string;
  title: string;
  content: string;
  source: string;
  status: "CONFIRMED" | "PROPOSED";
  humanValidationRequired: boolean;
}

export const ANGEL_STOCK_RULES: AngelStockKnowledge[] = [
  {
    knowledgeId: "stock.source_of_truth.quantity",
    domain: "stock",
    version: "1.0",
    title: "Source de vérité quantité",
    content: "Les quantités, emplacements, mouvements, réservations et inventaires proviennent du moteur Stock. Ángel ne les invente pas.",
    source: "Règle SpeedArti — Sprint A Stock",
    status: "CONFIRMED",
    humanValidationRequired: false,
  },
  {
    knowledgeId: "stock.action.validation",
    domain: "stock",
    version: "1.0",
    title: "Validation des actions Stock",
    content: "Ángel peut rechercher, expliquer et préparer une action. Toute écriture Stock sensible issue de l'IA reste une proposition jusqu'à validation humaine.",
    source: "Règle SpeedArti — validation humaine",
    status: "CONFIRMED",
    humanValidationRequired: true,
  },
  {
    knowledgeId: "stock.product.matching",
    domain: "stock",
    version: "1.0",
    title: "Correspondance produit",
    content: "Un synonyme métier aide à rechercher mais ne suffit jamais à choisir automatiquement une référence produit unique.",
    source: "Règle anti-hallucination SpeedArti",
    status: "CONFIRMED",
    humanValidationRequired: true,
  },
  {
    knowledgeId: "stock.supplier.separation",
    domain: "stock",
    version: "1.0",
    title: "Stock artisan et disponibilité fournisseur",
    content: "Le stock appartenant à l'artisan et la disponibilité annoncée par un fournisseur sont deux domaines distincts et ne doivent jamais être additionnés ou fusionnés.",
    source: "Architecture Stock SpeedArti",
    status: "CONFIRMED",
    humanValidationRequired: false,
  },
  {
    knowledgeId: "stock.supplier.search_service",
    domain: "stock",
    version: "1.1",
    title: "Recherche fournisseur par service métier",
    content: "Pour une question sur un fournisseur, Ángel interroge SupplierStockService. Ángel ne lit pas directement une table ERP ou fournisseur et restitue référence, fournisseur, disponibilité, statut et fraîcheur sans inventer de donnée manquante.",
    source: "Architecture Stock fournisseurs — Sprint F",
    status: "CONFIRMED",
    humanValidationRequired: false,
  },
  {
    knowledgeId: "stock.offcut.geometry",
    domain: "stock",
    version: "1.0",
    title: "Géométrie exacte des chutes",
    content: "Pour une chute complexe, longueur et largeur de boîte englobante ne suffisent pas à vérifier qu'une pièce tient. Utiliser la géométrie exacte fournie par le moteur de calepinage/découpe.",
    source: "Contrats CALPI V0.3",
    status: "CONFIRMED",
    humanValidationRequired: false,
  },
];

export const ANGEL_STOCK_EXAMPLES = [
  {
    user: "Combien il me reste de BA13 ?",
    intent: "connaitre_stock",
    action: "lecture uniquement",
  },
  {
    user: "Sors 8 chevrons 80 par 70 pour Dupont.",
    intent: "preparer_sortie",
    action: "créer un brouillon structuré puis demander confirmation",
  },
  {
    user: "J'ai reçu 20 sacs de colle.",
    intent: "preparer_entree",
    action: "identifier la référence réelle, préparer l'entrée, demander confirmation",
  },
  {
    user: "Est-ce qu'Idea Bois a du chevron 80x70 ?",
    intent: "rechercher_stock_fournisseur",
    action: "interroger SupplierStockService et répondre avec référence, fournisseur, disponibilité et fraîcheur ; ne jamais assimiler au stock artisan",
  },
] as const;

export function normalizeDimensionExpression(raw: string): { a: number; b: number; unit: "mm" } | null {
  const text = raw.trim().toLowerCase().replace(/,/g, ".").replace(/[×x/]/g, " par ");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mm\s*)?par\s*(\d+(?:\.\d+)?)\s*(mm)?/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Ne pas transformer 8x7 en 80x70 : aucune inférence d'échelle implicite.
  return { a, b, unit: "mm" };
}
