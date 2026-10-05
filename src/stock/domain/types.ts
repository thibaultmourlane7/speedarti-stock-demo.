/**
 * SpeedArti Stock — contrat métier Sprint A.
 *
 * Règle : la quantité physique n'est pas stockée dans StockItem.
 * Elle est dérivée des mouvements. Les réservations sont séparées.
 */

export type Id = string;
export type ISODateTime = string;

export const STOCK_SCHEMA_VERSION = "1.0" as const;

export type StockUnit =
  | "piece"
  | "ml"
  | "m2"
  | "m3"
  | "kg"
  | "litre"
  | "sac"
  | "boite"
  | "rouleau"
  | "palette";

export type StockFamily =
  | "materiaux"
  | "fournitures"
  | "consommables"
  | "outillage"
  | string;

export type StockLocationType =
  | "depot"
  | "atelier"
  | "vehicule"
  | "chantier"
  | "autre";

export interface StockItem {
  id: Id;
  companyId: Id;
  productId: Id | null;
  name: string;
  family: StockFamily;
  internalReference: string | null;
  unit: StockUnit;
  minimumQuantity: number | null;
  mainLocationId: Id | null;
  supplierId?: Id | null;
  supplierReference?: string | null;
  purchasePriceHt?: number | null;
  barcode?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface StockLocation {
  id: Id;
  companyId: Id;
  name: string;
  type: StockLocationType;
  chantierId?: Id | null;
  vehicleId?: Id | null;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type StockMovementType =
  | "ENTRY"
  | "EXIT"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "LOSS"
  | "BREAKAGE"
  | "SITE_RETURN";

export interface StockMovement {
  id: Id;
  companyId: Id;
  productId: Id;
  quantity: number;
  unit: StockUnit;
  movementType: StockMovementType;
  locationFromId: Id | null;
  locationToId: Id | null;
  chantierId: Id | null;
  userId: Id | null;
  sourceModule: string;
  sourceId: string | null;
  sourceEventId: string | null;
  reason: string | null;
  createdAt: ISODateTime;
}

export type ReservationStatus = "ACTIVE" | "RELEASED" | "CONSUMED";

export interface StockReservation {
  id: Id;
  companyId: Id;
  productId: Id;
  locationId: Id | null;
  chantierId: Id | null;
  quantity: number;
  unit: StockUnit;
  status: ReservationStatus;
  sourceModule: string;
  sourceId: string | null;
  sourceEventId: string | null;
  createdBy: Id | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface StockSnapshot {
  companyId: Id;
  productId: Id;
  locationId: Id | null;
  unit: StockUnit;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: "AVAILABLE" | "PARTIAL" | "OUT_OF_STOCK" | "LOW_STOCK";
}

export interface StockAlert {
  type: "LOW_STOCK" | "OUT_OF_STOCK" | "INVENTORY_DIFFERENCE";
  companyId: Id;
  productId: Id;
  locationId: Id | null;
  quantity: number;
  threshold?: number | null;
  createdAt: ISODateTime;
}

export interface InventoryCount {
  productId: Id;
  locationId: Id;
  theoreticalQuantity: number;
  countedQuantity: number;
  unit: StockUnit;
}

export interface InventorySession {
  id: Id;
  companyId: Id;
  status: "OPEN" | "COMPLETED";
  counts: InventoryCount[];
  createdBy: Id | null;
  createdAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface OrthogonalCell {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PointMm {
  xMm: number;
  yMm: number;
}

export interface StockOffcut {
  id: Id;
  companyId: Id;
  productId: Id;
  materialReference: string | null;
  supplierId: Id | null;
  decor: string | null;
  thicknessMm: number | null;
  lengthMm: number;
  widthMm: number;
  areaMm2: number;
  shapeType: "rectangle" | "orthogonal";
  cells: OrthogonalCell[];
  contours: PointMm[][];
  grainDirection: string | null;
  parentOffcutId: Id | null;
  sourceProjectId: Id | null;
  locationId: Id;
  status: "available" | "used" | "lost";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface HumanValidatedDraft<TPayload extends object = Record<string, unknown>> {
  id: Id;
  companyId: Id;
  type: "ENTRY" | "EXIT" | "TRANSFER" | "ADJUSTMENT";
  payload: TPayload;
  sourceModule: string;
  sourceId: string | null;
  validationRequired: true;
  validatedAt: ISODateTime | null;
  validatedBy: Id | null;
  createdAt: ISODateTime;
}
