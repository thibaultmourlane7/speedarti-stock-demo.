import { Id, StockUnit } from "../domain/types";

export const STOCK_INTEGRATION_SCHEMA_VERSION = "1.0" as const;

export const SPEEDARTI_MODULES = {
  STOCK: "stock",
  CATALOGUE: "catalogue",
  CHANTIER: "chantier",
  CHIFFRAGE: "chiffrage",
  COMMANDES: "commandes",
  FACTURES_FOURNISSEURS: "factures_fournisseurs",
  EQUIPE_PLANNING: "equipe_planning",
  NOTIFICATIONS: "notifications",
  ANGEL: "angel",
  COMPTABILITE: "comptabilite",
  CALEPINAGE: "calepinage",
  AGENCEMENT_DECOUPE: "agencement_decoupe",
  CONFIGURATEURS: "configurateurs",
  PILOTAGE: "pilotage",
  FOURNISSEURS: "fournisseurs",
} as const;

export type SpeedArtiModule = typeof SPEEDARTI_MODULES[keyof typeof SPEEDARTI_MODULES];

export interface IntegrationEnvelope<TPayload extends object = Record<string, unknown>> {
  schemaVersion: typeof STOCK_INTEGRATION_SCHEMA_VERSION;
  eventId: string;
  eventType: string;
  source: SpeedArtiModule | string;
  target: SpeedArtiModule | string;
  companyId: Id;
  occurredAt: string;
  correlationId: string | null;
  idempotencyKey: string;
  payload: TPayload;
  metadata: Record<string, unknown>;
}

export const STOCK_INBOUND_EVENTS = {
  TEAM_PLANNING_MATERIAL_AVAILABILITY_REQUESTED: "team_planning.material.availability.requested",
  TEAM_PLANNING_STOCK_EXIT_DRAFT_REQUESTED: "team_planning.stock_exit.draft.requested",
  CHIFFRAGE_AVAILABILITY_REQUESTED: "chiffrage.stock.availability.requested",
  CHIFFRAGE_RESERVATION_REQUESTED: "chiffrage.stock.reservation.requested",
  CHIFFRAGE_RESERVATION_RELEASE_REQUESTED: "chiffrage.stock.reservation.release.requested",
  CHANTIER_EXIT_REQUESTED: "chantier.stock.exit.requested",
  CHANTIER_RETURN_REQUESTED: "chantier.stock.return.requested",
  OFFCUT_CREATED: "material.offcut.created",
  OFFCUT_CONSUME_REQUESTED: "material.offcut.consume.requested",
  PURCHASE_DELIVERY_CONFIRMED: "commandes.delivery.confirmed",
  SUPPLIER_INVOICE_ENTRY_DRAFT_REQUESTED: "factures_fournisseurs.stock_entry.draft.requested",
  ANGEL_ACTION_DRAFT_REQUESTED: "angel.stock.action.draft.requested",
} as const;

export const STOCK_OUTBOUND_EVENTS = {
  AVAILABILITY_RESPONSE: "stock.availability.response",
  EXIT_DRAFT_READY: "stock.exit.draft.ready",
  MOVEMENT_CREATED: "stock.movement.created",
  RESERVATION_CREATED: "stock.reservation.created",
  RESERVATION_RELEASED: "stock.reservation.released",
  RESERVATION_DRAFT_READY: "stock.reservation.draft.ready",
  RESERVATION_RELEASE_DRAFT_READY: "stock.reservation_release.draft.ready",
  LOW_LEVEL_DETECTED: "stock.low_level.detected",
  OUT_OF_STOCK_DETECTED: "stock.out_of_stock.detected",
  INVENTORY_DIFFERENCE_DETECTED: "stock.inventory.difference_detected",
  PURCHASE_REQUIREMENT_CREATED: "stock.purchase_requirement.created",
  OFFCUT_AVAILABLE: "stock.offcut.available",
  OFFCUT_CONSUMED: "stock.offcut.consumed",
  PILOTAGE_KPI_UPDATED: "stock.pilotage.kpi.updated",
} as const;

export interface AvailabilityRequestPayload {
  requestId: string;
  productId: Id;
  requestedQuantity: number;
  unit: StockUnit;
  locationId?: Id | null;
  chantierId?: Id | null;
}

export interface AvailabilityResponsePayload {
  requestId: string;
  productId: Id;
  requestedQuantity: number;
  unit: StockUnit;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: "AVAILABLE" | "PARTIAL" | "OUT_OF_STOCK" | "UNKNOWN";
}

export interface StockExitDraftPayload {
  requestId: string;
  productId: Id;
  quantity: number;
  unit: StockUnit;
  locationId: Id;
  chantierId?: Id | null;
  requestedBy?: Id | null;
  validationRequired: true;
}

export interface ReservationRequestPayload {
  requestId: string;
  productId: Id;
  quantity: number;
  unit: StockUnit;
  locationId?: Id | null;
  chantierId?: Id | null;
}

export interface ReservationReleaseRequestPayload {
  requestId: string;
  reservationId: Id;
}

export interface ReservationDraftReadyPayload extends ReservationRequestPayload {
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  canReserve: boolean;
  validationRequired: true;
}

export interface ReservationReleaseDraftReadyPayload extends ReservationReleaseRequestPayload {
  validationRequired: true;
}

export interface PurchaseRequirementPayload {
  requirementId: Id;
  productId: Id;
  quantity: number;
  unit: StockUnit;
  locationId?: Id | null;
  chantierId?: Id | null;
  reason?: string | null;
  validationRequired: true;
}

export const CONNECTOR_CATALOG = {
  catalogue: {
    direction: "bidirectionnel",
    sourceOfTruth: "Catalogue SpeedArti pour l'identité produit ; Stock pour quantités/mouvements.",
  },
  chantier: {
    direction: "bidirectionnel",
    sourceOfTruth: "Chantier SpeedArti pour l'identité chantier ; Stock pour mouvements matière.",
  },
  chiffrage: {
    direction: "bidirectionnel",
    sourceOfTruth: "Chiffrage pour besoins calculés ; Stock pour disponibilité/réservations.",
  },
  commandes: {
    direction: "bidirectionnel",
    sourceOfTruth: "Commandes SpeedArti pour commande/réception ; Stock pour entrée physique validée.",
  },
  factures_fournisseurs: {
    direction: "entrant",
    sourceOfTruth: "Facture fournisseur pour document ; Stock uniquement après confirmation humaine de la réception.",
  },
  equipe_planning: {
    direction: "bidirectionnel",
    sourceOfTruth: "Stock SpeedArti pour disponibilité ; Équipe & Planning pour demande terrain et affectation.",
  },
  notifications: {
    direction: "sortant",
    sourceOfTruth: "Stock pour événements ; Notifications SpeedArti pour diffusion.",
  },
  angel: {
    direction: "bidirectionnel",
    sourceOfTruth: "Stock pour données ; Ángel pour interprétation/proposition, jamais pour écriture directe.",
  },
  comptabilite: {
    direction: "sortant",
    sourceOfTruth: "Stock pour quantités/mouvements ; Comptabilité pour règles de valorisation.",
  },
  calepinage: {
    direction: "bidirectionnel",
    sourceOfTruth: "Stock pour disponibilité des chutes ; Calepinage pour géométrie calculée et reliquats.",
  },
  agencement_decoupe: {
    direction: "bidirectionnel",
    sourceOfTruth: "Agencement/Découpe pour géométrie de chute produite ; Stock pour disponibilité et statut.",
  },
  configurateurs: {
    direction: "bidirectionnel",
    sourceOfTruth: "Configurateur pour besoin matière calculé ; Stock pour disponibilité.",
  },
  pilotage: {
    direction: "sortant",
    sourceOfTruth: "Stock ; Pilotage en lecture uniquement.",
  },
  fournisseurs: {
    direction: "entrant",
    sourceOfTruth: "ERP/API fournisseur pour disponibilité fournisseur. Ne jamais fusionner avec le stock artisan.",
  },
} as const;

export function createEnvelope<TPayload extends object>(input: Omit<IntegrationEnvelope<TPayload>,
  "schemaVersion" | "eventId" | "occurredAt" | "idempotencyKey"> & {
    eventId?: string;
    occurredAt?: string;
    idempotencyKey?: string;
  }): IntegrationEnvelope<TPayload> {
  const eventId = input.eventId ?? crypto.randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return {
    schemaVersion: STOCK_INTEGRATION_SCHEMA_VERSION,
    eventId,
    eventType: input.eventType,
    source: input.source,
    target: input.target,
    companyId: input.companyId,
    occurredAt,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey ?? `${input.companyId}:${input.eventType}:${eventId}`,
    payload: structuredClone(input.payload),
    metadata: structuredClone(input.metadata),
  };
}
