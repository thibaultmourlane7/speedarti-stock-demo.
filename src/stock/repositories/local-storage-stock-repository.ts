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

interface StoredState {
  version: 2;
  items: StockItem[];
  locations: StockLocation[];
  movements: StockMovement[];
  reservations: StockReservation[];
  purchaseRequirements: StockPurchaseRequirement[];
  sourceEvents: string[];
  offcuts: StockOffcut[];
}

const EMPTY: StoredState = {
  version: 2,
  items: [],
  locations: [],
  movements: [],
  reservations: [],
  purchaseRequirements: [],
  sourceEvents: [],
  offcuts: [],
};

export class LocalStorageStockRepository implements StockRepository {
  constructor(
    private readonly storage: Storage,
    private readonly storageKey = "speedarti.stock.demo.v1",
  ) {}

  private load(): StoredState {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return structuredClone(EMPTY);
      const parsed = JSON.parse(raw) as Partial<Omit<StoredState, "version">> & { version?: number };

      if (parsed.version !== 1 && parsed.version !== 2) {
        return structuredClone(EMPTY);
      }

      return {
        version: 2,
        items: Array.isArray(parsed.items) ? parsed.items : [],
        locations: Array.isArray(parsed.locations) ? parsed.locations : [],
        movements: Array.isArray(parsed.movements) ? parsed.movements : [],
        reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
        purchaseRequirements: Array.isArray(parsed.purchaseRequirements) ? parsed.purchaseRequirements : [],
        sourceEvents: Array.isArray(parsed.sourceEvents) ? parsed.sourceEvents : [],
        offcuts: Array.isArray(parsed.offcuts) ? parsed.offcuts : [],
      };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private save(state: StoredState): void {
    this.storage.setItem(this.storageKey, JSON.stringify(state));
  }

  async getItem(companyId: Id, productId: Id): Promise<StockItem | null> {
    return structuredClone(this.load().items.find(x => x.companyId === companyId && x.id === productId) ?? null);
  }

  async listItems(companyId: Id): Promise<StockItem[]> {
    return structuredClone(this.load().items.filter(x => x.companyId === companyId));
  }

  async saveItem(item: StockItem): Promise<void> {
    const state = this.load();
    const index = state.items.findIndex(x => x.companyId === item.companyId && x.id === item.id);
    if (index >= 0) state.items[index] = structuredClone(item);
    else state.items.push(structuredClone(item));
    this.save(state);
  }

  async getLocation(companyId: Id, locationId: Id): Promise<StockLocation | null> {
    return structuredClone(this.load().locations.find(x => x.companyId === companyId && x.id === locationId) ?? null);
  }

  async listLocations(companyId: Id): Promise<StockLocation[]> {
    return structuredClone(this.load().locations.filter(x => x.companyId === companyId));
  }

  async saveLocation(location: StockLocation): Promise<void> {
    const state = this.load();
    const index = state.locations.findIndex(x => x.companyId === location.companyId && x.id === location.id);
    if (index >= 0) state.locations[index] = structuredClone(location);
    else state.locations.push(structuredClone(location));
    this.save(state);
  }

  async listMovements(companyId: Id, productId: Id): Promise<StockMovement[]> {
    return structuredClone(this.load().movements.filter(x => x.companyId === companyId && x.productId === productId));
  }

  async listAllMovements(companyId: Id): Promise<StockMovement[]> {
    return structuredClone(this.load().movements.filter(x => x.companyId === companyId));
  }

  async appendMovement(movement: StockMovement): Promise<void> {
    const state = this.load();
    state.movements.push(structuredClone(movement));
    this.save(state);
  }

  async listReservations(companyId: Id, productId: Id): Promise<StockReservation[]> {
    return structuredClone(this.load().reservations.filter(
      x => x.companyId === companyId && x.productId === productId,
    ));
  }

  async listAllReservations(companyId: Id): Promise<StockReservation[]> {
    return structuredClone(this.load().reservations.filter(x => x.companyId === companyId));
  }

  async getReservation(companyId: Id, reservationId: Id): Promise<StockReservation | null> {
    return structuredClone(this.load().reservations.find(
      x => x.companyId === companyId && x.id === reservationId,
    ) ?? null);
  }

  async saveReservation(reservation: StockReservation): Promise<void> {
    const state = this.load();
    const index = state.reservations.findIndex(
      x => x.companyId === reservation.companyId && x.id === reservation.id,
    );
    if (index >= 0) state.reservations[index] = structuredClone(reservation);
    else state.reservations.push(structuredClone(reservation));
    this.save(state);
  }

  async listPurchaseRequirements(companyId: Id): Promise<StockPurchaseRequirement[]> {
    return structuredClone(this.load().purchaseRequirements.filter(x => x.companyId === companyId));
  }

  async savePurchaseRequirement(requirement: StockPurchaseRequirement): Promise<void> {
    const state = this.load();
    const index = state.purchaseRequirements.findIndex(
      x => x.companyId === requirement.companyId && x.id === requirement.id,
    );
    if (index >= 0) state.purchaseRequirements[index] = structuredClone(requirement);
    else state.purchaseRequirements.push(structuredClone(requirement));
    this.save(state);
  }

  async hasProcessedSourceEvent(companyId: Id, sourceEventId: string): Promise<boolean> {
    return this.load().sourceEvents.includes(`${companyId}:${sourceEventId}`);
  }

  async markSourceEventProcessed(companyId: Id, sourceEventId: string): Promise<void> {
    const state = this.load();
    const key = `${companyId}:${sourceEventId}`;
    if (!state.sourceEvents.includes(key)) state.sourceEvents.push(key);
    this.save(state);
  }

  async listOffcuts(companyId: Id, productId?: Id): Promise<StockOffcut[]> {
    return structuredClone(this.load().offcuts.filter(
      x => x.companyId === companyId && (!productId || x.productId === productId),
    ));
  }

  async saveOffcut(offcut: StockOffcut): Promise<void> {
    const state = this.load();
    const index = state.offcuts.findIndex(x => x.companyId === offcut.companyId && x.id === offcut.id);
    if (index >= 0) state.offcuts[index] = structuredClone(offcut);
    else state.offcuts.push(structuredClone(offcut));
    this.save(state);
  }
}
