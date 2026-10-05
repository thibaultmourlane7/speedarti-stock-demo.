import { StockDomainError } from "../core/errors";
import { StockEngine } from "../core/stock-engine";
import { Id, StockItem } from "../domain/types";
import { StockRepository } from "../repositories/stock-repository";
import {
  AvailabilityRequestPayload,
  AvailabilityResponsePayload,
  createEnvelope,
  IntegrationEnvelope,
  ReservationDraftReadyPayload,
  ReservationReleaseDraftReadyPayload,
  ReservationReleaseRequestPayload,
  ReservationRequestPayload,
  SPEEDARTI_MODULES,
  STOCK_INBOUND_EVENTS,
  STOCK_OUTBOUND_EVENTS,
  StockExitDraftPayload,
} from "./contracts";

/**
 * Pont local Sprint D.
 *
 * Il permet de vérifier les contrats réellement contre le moteur Stock sans
 * contacter SpeedArti, Supabase, Équipe & Planning ou Chiffrage.
 *
 * Les demandes d'écriture provenant d'un autre module restent des brouillons :
 * aucune réservation et aucune sortie physique n'est appliquée ici.
 */
export class StockIntegrationService {
  private readonly engine: StockEngine;

  constructor(
    private readonly repository: StockRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => crypto.randomUUID(),
  ) {
    this.engine = new StockEngine(repository, now, id);
  }

  async handle(envelope: IntegrationEnvelope<object>): Promise<IntegrationEnvelope<object>> {
    switch (envelope.eventType) {
      case STOCK_INBOUND_EVENTS.TEAM_PLANNING_MATERIAL_AVAILABILITY_REQUESTED:
      case STOCK_INBOUND_EVENTS.CHIFFRAGE_AVAILABILITY_REQUESTED:
        return this.availability(envelope as unknown as IntegrationEnvelope<AvailabilityRequestPayload>);

      case STOCK_INBOUND_EVENTS.TEAM_PLANNING_STOCK_EXIT_DRAFT_REQUESTED:
        return this.exitDraft(envelope as unknown as IntegrationEnvelope<StockExitDraftPayload>);

      case STOCK_INBOUND_EVENTS.CHIFFRAGE_RESERVATION_REQUESTED:
        return this.reservationDraft(envelope as unknown as IntegrationEnvelope<ReservationRequestPayload>);

      case STOCK_INBOUND_EVENTS.CHIFFRAGE_RESERVATION_RELEASE_REQUESTED:
        return this.reservationReleaseDraft(
          envelope as unknown as IntegrationEnvelope<ReservationReleaseRequestPayload>,
        );

      default:
        throw new StockDomainError(
          "UNSUPPORTED_EVENT",
          `Événement Stock non pris en charge : ${envelope.eventType}.`,
          { eventType: envelope.eventType },
        );
    }
  }

  private async availability(
    envelope: IntegrationEnvelope<AvailabilityRequestPayload>,
  ): Promise<IntegrationEnvelope<AvailabilityResponsePayload>> {
    const payload = envelope.payload;
    const item = await this.requireItem(envelope.companyId, payload.productId);
    this.assertRequestUnit(item, payload.unit);
    this.assertPositive(payload.requestedQuantity);

    const snapshot = await this.engine.snapshot(
      envelope.companyId,
      item.id,
      payload.locationId ?? null,
    );

    const status: AvailabilityResponsePayload["status"] =
      snapshot.availableQuantity <= 0
        ? "OUT_OF_STOCK"
        : snapshot.availableQuantity >= payload.requestedQuantity
          ? "AVAILABLE"
          : "PARTIAL";

    return createEnvelope({
      eventType: STOCK_OUTBOUND_EVENTS.AVAILABILITY_RESPONSE,
      source: SPEEDARTI_MODULES.STOCK,
      target: envelope.source,
      companyId: envelope.companyId,
      correlationId: envelope.correlationId ?? payload.requestId,
      payload: {
        requestId: payload.requestId,
        productId: item.id,
        requestedQuantity: payload.requestedQuantity,
        unit: item.unit,
        physicalQuantity: snapshot.physicalQuantity,
        reservedQuantity: snapshot.reservedQuantity,
        availableQuantity: snapshot.availableQuantity,
        status,
      },
      metadata: {
        requestEventId: envelope.eventId,
        sourceOfTruth: "stock",
      },
      occurredAt: this.now(),
      eventId: this.id(),
    });
  }

  private async exitDraft(
    envelope: IntegrationEnvelope<StockExitDraftPayload>,
  ): Promise<IntegrationEnvelope<Record<string, unknown>>> {
    const payload = envelope.payload;
    const item = await this.requireItem(envelope.companyId, payload.productId);
    this.assertRequestUnit(item, payload.unit);
    this.assertPositive(payload.quantity);

    if (!payload.locationId) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "L'emplacement de sortie est obligatoire.");
    }
    const location = await this.repository.getLocation(envelope.companyId, payload.locationId);
    if (!location || !location.active) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement de sortie introuvable.");
    }

    const snapshot = await this.engine.snapshot(envelope.companyId, item.id, payload.locationId);

    return createEnvelope({
      eventType: STOCK_OUTBOUND_EVENTS.EXIT_DRAFT_READY,
      source: SPEEDARTI_MODULES.STOCK,
      target: envelope.source,
      companyId: envelope.companyId,
      correlationId: envelope.correlationId ?? payload.requestId,
      payload: {
        ...payload,
        availableQuantity: snapshot.availableQuantity,
        canExit: snapshot.availableQuantity >= payload.quantity,
        validationRequired: true,
      },
      metadata: {
        requestEventId: envelope.eventId,
        noStockMutation: true,
      },
      occurredAt: this.now(),
      eventId: this.id(),
    });
  }

  private async reservationDraft(
    envelope: IntegrationEnvelope<ReservationRequestPayload>,
  ): Promise<IntegrationEnvelope<ReservationDraftReadyPayload>> {
    const payload = envelope.payload;
    const item = await this.requireItem(envelope.companyId, payload.productId);
    this.assertRequestUnit(item, payload.unit);
    this.assertPositive(payload.quantity);

    if (payload.locationId) {
      const location = await this.repository.getLocation(envelope.companyId, payload.locationId);
      if (!location || !location.active) {
        throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement de réservation introuvable.");
      }
    }

    const snapshot = await this.engine.snapshot(
      envelope.companyId,
      item.id,
      payload.locationId ?? null,
    );

    return createEnvelope({
      eventType: STOCK_OUTBOUND_EVENTS.RESERVATION_DRAFT_READY,
      source: SPEEDARTI_MODULES.STOCK,
      target: envelope.source,
      companyId: envelope.companyId,
      correlationId: envelope.correlationId ?? payload.requestId,
      payload: {
        ...payload,
        physicalQuantity: snapshot.physicalQuantity,
        reservedQuantity: snapshot.reservedQuantity,
        availableQuantity: snapshot.availableQuantity,
        canReserve: snapshot.availableQuantity >= payload.quantity,
        validationRequired: true,
      },
      metadata: {
        requestEventId: envelope.eventId,
        noStockMutation: true,
      },
      occurredAt: this.now(),
      eventId: this.id(),
    });
  }

  private async reservationReleaseDraft(
    envelope: IntegrationEnvelope<ReservationReleaseRequestPayload>,
  ): Promise<IntegrationEnvelope<ReservationReleaseDraftReadyPayload>> {
    const payload = envelope.payload;
    const reservation = await this.repository.getReservation(
      envelope.companyId,
      payload.reservationId,
    );
    if (!reservation) {
      throw new StockDomainError(
        "RESERVATION_NOT_FOUND",
        "Réservation Stock introuvable.",
        { reservationId: payload.reservationId },
      );
    }

    return createEnvelope({
      eventType: STOCK_OUTBOUND_EVENTS.RESERVATION_RELEASE_DRAFT_READY,
      source: SPEEDARTI_MODULES.STOCK,
      target: envelope.source,
      companyId: envelope.companyId,
      correlationId: envelope.correlationId ?? payload.requestId,
      payload: {
        requestId: payload.requestId,
        reservationId: payload.reservationId,
        validationRequired: true,
      },
      metadata: {
        requestEventId: envelope.eventId,
        reservationStatus: reservation.status,
        noStockMutation: true,
      },
      occurredAt: this.now(),
      eventId: this.id(),
    });
  }

  private async requireItem(companyId: Id, productId: Id): Promise<StockItem> {
    const item = await this.repository.getItem(companyId, productId);
    if (!item || !item.active) {
      throw new StockDomainError("PRODUCT_NOT_FOUND", "Article Stock introuvable.", {
        companyId,
        productId,
      });
    }
    return item;
  }

  private assertRequestUnit(item: StockItem, unit: string): void {
    if (item.unit !== unit) {
      throw new StockDomainError(
        "INVALID_UNIT",
        "L'unité demandée ne correspond pas à l'article Stock.",
        { expected: item.unit, received: unit },
      );
    }
  }

  private assertPositive(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new StockDomainError(
        "INVALID_QUANTITY",
        "La quantité demandée doit être strictement positive.",
        { quantity },
      );
    }
  }
}
