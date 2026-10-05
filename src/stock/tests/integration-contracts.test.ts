import test from "node:test";
import assert from "node:assert/strict";
import {
  createEnvelope,
  SPEEDARTI_MODULES,
  STOCK_INBOUND_EVENTS,
  STOCK_INTEGRATION_SCHEMA_VERSION,
} from "../integrations/contracts";
import { normalizeDimensionExpression, ANGEL_STOCK_RULES } from "../angele/knowledge-pack";
import { assertStockPermission } from "../core/permissions";
import { StockDomainError } from "../core/errors";

test("enveloppe compatible avec le contrat Équipe & Planning observé", () => {
  const envelope = createEnvelope({
    eventType: STOCK_INBOUND_EVENTS.TEAM_PLANNING_MATERIAL_AVAILABILITY_REQUESTED,
    source: SPEEDARTI_MODULES.EQUIPE_PLANNING,
    target: SPEEDARTI_MODULES.STOCK,
    companyId: "company-1",
    correlationId: "req-1",
    payload: { productId: "p1", requestedQuantity: 30, unit: "piece" },
    metadata: { validationRequired: false },
    eventId: "evt-1",
    occurredAt: "2026-10-05T07:00:00Z",
  });
  assert.equal(envelope.schemaVersion, STOCK_INTEGRATION_SCHEMA_VERSION);
  assert.equal(envelope.source, "equipe_planning");
  assert.equal(envelope.target, "stock");
  assert.ok(envelope.idempotencyKey);
});

test("Ángel ne multiplie pas implicitement une dimension 8x7 par 10", () => {
  assert.deepEqual(normalizeDimensionExpression("8x7"), { a: 8, b: 7, unit: "mm" });
  assert.deepEqual(normalizeDimensionExpression("80 × 70 mm"), { a: 80, b: 70, unit: "mm" });
});

test("pack Ángel contient les garde-fous source de vérité et validation humaine", () => {
  assert.ok(ANGEL_STOCK_RULES.some(x => x.knowledgeId === "stock.source_of_truth.quantity"));
  assert.ok(ANGEL_STOCK_RULES.some(x => x.knowledgeId === "stock.action.validation" && x.humanValidationRequired));
});


test("les permissions sont contrôlées côté métier et pas seulement dans l'UI", () => {
  assert.throws(
    () => assertStockPermission({ userId: "u1", permissions: ["stock.read"] }, "stock.adjust"),
    (error: unknown) => error instanceof StockDomainError && error.code === "PERMISSION_DENIED",
  );
});

import { StockConnectorRegistry } from "../integrations/connector-registry";
import { ContractsOnlyConnector } from "../adapters/mock/contracts-only-connector";

test("un connecteur production désactivé refuse explicitement l'envoi", async () => {
  const registry = new StockConnectorRegistry();
  registry.register(new ContractsOnlyConnector("equipe_planning"));
  const envelope = createEnvelope({
    eventType: "stock.availability.response",
    source: "stock",
    target: "equipe_planning",
    companyId: "company-1",
    correlationId: "req-1",
    payload: { requestId: "req-1" },
    metadata: {},
  });
  await assert.rejects(
    () => registry.send("equipe_planning", envelope),
    (error: unknown) => error instanceof StockDomainError && error.code === "CONNECTOR_UNAVAILABLE",
  );
});
