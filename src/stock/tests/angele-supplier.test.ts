import test from "node:test";
import assert from "node:assert/strict";
import { AngelSupplierSearchService } from "../angele/supplier-search";
import { IdeaBoisDemoAdapter, GenericSupplierDemoAdapter } from "../suppliers/demo-adapters";
import { SupplierStockService } from "../suppliers/supplier-service";

const NOW = "2026-10-05T16:30:00Z";

function setup() {
  const suppliers = new SupplierStockService(() => NOW);
  suppliers.register(new IdeaBoisDemoAdapter(() => NOW));
  suppliers.register(new GenericSupplierDemoAdapter(() => NOW));
  const angel = new AngelSupplierSearchService(suppliers, () => NOW);
  return { suppliers, angel };
}

test("Angèle passe par SupplierStockService et ne fusionne jamais le stock artisan", async () => {
  const { angel } = setup();
  const answer = await angel.search("lame");
  assert.equal(answer.source, "SupplierStockService");
  assert.equal(answer.noDirectTableAccess, true);
  assert.equal(answer.artisanStockMerged, false);
  assert.ok(answer.results.length >= 1);
});

test("Angèle restitue fournisseur, référence, disponibilité et fraîcheur", async () => {
  const { angel } = setup();
  const answer = await angel.search("chevron");
  assert.equal(answer.results.length, 1);
  const row = answer.results[0]!;
  assert.equal(row.supplierName, "Fournisseur BTP — démo");
  assert.equal(row.supplierReference, "DEMO-FB-CHEV-7080");
  assert.equal(row.availableQuantity, 60);
  assert.equal(row.stockStatus, "AVAILABLE");
  assert.equal(row.freshness, "FRESH");
  assert.equal(row.lastSyncAt, NOW);
});

test("Angèle n'invente rien si aucune référence fournisseur ne correspond", async () => {
  const { angel } = setup();
  const answer = await angel.search("REF-INCONNUE-XYZ");
  assert.equal(answer.results.length, 0);
  assert.match(answer.message, /n'invente aucune référence ni quantité/i);
});

test("Angèle conserve une fraîcheur inconnue quand le fournisseur ne donne pas de date", async () => {
  const { angel } = setup();
  const answer = await angel.search("OSB 18");
  assert.equal(answer.results.length, 1);
  assert.equal(answer.results[0]?.freshness, "UNKNOWN");
  assert.equal(answer.results[0]?.lastSyncAt, null);
});

test("Angèle peut retourner plusieurs fournisseurs sans en recommander un automatiquement", async () => {
  const { angel } = setup();
  const answer = await angel.search("");
  assert.ok(answer.results.length > 1);
  assert.match(answer.message, /disponibilités fournisseur trouvées/i);
  assert.doesNotMatch(answer.message, /meilleur|recommand/i);
});
