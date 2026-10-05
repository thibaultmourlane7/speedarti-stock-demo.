import {
  Id,
  StockItem,
  StockLocation,
  StockMovement,
  StockOffcut,
  StockPurchaseRequirement,
  StockReservation,
} from "../domain/types";
import { StockRepository } from "./stock-repository";

export class InMemoryStockRepository implements StockRepository {
  private items = new Map<string, StockItem>();
  private locations = new Map<string, StockLocation>();
  private movements: StockMovement[] = [];
  private reservations = new Map<string, StockReservation>();
  private purchaseRequirements = new Map<string, StockPurchaseRequirement>();
  private sourceEvents = new Set<string>();
  private offcuts = new Map<string, StockOffcut>();

  private key(companyId: Id, id: Id): string {
    return `${companyId}:${id}`;
  }

  async getItem(companyId: Id, productId: Id): Promise<StockItem | null> {
    return structuredClone(this.items.get(this.key(companyId, productId)) ?? null);
  }

  async listItems(companyId: Id): Promise<StockItem[]> {
    return structuredClone([...this.items.values()].filter(x => x.companyId === companyId));
  }

  async saveItem(item: StockItem): Promise<void> {
    this.items.set(this.key(item.companyId, item.id), structuredClone(item));
  }

  async getLocation(companyId: Id, locationId: Id): Promise<StockLocation | null> {
    return structuredClone(this.locations.get(this.key(companyId, locationId)) ?? null);
  }

  async listLocations(companyId: Id): Promise<StockLocation[]> {
    return structuredClone([...this.locations.values()].filter(x => x.companyId === companyId));
  }

  async saveLocation(location: StockLocation): Promise<void> {
    this.locations.set(this.key(location.companyId, location.id), structuredClone(location));
  }

  async listMovements(companyId: Id, productId: Id): Promise<StockMovement[]> {
    return structuredClone(this.movements.filter(x => x.companyId === companyId && x.productId === productId));
  }

  async listAllMovements(companyId: Id): Promise<StockMovement[]> {
    return structuredClone(this.movements.filter(x => x.companyId === companyId));
  }

  async appendMovement(movement: StockMovement): Promise<void> {
    this.movements.push(structuredClone(movement));
  }

  async listReservations(companyId: Id, productId: Id): Promise<StockReservation[]> {
    return structuredClone([...this.reservations.values()].filter(
      x => x.companyId === companyId && x.productId === productId,
    ));
  }

  async listAllReservations(companyId: Id): Promise<StockReservation[]> {
    return structuredClone([...this.reservations.values()].filter(x => x.companyId === companyId));
  }

  async getReservation(companyId: Id, reservationId: Id): Promise<StockReservation | null> {
    return structuredClone(this.reservations.get(this.key(companyId, reservationId)) ?? null);
  }

  async saveReservation(reservation: StockReservation): Promise<void> {
    this.reservations.set(this.key(reservation.companyId, reservation.id), structuredClone(reservation));
  }

  async listPurchaseRequirements(companyId: Id): Promise<StockPurchaseRequirement[]> {
    return structuredClone([...this.purchaseRequirements.values()].filter(x => x.companyId === companyId));
  }

  async savePurchaseRequirement(requirement: StockPurchaseRequirement): Promise<void> {
    this.purchaseRequirements.set(
      this.key(requirement.companyId, requirement.id),
      structuredClone(requirement),
    );
  }

  async hasProcessedSourceEvent(companyId: Id, sourceEventId: string): Promise<boolean> {
    return this.sourceEvents.has(this.key(companyId, sourceEventId));
  }

  async markSourceEventProcessed(companyId: Id, sourceEventId: string): Promise<void> {
    this.sourceEvents.add(this.key(companyId, sourceEventId));
  }

  async listOffcuts(companyId: Id, productId?: Id): Promise<StockOffcut[]> {
    return structuredClone([...this.offcuts.values()].filter(
      x => x.companyId === companyId && (!productId || x.productId === productId),
    ));
  }

  async saveOffcut(offcut: StockOffcut): Promise<void> {
    this.offcuts.set(this.key(offcut.companyId, offcut.id), structuredClone(offcut));
  }
}
