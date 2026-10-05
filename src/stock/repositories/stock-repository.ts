import {
  Id,
  StockItem,
  StockLocation,
  StockMovement,
  StockOffcut,
  StockPurchaseRequirement,
  StockReservation,
} from "../domain/types";

export interface StockRepository {
  getItem(companyId: Id, productId: Id): Promise<StockItem | null>;
  listItems(companyId: Id): Promise<StockItem[]>;
  saveItem(item: StockItem): Promise<void>;

  getLocation(companyId: Id, locationId: Id): Promise<StockLocation | null>;
  listLocations(companyId: Id): Promise<StockLocation[]>;
  saveLocation(location: StockLocation): Promise<void>;

  listMovements(companyId: Id, productId: Id): Promise<StockMovement[]>;
  listAllMovements(companyId: Id): Promise<StockMovement[]>;
  appendMovement(movement: StockMovement): Promise<void>;

  listReservations(companyId: Id, productId: Id): Promise<StockReservation[]>;
  listAllReservations(companyId: Id): Promise<StockReservation[]>;
  getReservation(companyId: Id, reservationId: Id): Promise<StockReservation | null>;
  saveReservation(reservation: StockReservation): Promise<void>;

  listPurchaseRequirements(companyId: Id): Promise<StockPurchaseRequirement[]>;
  savePurchaseRequirement(requirement: StockPurchaseRequirement): Promise<void>;

  hasProcessedSourceEvent(companyId: Id, sourceEventId: string): Promise<boolean>;
  markSourceEventProcessed(companyId: Id, sourceEventId: string): Promise<void>;

  listOffcuts(companyId: Id, productId?: Id): Promise<StockOffcut[]>;
  saveOffcut(offcut: StockOffcut): Promise<void>;
}
