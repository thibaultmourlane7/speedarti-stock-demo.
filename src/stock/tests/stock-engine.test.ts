import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";
import { StockEngine } from "../core/stock-engine";
import { StockDomainError } from "../core/errors";
import { StockItem, StockLocation } from "../domain/types";

const COMPANY = "company-demo";
const PRODUCT = "product-chevron";
const DEPOT = "loc-depot";
const CAMION = "loc-camion";

function item(): StockItem {
  return {
    id: PRODUCT,
    companyId: COMPANY,
    productId: null,
    name: "Chevron pin 70x80",
    family: "materiaux",
    internalReference: "CH-70-80",
    unit: "piece",
    minimumQuantity: 10,
    mainLocationId: DEPOT,
    active: true,
    createdAt: "2026-10-05T07:00:00Z",
    updatedAt: "2026-10-05T07:00:00Z",
  };
}

function location(id: string, name: string, type: StockLocation["type"]): StockLocation {
  return {
    id,
    companyId: COMPANY,
    name,
    type,
    active: true,
    createdAt: "2026-10-05T07:00:00Z",
    updatedAt: "2026-10-05T07:00:00Z",
  };
}

async function setup() {
  const repo = new InMemoryStockRepository();
  await repo.saveItem(item());
  await repo.saveLocation(location(DEPOT, "Dépôt principal", "depot"));
  await repo.saveLocation(location(CAMION, "Camion 1", "vehicule"));
  let i = 0;
  const engine = new StockEngine(repo, () => "2026-10-05T07:00:00Z", () => `id-${++i}`);
  return { repo, engine };
}

test("entrée puis sortie : la quantité physique est dérivée des mouvements", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 20, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 4, unit: "piece",
    movementType: "EXIT", locationFromId: DEPOT, sourceModule: "demo",
  });
  const snapshot = await engine.snapshot(COMPANY, PRODUCT, DEPOT);
  assert.equal(snapshot.physicalQuantity, 16);
  assert.equal(snapshot.availableQuantity, 16);
});

test("sortie impossible : aucun stock négatif silencieux", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 3, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  await assert.rejects(
    () => engine.applyMovement({
      companyId: COMPANY, productId: PRODUCT, quantity: 5, unit: "piece",
      movementType: "EXIT", locationFromId: DEPOT, sourceModule: "demo",
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "STOCK_INSUFFICIENT",
  );
});

test("transfert : le total entreprise est conservé et les emplacements changent", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 20, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 5, unit: "piece",
    movementType: "TRANSFER", locationFromId: DEPOT, locationToId: CAMION, sourceModule: "demo",
  });
  assert.equal((await engine.snapshot(COMPANY, PRODUCT, DEPOT)).physicalQuantity, 15);
  assert.equal((await engine.snapshot(COMPANY, PRODUCT, CAMION)).physicalQuantity, 5);
  assert.equal((await engine.snapshot(COMPANY, PRODUCT, null)).physicalQuantity, 20);
});

test("réservation : stock physique inchangé, disponible diminué", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 20, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  await engine.reserve({
    companyId: COMPANY, productId: PRODUCT, quantity: 8, unit: "piece",
    locationId: DEPOT, sourceModule: "chiffrage",
  });
  const snapshot = await engine.snapshot(COMPANY, PRODUCT, DEPOT);
  assert.equal(snapshot.physicalQuantity, 20);
  assert.equal(snapshot.reservedQuantity, 8);
  assert.equal(snapshot.availableQuantity, 12);
});

test("idempotence : le même événement source ne crée pas deux mouvements", async () => {
  const { engine } = await setup();
  const command = {
    companyId: COMPANY, productId: PRODUCT, quantity: 10, unit: "piece" as const,
    movementType: "ENTRY" as const, locationToId: DEPOT, sourceModule: "commandes",
    sourceEventId: "evt-delivery-1",
  };
  await engine.applyMovement(command);
  await assert.rejects(
    () => engine.applyMovement(command),
    (error: unknown) => error instanceof StockDomainError && error.code === "DUPLICATE_EVENT",
  );
});

test("unité incompatible refusée", async () => {
  const { engine } = await setup();
  await assert.rejects(
    () => engine.applyMovement({
      companyId: COMPANY, productId: PRODUCT, quantity: 1, unit: "m2",
      movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "INVALID_UNIT",
  );
});

test("libération de réservation : le disponible remonte sans mouvement physique", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 20, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  const reservation = await engine.reserve({
    companyId: COMPANY, productId: PRODUCT, quantity: 8, unit: "piece",
    locationId: DEPOT, sourceModule: "chiffrage",
  });
  await engine.releaseReservation(COMPANY, reservation.id, "evt-release-1");
  const snapshot = await engine.snapshot(COMPANY, PRODUCT, DEPOT);
  assert.equal(snapshot.physicalQuantity, 20);
  assert.equal(snapshot.reservedQuantity, 0);
  assert.equal(snapshot.availableQuantity, 20);
});

test("ajustement négatif interdit s'il rend le stock négatif", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 3, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  await assert.rejects(
    () => engine.applyMovement({
      companyId: COMPANY, productId: PRODUCT, quantity: -5, unit: "piece",
      movementType: "ADJUSTMENT", locationFromId: DEPOT, sourceModule: "inventory",
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "STOCK_INSUFFICIENT",
  );
});

import { evaluateAlert } from "../core/stock-engine";

test("seuil et rupture produisent les bons statuts/alertes", async () => {
  const { engine } = await setup();
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 10, unit: "piece",
    movementType: "ENTRY", locationToId: DEPOT, sourceModule: "demo",
  });
  const low = await engine.snapshot(COMPANY, PRODUCT, DEPOT);
  assert.equal(low.status, "LOW_STOCK");
  assert.equal(evaluateAlert(item(), low, "2026-10-05T07:00:00Z")?.type, "LOW_STOCK");
  await engine.applyMovement({
    companyId: COMPANY, productId: PRODUCT, quantity: 10, unit: "piece",
    movementType: "EXIT", locationFromId: DEPOT, sourceModule: "demo",
  });
  const empty = await engine.snapshot(COMPANY, PRODUCT, DEPOT);
  assert.equal(empty.status, "OUT_OF_STOCK");
  assert.equal(evaluateAlert(item(), empty, "2026-10-05T07:00:00Z")?.type, "OUT_OF_STOCK");
});
