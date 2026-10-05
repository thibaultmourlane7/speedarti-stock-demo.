import test from "node:test";
import assert from "node:assert/strict";
import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";
import { StockExpertScanService } from "../expert/scan-service";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";

function setup() {
  const repo = new InMemoryStockRepository();
  let n = 0;
  const service = new StockApplicationService(
    repo,
    "company-expert",
    "user-expert",
    () => `2026-10-05T17:00:${String(n).padStart(2, "0")}Z`,
    () => `id-${++n}`,
  );
  const scan = new StockExpertScanService(service);
  return { repo, service, scan };
}

test("un code-barres identifie l'article sans mouvement automatique", async () => {
  const { service, scan } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Vis test",
    family: "fournitures",
    unit: "boite",
    initialQuantity: 4,
    locationId: depot.id,
    barcode: "3700000000999",
  });
  const before = (await service.movementHistory()).length;

  const draft = await scan.resolve("3700000000999");

  assert.equal(draft.sourceKind, "BARCODE");
  assert.equal(draft.action, "SELECT_PRODUCT");
  assert.equal(draft.item.id, item.id);
  assert.equal(draft.validationRequired, true);
  assert.equal((await service.movementHistory()).length, before);
});

test("un code-barres inconnu n'invente aucun article", async () => {
  const { scan } = setup();
  await assert.rejects(
    () => scan.resolve("9999999999999"),
    (error: unknown) => error instanceof StockDomainError && error.code === "PRODUCT_NOT_FOUND",
  );
});

test("deux articles actifs ne peuvent pas partager le même code-barres", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  await service.createItem({
    name: "Article A",
    family: "materiaux",
    unit: "piece",
    locationId: depot.id,
    barcode: "1234567890123",
  });

  await assert.rejects(
    () => service.createItem({
      name: "Article B",
      family: "materiaux",
      unit: "piece",
      locationId: depot.id,
      barcode: "1234567890123",
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "INVALID_ITEM",
  );
});

test("un QR transfert ne modifie rien avant validation humaine", async () => {
  const { service, scan } = setup();
  const depot = await service.initialize();
  const camion = await service.createVehicle({ name: "Camion 1", registration: "AB-123-CD" });
  const item = await service.createItem({
    name: "Chevron",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 20,
    locationId: depot.id,
  });
  const payload = scan.createQrPayload({
    action: "TRANSFER",
    productId: item.id,
    quantity: 5,
    unit: "piece",
    locationFromId: depot.id,
    locationToId: camion.id,
  });

  const draft = await scan.resolve(payload);
  assert.equal(draft.action, "TRANSFER");
  assert.equal((await service.locationBreakdown(item.id)).find(x => x.location.id === camion.id), undefined);

  await assert.rejects(
    () => scan.confirm(draft, false),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
  assert.equal((await service.locationBreakdown(item.id)).find(x => x.location.id === camion.id), undefined);

  await scan.confirm(draft, true);
  const rows = await service.locationBreakdown(item.id);
  assert.equal(rows.find(x => x.location.id === depot.id)?.snapshot.physicalQuantity, 15);
  assert.equal(rows.find(x => x.location.id === camion.id)?.snapshot.physicalQuantity, 5);
});

test("un QR chantier crée une sortie uniquement après confirmation", async () => {
  const { service, scan } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Tuile",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 12,
    locationId: depot.id,
  });

  const payload = scan.createQrPayload({
    action: "EXIT",
    productId: item.id,
    quantity: 3,
    unit: "piece",
    locationFromId: depot.id,
    chantierId: "CHANTIER-42",
  });
  const draft = await scan.resolve(payload);
  await scan.confirm(draft, true);

  const history = await service.movementHistory();
  assert.equal(history[0]?.movement.movementType, "EXIT");
  assert.equal(history[0]?.movement.chantierId, "CHANTIER-42");
  assert.equal((await service.listItemViews())[0]?.snapshot.physicalQuantity, 9);
});

test("un QR retour chantier ajoute au bon emplacement après confirmation", async () => {
  const { service, scan } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Lambourde",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 5,
    locationId: depot.id,
  });

  const payload = scan.createQrPayload({
    action: "SITE_RETURN",
    productId: item.id,
    quantity: 2,
    unit: "piece",
    locationToId: depot.id,
    chantierId: "CHANTIER-RET",
  });
  const draft = await scan.resolve(payload);
  await scan.confirm(draft, true);

  assert.equal((await service.listItemViews())[0]?.snapshot.physicalQuantity, 7);
  assert.equal((await service.movementHistory())[0]?.movement.movementType, "SITE_RETURN");
});

test("la vue véhicule expose références, réservations et immatriculation", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const camion = await service.createVehicle({ name: "Camion Équipe A", registration: "EF-456-GH" });
  const item = await service.createItem({
    name: "Mastic",
    family: "consommables",
    unit: "piece",
    initialQuantity: 10,
    locationId: depot.id,
  });
  await service.transferStock({
    productId: item.id,
    quantity: 4,
    fromLocationId: depot.id,
    toLocationId: camion.id,
  });
  await service.createReservation({
    productId: item.id,
    quantity: 1,
    locationId: camion.id,
    chantierId: "CHANTIER-A",
  });

  const vehicles = await service.listVehicleStocks();
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0]?.registration, "EF-456-GH");
  assert.equal(vehicles[0]?.referenceCount, 1);
  assert.equal(vehicles[0]?.reservedReferenceCount, 1);
  assert.equal(vehicles[0]?.lines[0]?.snapshot.physicalQuantity, 4);
  assert.equal(vehicles[0]?.lines[0]?.snapshot.availableQuantity, 3);
});
