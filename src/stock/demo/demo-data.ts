import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";

/**
 * Jeu de données uniquement destiné à la démo.
 *
 * Les valeurs ci-dessous ne sont jamais utilisées comme règles métier par le moteur.
 * Elles servent uniquement à montrer plusieurs types de conditionnement.
 */
export async function loadBtpDemoData(service: StockApplicationService): Promise<void> {
  const existing = await service.listItemViews();
  if (existing.length > 0) {
    throw new StockDomainError(
      "VALIDATION_REQUIRED",
      "Les exemples BTP peuvent être chargés uniquement dans un stock vide.",
    );
  }

  const depot = await service.initialize();
  const camion = await service.createLocation({ name: "Camion 1", type: "vehicule" });

  const chevron = await service.createItem({
    name: "Chevron pin 70 × 80 — 4 m",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 30,
    locationId: depot.id,
    minimumQuantity: 8,
    internalReference: "DEMO-CH-7080",
    secondary: {
      mode: "length",
      secondaryUnit: "ml",
      lengthMm: 4000,
    },
  });

  await service.createItem({
    name: "Vis bois 5 × 80 — boîte 200",
    family: "fournitures",
    unit: "boite",
    initialQuantity: 4,
    locationId: depot.id,
    minimumQuantity: 1,
    internalReference: "DEMO-VIS-580",
    secondary: {
      mode: "manual",
      secondaryUnit: "piece",
      quantityPerPrimaryUnit: 200,
    },
  });

  await service.createItem({
    name: "OSB 3 — 2500 × 1250 × 18 mm",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 20,
    locationId: depot.id,
    minimumQuantity: 5,
    internalReference: "DEMO-OSB-18",
    secondary: {
      mode: "area",
      secondaryUnit: "m2",
      lengthMm: 2500,
      widthMm: 1250,
    },
  });

  await service.createItem({
    name: "Mortier — sac 25 kg",
    family: "consommables",
    unit: "sac",
    initialQuantity: 8,
    locationId: depot.id,
    minimumQuantity: 3,
    internalReference: "DEMO-MORTIER-25",
    secondary: {
      mode: "manual",
      secondaryUnit: "kg",
      quantityPerPrimaryUnit: 25,
    },
  });

  await service.createItem({
    name: "Membrane — rouleau 25 m",
    family: "materiaux",
    unit: "rouleau",
    initialQuantity: 3,
    locationId: depot.id,
    minimumQuantity: 1,
    internalReference: "DEMO-MEM-25",
    secondary: {
      mode: "manual",
      secondaryUnit: "ml",
      quantityPerPrimaryUnit: 25,
    },
  });

  await service.createItem({
    name: "Mastic toiture",
    family: "consommables",
    unit: "piece",
    initialQuantity: 1,
    locationId: camion.id,
    minimumQuantity: 2,
    internalReference: "DEMO-MASTIC",
  });

  await service.createItem({
    name: "Liteau 27 × 40",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 0,
    locationId: depot.id,
    minimumQuantity: 10,
    internalReference: "DEMO-LITEAU",
    secondary: {
      mode: "length",
      secondaryUnit: "ml",
      lengthMm: 4000,
    },
  });

  await service.transferStock({
    productId: chevron.id,
    quantity: 5,
    fromLocationId: depot.id,
    toLocationId: camion.id,
    reason: "Exemple chargement véhicule",
  });
}
