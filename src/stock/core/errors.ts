export type StockErrorCode =
  | "STOCK_INSUFFICIENT"
  | "PRODUCT_NOT_FOUND"
  | "LOCATION_NOT_FOUND"
  | "RESERVATION_NOT_FOUND"
  | "INVALID_QUANTITY"
  | "INVALID_UNIT"
  | "PERMISSION_DENIED"
  | "DUPLICATE_EVENT"
  | "CONNECTOR_UNAVAILABLE"
  | "UNSUPPORTED_EVENT"
  | "VALIDATION_REQUIRED"
  | "INVALID_MOVEMENT"
  | "INVALID_ITEM"
  | "INVALID_LOCATION";

export class StockDomainError extends Error {
  constructor(
    public readonly code: StockErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "StockDomainError";
  }
}
