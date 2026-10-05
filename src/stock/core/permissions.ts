import { StockDomainError } from "./errors";

export const STOCK_PERMISSIONS = [
  "stock.read",
  "stock.create",
  "stock.entry",
  "stock.exit",
  "stock.adjust",
  "stock.inventory",
  "stock.manage_locations",
  "stock.view_purchase_prices",
] as const;

export type StockPermission = typeof STOCK_PERMISSIONS[number];

export interface StockAuthorizationContext {
  userId: string;
  permissions: readonly string[];
}

export function assertStockPermission(context: StockAuthorizationContext, permission: StockPermission): void {
  if (!context.permissions.includes(permission)) {
    throw new StockDomainError("PERMISSION_DENIED", `Permission requise : ${permission}.`, {
      userId: context.userId,
      permission,
    });
  }
}
