import test from "node:test";
import assert from "node:assert/strict";
import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";
import { createEnvelope, SPEEDARTI_MODULES, STOCK_INBOUND_EVENTS, STOCK_OUTBOUND_EVENTS } from "../integrations/contracts";
import { StockIntegrationService } from "../integrations/stock-integration-service";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";

function setup() {
  const repo = new InMemoryStockRepository();
  let n = 0;
  const now = () => `2026-10-05T11:00:${String(n).padStart(2, "0")}Z`;
  const id = () => `id-${++n}`;
  const service = new StockApplicationService(repo, "company-1", "user-1", now, id);
  const integration = new StockIntegrationService(repo, now, id);
  return { repo, service, integration, now, id };
}

test("réserver diminue le disponible mais pas le physique", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Chevron",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 20,
    locationId: depot.id,
  });

  const reservation = await service.createReservation({
    productId: item.id,
    quantity: 8,
    locationId: depot.id,
    chantierId: "chantier-dupont",
    reason: "Prévu pour lundi",
  });

  const view = (await service.listItemViews())[0]!;
  assert.equal(view.snapshot.physicalQuantity, 20);
  assert.equal(view.snapshot.reservedQuantity, 8);
  assert.equal(view.snapshot.availableQuantity, 12);
  assert.equal(reservation.reason, "Prévu pour lundi");
});

test("libérer une réservation restitue le disponible", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "BA13",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 12,
    locationId: depot.id,
  });
  const reservation = await service.createReservation({
    productId: item.id,
    quantity: 5,
    locationId: depot.id,
    chantierId: "chantier-1",
  });

  await service.releaseReservation(reservation.id);
  const view = (await service.listItemViews())[0]!;
  assert.equal(view.snapshot.reservedQuantity, 0);
  assert.equal(view.snapshot.availableQuantity, 12);
  assert.equal((await service.listActiveReservations()).length, 0);
});

test("une réservation supérieure au disponible est refusée", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "OSB",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 4,
    locationId: depot.id,
  });

  await assert.rejects(
    () => service.createReservation({
      productId: item.id,
      quantity: 5,
      locationId: depot.id,
      chantierId: "chantier-1",
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "STOCK_INSUFFICIENT",
  );
});

test("une réservation UI exige un chantier", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Vis",
    family: "fournitures",
    unit: "boite",
    initialQuantity: 10,
    locationId: depot.id,
  });

  await assert.rejects(
    () => service.createReservation({
      productId: item.id,
      quantity: 2,
      locationId: depot.id,
      chantierId: "",
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
});

test("réapprovisionner crée un besoin brouillon sans mouvement de stock", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Colle",
    family: "consommables",
    unit: "sac",
    initialQuantity: 2,
    locationId: depot.id,
  });
  const before = (await service.movementHistory()).length;

  const requirement = await service.createPurchaseRequirement({
    productId: item.id,
    quantity: 10,
    locationId: depot.id,
    reason: "Seuil faible",
  });

  const after = (await service.movementHistory()).length;
  assert.equal(requirement.status, "DRAFT");
  assert.equal(requirement.quantity, 10);
  assert.equal(before, after);
  assert.equal((await service.listPurchaseRequirements()).length, 1);
});

test("un besoin d'achat refuse une quantité nulle", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Mortier",
    family: "materiaux",
    unit: "sac",
    initialQuantity: 1,
    locationId: depot.id,
  });

  await assert.rejects(
    () => service.createPurchaseRequirement({
      productId: item.id,
      quantity: 0,
      locationId: depot.id,
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "INVALID_QUANTITY",
  );
});

test("connecteur disponibilité renvoie le vrai physique, réservé et disponible", async () => {
  const { service, integration } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Liteau",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 20,
    locationId: depot.id,
  });
  await service.createReservation({
    productId: item.id,
    quantity: 6,
    locationId: depot.id,
    chantierId: "chantier-a",
  });

  const request = createEnvelope({
    eventId: "req-event-1",
    occurredAt: "2026-10-05T11:15:00Z",
    eventType: STOCK_INBOUND_EVENTS.TEAM_PLANNING_MATERIAL_AVAILABILITY_REQUESTED,
    source: SPEEDARTI_MODULES.EQUIPE_PLANNING,
    target: SPEEDARTI_MODULES.STOCK,
    companyId: "company-1",
    correlationId: "corr-1",
    payload: {
      requestId: "req-1",
      productId: item.id,
      requestedQuantity: 10,
      unit: "piece" as const,
      locationId: depot.id,
    },
    metadata: {},
  });

  const response = await integration.handle(request);
  assert.equal(response.eventType, STOCK_OUTBOUND_EVENTS.AVAILABILITY_RESPONSE);
  const payload = response.payload as {
    physicalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    status: string;
  };
  assert.equal(payload.physicalQuantity, 20);
  assert.equal(payload.reservedQuantity, 6);
  assert.equal(payload.availableQuantity, 14);
  assert.equal(payload.status, "AVAILABLE");
});

test("demande Équipe & Planning prépare une sortie sans muter le stock", async () => {
  const { service, integration } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Tuile",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 20,
    locationId: depot.id,
  });
  const before = (await service.movementHistory()).length;

  const request = createEnvelope({
    eventId: "req-event-2",
    occurredAt: "2026-10-05T11:20:00Z",
    eventType: STOCK_INBOUND_EVENTS.TEAM_PLANNING_STOCK_EXIT_DRAFT_REQUESTED,
    source: SPEEDARTI_MODULES.EQUIPE_PLANNING,
    target: SPEEDARTI_MODULES.STOCK,
    companyId: "company-1",
    correlationId: "corr-2",
    payload: {
      requestId: "req-2",
      productId: item.id,
      quantity: 5,
      unit: "piece" as const,
      locationId: depot.id,
      chantierId: "chantier-2",
      validationRequired: true as const,
    },
    metadata: {},
  });

  const response = await integration.handle(request);
  const after = (await service.movementHistory()).length;
  assert.equal(response.eventType, STOCK_OUTBOUND_EVENTS.EXIT_DRAFT_READY);
  assert.equal(after, before);
  assert.equal((response.payload as { validationRequired: boolean }).validationRequired, true);
});

test("demande Chiffrage prépare une réservation sans la créer automatiquement", async () => {
  const { service, integration } = setup();
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Isolant",
    family: "materiaux",
    unit: "m2",
    initialQuantity: 50,
    locationId: depot.id,
  });

  const request = createEnvelope({
    eventId: "req-event-3",
    occurredAt: "2026-10-05T11:25:00Z",
    eventType: STOCK_INBOUND_EVENTS.CHIFFRAGE_RESERVATION_REQUESTED,
    source: SPEEDARTI_MODULES.CHIFFRAGE,
    target: SPEEDARTI_MODULES.STOCK,
    companyId: "company-1",
    correlationId: "corr-3",
    payload: {
      requestId: "req-3",
      productId: item.id,
      quantity: 12,
      unit: "m2" as const,
      locationId: depot.id,
      chantierId: "chantier-3",
    },
    metadata: {},
  });

  const response = await integration.handle(request);
  assert.equal(response.eventType, STOCK_OUTBOUND_EVENTS.RESERVATION_DRAFT_READY);
  assert.equal((await service.listActiveReservations()).length, 0);
  const payload = response.payload as { canReserve: boolean; validationRequired: boolean };
  assert.equal(payload.canReserve, true);
  assert.equal(payload.validationRequired, true);
});
