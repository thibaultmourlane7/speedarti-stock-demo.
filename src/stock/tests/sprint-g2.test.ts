import test from "node:test";
import assert from "node:assert/strict";
import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";
import { StockIntegrationService } from "../integrations/stock-integration-service";
import {
  createEnvelope,
  SPEEDARTI_MODULES,
  STOCK_INBOUND_EVENTS,
} from "../integrations/contracts";
import { StockReferenceDirectory } from "../integrations/reference-directory";

function setup() {
  const repo = new InMemoryStockRepository();
  let n = 0;
  const now = () => `2026-10-12T15:00:${String(n).padStart(2, "0")}Z`;
  const id = () => `g2-${++n}`;
  const service = new StockApplicationService(repo, "company-g2", "user-g2", now, id);
  return { repo, service, now, id };
}

test("inventaire session : le comptage ne corrige rien avant validation finale", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Chevron",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 10,
    locationId: depot.id,
  });

  const session = await service.startInventorySession(depot.id);
  assert.equal(session.status, "OPEN");
  assert.equal(session.counts.find(row => row.productId === item.id)?.theoreticalQuantity, 10);

  await service.saveInventorySessionCount(session.id, item.id, 7);
  await service.completeInventorySession(session.id);

  assert.equal((await service.getItemView(item.id)).snapshot.physicalQuantity, 10);

  const result = await service.validateInventoryAdjustments(session.id);
  assert.equal(result.session.status, "VALIDATED");
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0]?.movementType, "ADJUSTMENT");
  assert.equal(result.movements[0]?.quantity, -3);
  assert.equal((await service.getItemView(item.id)).snapshot.physicalQuantity, 7);
});

test("un inventaire ouvert est repris au lieu d'être dupliqué", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  await service.createItem({
    name: "Vis",
    family: "fournitures",
    unit: "boite",
    initialQuantity: 2,
    locationId: depot.id,
  });

  const first = await service.startInventorySession(depot.id);
  const second = await service.startInventorySession(depot.id);
  assert.equal(second.id, first.id);
});

test("le snapshot théorique d'inventaire reste figé malgré un mouvement ultérieur", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Tuile",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 10,
    locationId: depot.id,
  });
  const session = await service.startInventorySession(depot.id);

  await service.recordEntry({ productId: item.id, quantity: 2, locationId: depot.id });
  await service.saveInventorySessionCount(session.id, item.id, 8);
  await service.completeInventorySession(session.id);
  await service.validateInventoryAdjustments(session.id);

  assert.equal((await service.getInventorySession(session.id)).counts[0]?.theoreticalQuantity, 10);
  assert.equal((await service.getItemView(item.id)).snapshot.physicalQuantity, 10);
});

test("un inventaire incomplet ne peut pas être terminé", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  await service.createItem({ name: "A", family: "materiaux", unit: "piece", locationId: depot.id });
  await service.createItem({ name: "B", family: "materiaux", unit: "piece", locationId: depot.id });
  const session = await service.startInventorySession(depot.id);
  await service.saveInventorySessionCount(session.id, session.counts[0]!.productId, 0);

  await assert.rejects(
    () => service.completeInventorySession(session.id),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
});

test("Parc matériel crée puis désactive un véhicule sans supprimer son emplacement", async () => {
  const { repo, now, id } = setup();
  const integration = new StockIntegrationService(repo, now, id);

  const created = createEnvelope({
    eventType: STOCK_INBOUND_EVENTS.PARC_MATERIEL_VEHICLE_CREATED,
    source: SPEEDARTI_MODULES.PARC_MATERIEL,
    target: SPEEDARTI_MODULES.STOCK,
    companyId: "company-g2",
    correlationId: null,
    payload: {
      vehicleId: "vehicle-42",
      name: "Camion couvreur",
      registration: "AA-123-BB",
      active: true,
    },
    metadata: {},
    occurredAt: now(),
    eventId: id(),
  });
  await integration.handle(created);

  let location = (await repo.listLocations("company-g2")).find(row => row.vehicleId === "vehicle-42");
  assert.equal(location?.active, true);
  assert.equal(location?.registration, "AA-123-BB");
  assert.equal(location?.sourceModule, "parc_materiel");

  const disabled = createEnvelope({
    eventType: STOCK_INBOUND_EVENTS.PARC_MATERIEL_VEHICLE_DISABLED,
    source: SPEEDARTI_MODULES.PARC_MATERIEL,
    target: SPEEDARTI_MODULES.STOCK,
    companyId: "company-g2",
    correlationId: null,
    payload: {
      vehicleId: "vehicle-42",
      name: "Camion couvreur",
      registration: "AA-123-BB",
      active: false,
    },
    metadata: {},
    occurredAt: now(),
    eventId: id(),
  });
  await integration.handle(disabled);

  location = (await repo.listLocations("company-g2")).find(row => row.vehicleId === "vehicle-42");
  assert.equal(location?.active, false);
  assert.ok(location);
});

test("charger un véhicule déduit immédiatement le dépôt via un seul transfert", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const vehicle = await service.syncVehicleFromParcMateriel({
    vehicleId: "vehicle-1",
    name: "Camion 1",
    registration: "AB-456-CD",
    active: true,
  });
  const item = await service.createItem({
    name: "Lambourde",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 20,
    locationId: depot.id,
  });

  const movement = await service.transferStock({
    productId: item.id,
    quantity: 6,
    fromLocationId: depot.id,
    toLocationId: vehicle.id,
    reason: "Chargement véhicule",
  });

  assert.equal(movement.movementType, "TRANSFER");
  const rows = await service.locationBreakdown(item.id);
  assert.equal(rows.find(row => row.location.id === depot.id)?.snapshot.physicalQuantity, 14);
  assert.equal(rows.find(row => row.location.id === vehicle.id)?.snapshot.physicalQuantity, 6);
  assert.equal((await service.getItemView(item.id)).snapshot.physicalQuantity, 20);
});

test("une équipe ou un chantier inconnus sont refusés par le répertoire connecté", () => {
  const directory = new StockReferenceDirectory();
  directory.applyCrewSnapshot({ crewId: "crew-1", name: "Équipe 1", active: true });
  directory.applyChantierSnapshot({ chantierId: "site-1", name: "Chantier 1", active: true });

  assert.equal(directory.requireCrew("crew-1").name, "Équipe 1");
  assert.equal(directory.requireChantier("site-1").name, "Chantier 1");
  assert.throws(
    () => directory.requireCrew("crew-x"),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
  assert.throws(
    () => directory.requireChantier("site-x"),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
});

test("une sortie affectée à une équipe conserve crewId dans le mouvement", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Mastic",
    family: "consommables",
    unit: "piece",
    initialQuantity: 5,
    locationId: depot.id,
  });
  const movement = await service.recordExit({
    productId: item.id,
    quantity: 1,
    locationId: depot.id,
    crewId: "crew-1",
    reason: "Équipe : Équipe 1",
  });
  assert.equal(movement.crewId, "crew-1");
});
