import test from "node:test";
import assert from "node:assert/strict";
import { StockDomainError } from "../core/errors";
import { GenericSupplierDemoAdapter, IdeaBoisDemoAdapter } from "../suppliers/demo-adapters";
import { SupplierStockService } from "../suppliers/supplier-service";
import { SupplierAvailability, SupplierStockAdapter } from "../suppliers/types";

const NOW = "2026-10-05T14:00:00Z";

test("Idea Bois reste un adaptateur de démonstration séparé du stock artisan", async () => {
  const service = new SupplierStockService(() => NOW, () => "draft-1");
  service.register(new IdeaBoisDemoAdapter(() => NOW));

  const rows = await service.search("lame");
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(row => row.isDemo));
  assert.ok(rows.every(row => row.source === "demo"));
  assert.ok(rows.every(row => row.productId === null));
});

test("la recherche multi-fournisseur fonctionne par désignation et référence", async () => {
  const service = new SupplierStockService(() => NOW);
  service.register(new IdeaBoisDemoAdapter(() => NOW));
  service.register(new GenericSupplierDemoAdapter(() => NOW));

  const chevron = await service.search("chevron");
  assert.equal(chevron.length, 1);
  assert.equal(chevron[0]?.supplierName, "Fournisseur BTP — démo");

  const reference = await service.search("DEMO-IB-LAMB-45");
  assert.equal(reference.length, 1);
  assert.equal(reference[0]?.supplierName, "Idea Bois — démo");
});

test("les données synchronisées maintenant sont fraîches", async () => {
  const service = new SupplierStockService(() => NOW);
  service.register(new IdeaBoisDemoAdapter(() => NOW));

  const rows = await service.search();
  assert.ok(rows.every(row => row.freshness === "FRESH"));
  assert.ok(rows.every(row => row.ageMinutes === 0));
});

class StaleAdapter implements SupplierStockAdapter {
  readonly supplierId = "stale";
  readonly supplierName = "Fournisseur périmé";
  getStatus() {
    return { ready: true, mode: "demo" as const, label: "test" };
  }
  async search(): Promise<SupplierAvailability[]> {
    return [{
      supplierId: this.supplierId,
      supplierName: this.supplierName,
      supplierProductId: "p1",
      supplierReference: "OLD-1",
      productId: null,
      designation: "Ancienne donnée",
      availableQuantity: 10,
      unit: "piece",
      priceHt: null,
      stockStatus: "AVAILABLE",
      lastSyncAt: "2026-10-05T08:00:00Z",
      depotId: null,
      depotName: null,
      source: "demo",
      isDemo: true,
    }];
  }
}

test("une donnée trop ancienne est marquée périmée", async () => {
  const service = new SupplierStockService(() => NOW, () => "id", 180);
  service.register(new StaleAdapter());
  const row = (await service.search())[0]!;
  assert.equal(row.freshness, "STALE");
  assert.equal(row.ageMinutes, 360);
});

test("un brouillon commande reste soumis à validation humaine", async () => {
  const service = new SupplierStockService(() => NOW, () => "draft-order");
  service.register(new IdeaBoisDemoAdapter(() => NOW));
  const row = (await service.search("Lame terrasse"))[0]!;
  const draft = service.prepareOrderDraft(row, 12);

  assert.equal(draft.type, "ORDER_REQUEST");
  assert.equal(draft.targetModule, "commandes");
  assert.equal(draft.validationRequired, true);
  assert.equal(draft.quantity, 12);
});

test("un brouillon devis ne crée aucune commande", async () => {
  const service = new SupplierStockService(() => NOW, () => "draft-quote");
  service.register(new IdeaBoisDemoAdapter(() => NOW));
  const row = (await service.search("Lambourde"))[0]!;
  const draft = service.prepareQuoteDraft(row, 8);

  assert.equal(draft.type, "QUOTE_REQUEST");
  assert.equal(draft.targetModule, "supplier_quote");
  assert.equal(draft.validationRequired, true);
});

test("une donnée fournisseur périmée bloque la préparation d'une action", async () => {
  const service = new SupplierStockService(() => NOW, () => "draft", 180);
  service.register(new StaleAdapter());
  const row = (await service.search())[0]!;

  assert.throws(
    () => service.prepareOrderDraft(row, 1),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
});

test("une rupture fournisseur bloque la préparation d'une action", async () => {
  const service = new SupplierStockService(() => NOW);
  const row = {
    ...(await new IdeaBoisDemoAdapter(() => NOW).search("Lame terrasse"))[0]!,
    stockStatus: "OUT_OF_STOCK" as const,
    freshness: "FRESH" as const,
    ageMinutes: 0,
  };

  assert.throws(
    () => service.prepareQuoteDraft(row, 1),
    (error: unknown) => error instanceof StockDomainError && error.code === "VALIDATION_REQUIRED",
  );
});
