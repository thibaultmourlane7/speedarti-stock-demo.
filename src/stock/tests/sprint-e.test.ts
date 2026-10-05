import test from "node:test";
import assert from "node:assert/strict";
import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";
import { secondaryQuantityView } from "../core/stock-conversion";
import { loadBtpDemoData } from "../demo/demo-data";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";

function setup() {
  const repo = new InMemoryStockRepository();
  let n = 0;
  const service = new StockApplicationService(
    repo,
    "company-e",
    "user-e",
    () => `2026-10-05T13:00:${String(n).padStart(2, "0")}Z`,
    () => `id-${++n}`,
  );
  return { repo, service };
}

test("le jeu de démonstration BTP couvre conditionnements, faible et rupture", async () => {
  const { service } = setup();
  await loadBtpDemoData(service);

  const views = await service.listItemViews();
  assert.equal(views.length, 7);

  const chevron = views.find(x => x.item.internalReference === "DEMO-CH-7080");
  const vis = views.find(x => x.item.internalReference === "DEMO-VIS-580");
  const osb = views.find(x => x.item.internalReference === "DEMO-OSB-18");

  assert.equal(secondaryQuantityView(chevron!.item, chevron!.snapshot.physicalQuantity)?.quantity, 120);
  assert.equal(secondaryQuantityView(vis!.item, vis!.snapshot.physicalQuantity)?.quantity, 800);
  assert.equal(secondaryQuantityView(osb!.item, osb!.snapshot.physicalQuantity)?.quantity, 62.5);

  const alerts = await service.listAlerts();
  assert.ok(alerts.some(x => x.type === "LOW_STOCK" && x.item.internalReference === "DEMO-MASTIC"));
  assert.ok(alerts.some(x => x.type === "OUT_OF_STOCK" && x.item.internalReference === "DEMO-LITEAU"));
});

test("un écart d'inventaire corrigé reste visible dans les alertes", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Plaque test",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 10,
    locationId: depot.id,
  });

  await service.applyInventoryCount({
    productId: item.id,
    locationId: depot.id,
    countedQuantity: 8,
  });

  const alerts = await service.listAlerts();
  const diff = alerts.find(x => x.type === "INVENTORY_DIFFERENCE" && x.item.id === item.id);
  assert.ok(diff);
  assert.equal(diff?.quantity, -2);
});

test("les exemples ne peuvent pas polluer un stock déjà rempli", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  await service.createItem({
    name: "Article réel de test",
    family: "materiaux",
    unit: "piece",
    locationId: depot.id,
  });

  await assert.rejects(
    () => loadBtpDemoData(service),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
});

test("non-régression : secondaire, transfert, réservation, sortie et achat restent cohérents", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const camion = await service.createLocation({ name: "Camion", type: "vehicule" });
  const item = await service.createItem({
    name: "Chevron 4 m",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 30,
    locationId: depot.id,
    minimumQuantity: 5,
    secondary: { mode: "length", secondaryUnit: "ml", lengthMm: 4000 },
  });

  // Transfert de 20 ml = 5 chevrons.
  await service.transferStock({
    productId: item.id,
    quantity: 20,
    unit: "ml",
    fromLocationId: depot.id,
    toLocationId: camion.id,
  });

  // Réservation de 8 ml = 2 chevrons sur le camion.
  const reservation = await service.createReservation({
    productId: item.id,
    quantity: 8,
    unit: "ml",
    locationId: camion.id,
    chantierId: "CHANTIER-E",
  });

  let total = (await service.listItemViews())[0]!;
  assert.equal(total.snapshot.physicalQuantity, 30);
  assert.equal(total.snapshot.reservedQuantity, 2);
  assert.equal(total.snapshot.availableQuantity, 28);

  const camionBefore = (await service.locationBreakdown(item.id)).find(x => x.location.id === camion.id)!;
  assert.equal(camionBefore.snapshot.physicalQuantity, 5);
  assert.equal(camionBefore.snapshot.availableQuantity, 3);

  await service.releaseReservation(reservation.id);

  // Sortie de 4 ml = 1 chevron.
  await service.recordExit({
    productId: item.id,
    quantity: 4,
    unit: "ml",
    locationId: camion.id,
    chantierId: "CHANTIER-E",
  });

  await service.createPurchaseRequirement({
    productId: item.id,
    quantity: 40,
    unit: "ml",
    locationId: depot.id,
    reason: "Préparer le réassort",
  });

  total = (await service.listItemViews())[0]!;
  assert.equal(total.snapshot.physicalQuantity, 29);
  assert.equal(secondaryQuantityView(total.item, total.snapshot.physicalQuantity)?.quantity, 116);

  const need = (await service.listPurchaseRequirements())[0]!;
  assert.equal(need.requirement.quantity, 10);
  assert.equal(need.requirement.unit, "piece");
});
