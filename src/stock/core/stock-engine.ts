import {
  Id,
  StockAlert,
  StockItem,
  StockMovement,
  StockMovementType,
  StockReservation,
  StockSnapshot,
  StockUnit,
} from "../domain/types";
import { StockDomainError } from "./errors";
import { StockRepository } from "../repositories/stock-repository";

const EPSILON = 1e-9;

export function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new StockDomainError("INVALID_QUANTITY", "La quantité doit être strictement positive.", { quantity });
  }
}

function movementEffectAtLocation(movement: StockMovement, locationId: Id | null): number {
  const q = movement.quantity;
  switch (movement.movementType) {
    case "ENTRY":
    case "SITE_RETURN":
      return locationId === null || movement.locationToId === locationId ? q : 0;
    case "EXIT":
    case "LOSS":
    case "BREAKAGE":
      return locationId === null || movement.locationFromId === locationId ? -q : 0;
    case "ADJUSTMENT": {
      // Convention Sprint A : quantity est signée pour ADJUSTMENT.
      return locationId === null || movement.locationToId === locationId || movement.locationFromId === locationId ? q : 0;
    }
    case "TRANSFER":
      if (locationId === null) return 0;
      if (movement.locationFromId === locationId) return -q;
      if (movement.locationToId === locationId) return q;
      return 0;
    default:
      return 0;
  }
}

export function calculateSnapshot(
  item: StockItem,
  movements: StockMovement[],
  reservations: StockReservation[],
  locationId: Id | null = null,
): StockSnapshot {
  const physicalQuantity = movements.reduce(
    (sum, movement) => sum + movementEffectAtLocation(movement, locationId),
    0,
  );
  const reservedQuantity = reservations
    .filter((reservation) =>
      reservation.status === "ACTIVE" &&
      (locationId === null || reservation.locationId === null || reservation.locationId === locationId),
    )
    .reduce((sum, reservation) => sum + reservation.quantity, 0);

  const availableQuantity = physicalQuantity - reservedQuantity;
  let status: StockSnapshot["status"] = "AVAILABLE";
  if (availableQuantity <= EPSILON) status = "OUT_OF_STOCK";
  else if (item.minimumQuantity !== null && availableQuantity <= item.minimumQuantity) status = "LOW_STOCK";

  return {
    companyId: item.companyId,
    productId: item.id,
    locationId,
    unit: item.unit,
    physicalQuantity,
    reservedQuantity,
    availableQuantity,
    status,
  };
}

export function evaluateAlert(item: StockItem, snapshot: StockSnapshot, now: string): StockAlert | null {
  if (snapshot.availableQuantity <= EPSILON) {
    return {
      type: "OUT_OF_STOCK",
      companyId: item.companyId,
      productId: item.id,
      locationId: snapshot.locationId,
      quantity: snapshot.availableQuantity,
      threshold: item.minimumQuantity,
      createdAt: now,
    };
  }
  if (item.minimumQuantity !== null && snapshot.availableQuantity <= item.minimumQuantity) {
    return {
      type: "LOW_STOCK",
      companyId: item.companyId,
      productId: item.id,
      locationId: snapshot.locationId,
      quantity: snapshot.availableQuantity,
      threshold: item.minimumQuantity,
      createdAt: now,
    };
  }
  return null;
}

export interface MovementCommand {
  companyId: Id;
  productId: Id;
  quantity: number;
  unit: StockUnit;
  movementType: StockMovementType;
  locationFromId?: Id | null;
  locationToId?: Id | null;
  chantierId?: Id | null;
  userId?: Id | null;
  sourceModule: string;
  sourceId?: string | null;
  sourceEventId?: string | null;
  reason?: string | null;
}

export interface ReservationCommand {
  companyId: Id;
  productId: Id;
  quantity: number;
  unit: StockUnit;
  locationId?: Id | null;
  chantierId?: Id | null;
  userId?: Id | null;
  sourceModule: string;
  sourceId?: string | null;
  sourceEventId?: string | null;
  reason?: string | null;
}

export class StockEngine {
  constructor(
    private readonly repository: StockRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => crypto.randomUUID(),
  ) {}

  async snapshot(companyId: Id, productId: Id, locationId: Id | null = null): Promise<StockSnapshot> {
    const item = await this.requireItem(companyId, productId);
    const movements = await this.repository.listMovements(companyId, productId);
    const reservations = await this.repository.listReservations(companyId, productId);
    return calculateSnapshot(item, movements, reservations, locationId);
  }

  async applyMovement(command: MovementCommand): Promise<StockMovement> {
    const item = await this.requireItem(command.companyId, command.productId);

    if (item.unit !== command.unit) {
      throw new StockDomainError("INVALID_UNIT", "L'unité du mouvement ne correspond pas à l'article.", {
        expected: item.unit,
        received: command.unit,
      });
    }

    if (command.movementType === "ADJUSTMENT") {
      if (!Number.isFinite(command.quantity) || Math.abs(command.quantity) <= EPSILON) {
        throw new StockDomainError("INVALID_QUANTITY", "Un ajustement doit être non nul.");
      }
    } else {
      assertPositiveQuantity(command.quantity);
    }

    await this.assertSourceEventAvailable(command.companyId, command.sourceEventId ?? null);
    await this.assertLocations(command);

    if (["EXIT", "LOSS", "BREAKAGE", "TRANSFER"].includes(command.movementType)) {
      const locationId = command.locationFromId ?? null;
      const snapshot = await this.snapshot(command.companyId, command.productId, locationId);
      if (snapshot.availableQuantity + EPSILON < command.quantity) {
        throw new StockDomainError("STOCK_INSUFFICIENT", "Stock disponible insuffisant.", {
          availableQuantity: snapshot.availableQuantity,
          requestedQuantity: command.quantity,
          productId: command.productId,
          locationId,
        });
      }
    }

    if (command.movementType === "ADJUSTMENT" && command.quantity < 0) {
      const locationId = command.locationFromId ?? command.locationToId ?? null;
      const snapshot = await this.snapshot(command.companyId, command.productId, locationId);
      const nextPhysical = snapshot.physicalQuantity + command.quantity;
      const nextAvailable = nextPhysical - snapshot.reservedQuantity;
      if (nextPhysical < -EPSILON || nextAvailable < -EPSILON) {
        throw new StockDomainError(
          "STOCK_INSUFFICIENT",
          "L'ajustement produirait un stock physique ou disponible négatif.",
          { physicalQuantity: snapshot.physicalQuantity, reservedQuantity: snapshot.reservedQuantity, adjustment: command.quantity },
        );
      }
    }

    const movement: StockMovement = {
      id: this.id(),
      companyId: command.companyId,
      productId: command.productId,
      quantity: command.quantity,
      unit: command.unit,
      movementType: command.movementType,
      locationFromId: command.locationFromId ?? null,
      locationToId: command.locationToId ?? null,
      chantierId: command.chantierId ?? null,
      userId: command.userId ?? null,
      sourceModule: command.sourceModule,
      sourceId: command.sourceId ?? null,
      sourceEventId: command.sourceEventId ?? null,
      reason: command.reason ?? null,
      createdAt: this.now(),
    };

    await this.repository.appendMovement(movement);
    if (movement.sourceEventId) {
      await this.repository.markSourceEventProcessed(movement.companyId, movement.sourceEventId);
    }
    return movement;
  }

  async reserve(command: ReservationCommand): Promise<StockReservation> {
    assertPositiveQuantity(command.quantity);
    const item = await this.requireItem(command.companyId, command.productId);
    if (item.unit !== command.unit) {
      throw new StockDomainError("INVALID_UNIT", "L'unité de réservation ne correspond pas à l'article.");
    }
    await this.assertSourceEventAvailable(command.companyId, command.sourceEventId ?? null);
    if (command.locationId) {
      await this.requireLocation(command.companyId, command.locationId);
    }

    const snapshot = await this.snapshot(command.companyId, command.productId, command.locationId ?? null);
    if (snapshot.availableQuantity + EPSILON < command.quantity) {
      throw new StockDomainError("STOCK_INSUFFICIENT", "Stock disponible insuffisant pour la réservation.", {
        availableQuantity: snapshot.availableQuantity,
        requestedQuantity: command.quantity,
      });
    }

    const at = this.now();
    const reservation: StockReservation = {
      id: this.id(),
      companyId: command.companyId,
      productId: command.productId,
      locationId: command.locationId ?? null,
      chantierId: command.chantierId ?? null,
      quantity: command.quantity,
      unit: command.unit,
      status: "ACTIVE",
      sourceModule: command.sourceModule,
      sourceId: command.sourceId ?? null,
      sourceEventId: command.sourceEventId ?? null,
      reason: command.reason ?? null,
      createdBy: command.userId ?? null,
      createdAt: at,
      updatedAt: at,
    };

    await this.repository.saveReservation(reservation);
    if (reservation.sourceEventId) {
      await this.repository.markSourceEventProcessed(reservation.companyId, reservation.sourceEventId);
    }
    return reservation;
  }

  async releaseReservation(companyId: Id, reservationId: Id, sourceEventId?: string): Promise<StockReservation> {
    await this.assertSourceEventAvailable(companyId, sourceEventId ?? null);
    const reservation = await this.repository.getReservation(companyId, reservationId);
    if (!reservation) {
      throw new StockDomainError("RESERVATION_NOT_FOUND", "Réservation Stock introuvable.", { companyId, reservationId });
    }
    if (reservation.status !== "ACTIVE") return reservation;
    const updated: StockReservation = {
      ...reservation,
      status: "RELEASED",
      sourceEventId: sourceEventId ?? reservation.sourceEventId,
      updatedAt: this.now(),
    };
    await this.repository.saveReservation(updated);
    if (sourceEventId) await this.repository.markSourceEventProcessed(companyId, sourceEventId);
    return updated;
  }

  private async requireItem(companyId: Id, productId: Id): Promise<StockItem> {
    const item = await this.repository.getItem(companyId, productId);
    if (!item) throw new StockDomainError("PRODUCT_NOT_FOUND", "Article Stock introuvable.", { companyId, productId });
    return item;
  }

  private async requireLocation(companyId: Id, locationId: Id): Promise<void> {
    const location = await this.repository.getLocation(companyId, locationId);
    if (!location) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement Stock introuvable.", { companyId, locationId });
    }
  }

  private async assertLocations(command: MovementCommand): Promise<void> {
    const type = command.movementType;
    if (["EXIT", "LOSS", "BREAKAGE", "TRANSFER"].includes(type) && !command.locationFromId) {
      throw new StockDomainError("INVALID_MOVEMENT", "Un emplacement d'origine est obligatoire.", { type });
    }
    if (["ENTRY", "SITE_RETURN", "TRANSFER"].includes(type) && !command.locationToId) {
      throw new StockDomainError("INVALID_MOVEMENT", "Un emplacement de destination est obligatoire.", { type });
    }
    if (command.locationFromId) await this.requireLocation(command.companyId, command.locationFromId);
    if (command.locationToId) await this.requireLocation(command.companyId, command.locationToId);
    if (type === "TRANSFER" && command.locationFromId === command.locationToId) {
      throw new StockDomainError("INVALID_MOVEMENT", "Un transfert doit changer d'emplacement.");
    }
  }

  private async assertSourceEventAvailable(companyId: Id, sourceEventId: string | null): Promise<void> {
    if (!sourceEventId) return;
    if (await this.repository.hasProcessedSourceEvent(companyId, sourceEventId)) {
      throw new StockDomainError("DUPLICATE_EVENT", "Cet événement source a déjà été traité.", { sourceEventId });
    }
  }
}
