import {
  Id,
  StockItem,
  StockLocation,
  StockMovement,
  StockOffcut,
  StockReservation,
} from "../domain/types";

export interface StockRepository {
  getItem(companyId: Id, productId: Id): Promise<StockItem | null>;
  saveItem(item: StockItem): Promise<void>;

  getLocation(companyId: Id, locationId: Id): Promise<StockLocation | null>;
  saveLocation(location: StockLocation): Promise<void>;

  listMovements(companyId: Id, productId: Id): Promise<StockMovement[]>;
  appendMovement(movement: StockMovement): Promise<void>;

  listReservations(companyId: Id, productId: Id): Promise<StockReservation[]>;
  getReservation(companyId: Id, reservationId: Id): Promise<StockReservation | null>;
  saveReservation(reservation: StockReservation): Promise<void>;

  hasProcessedSourceEvent(companyId: Id, sourceEventId: string): Promise<boolean>;
  markSourceEventProcessed(companyId: Id, sourceEventId: string): Promise<void>;

  listOffcuts(companyId: Id, productId?: Id): Promise<StockOffcut[]>;
  saveOffcut(offcut: StockOffcut): Promise<void>;
}
