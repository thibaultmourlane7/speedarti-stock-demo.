import test from "node:test";
import assert from "node:assert/strict";
import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";
import {
  secondaryQuantityPerPrimaryUnit,
  secondaryQuantityView,
} from "../core/stock-conversion";
import { StockItem } from "../domain/types";
import { InMemoryStockRepository } from "../repositories/in-memory-stock-repository";

function baseItem(partial: Partial<StockItem> = {}): StockItem {
  return {
    id: "p1",
    companyId: "c1",
    productId: null,
    name: "Article test",
    family: "materiaux",
    internalReference: null,
    unit: "piece",
    minimumQuantity: null,
    mainLocationId: null,
    secondary: null,
    active: true,
    createdAt: "2026-10-05T12:00:00Z",
    updatedAt: "2026-10-05T12:00:00Z",
    ...partial,
  };
}

test("30 chevrons de 4 m donnent 120 ml", () => {
  const item = baseItem({
    secondary: { mode: "length", secondaryUnit: "ml", lengthMm: 4000 },
  });
  const view = secondaryQuantityView(item, 30);
  assert.equal(view?.quantity, 120);
  assert.equal(view?.unit, "ml");
});

test("4 boîtes de 200 vis donnent 800 pièces", () => {
  const item = baseItem({
    unit: "boite",
    secondary: { mode: "manual", secondaryUnit: "piece", quantityPerPrimaryUnit: 200 },
  });
  const view = secondaryQuantityView(item, 4);
  assert.equal(view?.quantity, 800);
  assert.equal(view?.quantityPerPrimaryUnit, 200);
});

test("20 plaques 2,5 x 1,25 m donnent 62,5 m²", () => {
  const item = baseItem({
    secondary: {
      mode: "area",
      secondaryUnit: "m2",
      lengthMm: 2500,
      widthMm: 1250,
    },
  });
  assert.equal(secondaryQuantityPerPrimaryUnit(item.secondary!), 3.125);
  assert.equal(secondaryQuantityView(item, 20)?.quantity, 62.5);
});

test("8 sacs de 25 kg donnent 200 kg", () => {
  const item = baseItem({
    unit: "sac",
    secondary: { mode: "manual", secondaryUnit: "kg", quantityPerPrimaryUnit: 25 },
  });
  assert.equal(secondaryQuantityView(item, 8)?.quantity, 200);
});

test("une sortie de 30 vis sur 4 boîtes de 200 conserve 770 vis", async () => {
  const repo = new InMemoryStockRepository();
  let n = 0;
  const service = new StockApplicationService(
    repo,
    "company-1",
    "user-1",
    () => "2026-10-05T12:00:00Z",
    () => `id-${++n}`,
  );
  const depot = await service.initialize();
  const item = await service.createItem({
    name: "Vis",
    family: "fournitures",
    unit: "boite",
    initialQuantity: 4,
    locationId: depot.id,
    secondary: { mode: "manual", secondaryUnit: "piece", quantityPerPrimaryUnit: 200 },
  });

  await service.recordExit({
    productId: item.id,
    quantity: 30,
    unit: "piece",
    locationId: depot.id,
  });

  const view = (await service.listItemViews())[0]!;
  assert.equal(view.snapshot.physicalQuantity, 3.85);
  const secondary = secondaryQuantityView(view.item, view.snapshot.physicalQuantity);
  assert.equal(secondary?.quantity, 770);
  assert.equal(secondary?.fullPrimaryUnits, 3);
  assert.equal(secondary?.secondaryRemainder, 170);
});

test("une unité secondaire identique à l'unité principale est refusée", async () => {
  const repo = new InMemoryStockRepository();
  const service = new StockApplicationService(repo, "company-1", "user-1");
  const depot = await service.initialize();

  await assert.rejects(
    () => service.createItem({
      name: "Erreur",
      family: "materiaux",
      unit: "piece",
      locationId: depot.id,
      secondary: { mode: "manual", secondaryUnit: "piece", quantityPerPrimaryUnit: 10 },
    }),
    (error: unknown) => error instanceof StockDomainError && error.code === "INVALID_UNIT",
  );
});
