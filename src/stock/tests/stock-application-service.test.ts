import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";
import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";

function setup() {
  const repo = new InMemoryStockRepository();
  let n = 0;
  const service = new StockApplicationService(
    repo,
    "company-1",
    "user-1",
    () => `2026-10-05T07:00:${String(n).padStart(2, "0")}Z`,
    () => `id-${++n}`,
  );
  return { repo, service };
}

test("initialisation crée un Dépôt principal une seule fois", async () => {
  const { service } = setup();
  const first = await service.initialize();
  const second = await service.initialize();
  assert.equal(first.id, second.id);
  assert.equal((await service.listLocations()).length, 1);
  assert.equal(first.name, "Dépôt principal");
});

test("création d'article avec quantité initiale crée un mouvement ENTRY", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const article = await service.createItem({
    name: "BA13",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 25,
    locationId: depot.id,
    minimumQuantity: 5,
  });
  const views = await service.listItemViews();
  assert.equal(views.length, 1);
  assert.equal(views[0]?.item.id, article.id);
  assert.equal(views[0]?.snapshot.physicalQuantity, 25);
  assert.equal((await service.movementHistory()).length, 1);
  assert.equal((await service.movementHistory())[0]?.movement.movementType, "ENTRY");
});

test("entrée et sortie UI utilisent le moteur métier", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const article = await service.createItem({
    name: "Tuile canal",
    family: "materiaux",
    unit: "piece",
    initialQuantity: 30,
    locationId: depot.id,
  });
  await service.recordEntry({ productId: article.id, quantity: 10, locationId: depot.id });
  await service.recordExit({ productId: article.id, quantity: 12, locationId: depot.id, chantierId: "chantier-dupont" });
  const view = (await service.listItemViews())[0];
  assert.equal(view?.snapshot.availableQuantity, 28);
  const history = await service.movementHistory();
  assert.equal(history.length, 3);
  assert.equal(history[0]?.movement.chantierId, "chantier-dupont");
});

test("sortie supérieure au disponible renvoie une erreur explicite", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  const article = await service.createItem({
    name: "Vis 5x80",
    family: "fournitures",
    unit: "boite",
    initialQuantity: 2,
    locationId: depot.id,
  });
  await assert.rejects(
    () => service.recordExit({ productId: article.id, quantity: 3, locationId: depot.id }),
    (error: unknown) => error instanceof StockDomainError && error.code === "STOCK_INSUFFICIENT",
  );
});

test("recherche partielle ignore casse et accents", async () => {
  const { service } = setup();
  const depot = await service.initialize();
  await service.createItem({
    name: "Équerre renforcée",
    family: "fournitures",
    unit: "piece",
    internalReference: "EQ-01",
    locationId: depot.id,
  });
  assert.equal((await service.listItemViews("equerre")).length, 1);
  assert.equal((await service.listItemViews("eq-01")).length, 1);
});
