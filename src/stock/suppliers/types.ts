import { Id, ISODateTime, StockUnit } from "../domain/types";

export type SupplierStockStatus =
  | "AVAILABLE"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "ON_ORDER"
  | "UNKNOWN";

export type SupplierDataFreshness = "FRESH" | "STALE" | "UNKNOWN";

export interface SupplierAvailability {
  supplierId: Id;
  supplierName: string;
  supplierProductId: string;
  supplierReference: string;
  productId: Id | null;
  designation: string;
  availableQuantity: number | null;
  unit: StockUnit;
  priceHt: number | null;
  stockStatus: SupplierStockStatus;
  lastSyncAt: ISODateTime | null;
  depotId: string | null;
  depotName: string | null;
  source: "demo" | "erp_api" | "file_sync";
  isDemo: boolean;
}

export interface SupplierAvailabilityView extends SupplierAvailability {
  freshness: SupplierDataFreshness;
  ageMinutes: number | null;
}

export interface SupplierAdapterStatus {
  ready: boolean;
  mode: "demo" | "contracts_only" | "live";
  label: string;
  reason?: string;
}

export interface SupplierStockAdapter {
  readonly supplierId: Id;
  readonly supplierName: string;
  getStatus(): SupplierAdapterStatus;
  search(query: string): Promise<SupplierAvailability[]>;
}

export interface SupplierActionDraft {
  id: Id;
  type: "QUOTE_REQUEST" | "ORDER_REQUEST";
  supplierId: Id;
  supplierName: string;
  supplierReference: string;
  productId: Id | null;
  designation: string;
  quantity: number;
  unit: StockUnit;
  targetModule: "supplier_quote" | "commandes";
  validationRequired: true;
  createdAt: ISODateTime;
  sourceAvailability: {
    availableQuantity: number | null;
    stockStatus: SupplierStockStatus;
    lastSyncAt: ISODateTime | null;
    freshness: SupplierDataFreshness;
  };
}
