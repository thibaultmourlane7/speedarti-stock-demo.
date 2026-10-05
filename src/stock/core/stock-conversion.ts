import { StockDomainError } from "./errors";
import { StockItem, StockSecondaryDefinition, StockUnit } from "../domain/types";

export function secondaryQuantityPerPrimaryUnit(definition: StockSecondaryDefinition): number {
  switch (definition.mode) {
    case "manual":
      return definition.quantityPerPrimaryUnit;
    case "length":
      return definition.lengthMm / 1000;
    case "area":
      return (definition.lengthMm * definition.widthMm) / 1_000_000;
    case "volume":
      return (definition.lengthMm * definition.widthMm * definition.thicknessMm) / 1_000_000_000;
  }
}

export function validateSecondaryDefinition(
  primaryUnit: StockUnit,
  definition: StockSecondaryDefinition | null,
): void {
  if (!definition) return;

  const factor = secondaryQuantityPerPrimaryUnit(definition);
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new StockDomainError(
      "INVALID_QUANTITY",
      "Le conditionnement ou les dimensions doivent produire une quantité secondaire strictement positive.",
      { primaryUnit, definition },
    );
  }

  if (definition.secondaryUnit === primaryUnit) {
    throw new StockDomainError(
      "INVALID_UNIT",
      "L'unité secondaire doit être différente de l'unité principale.",
      { primaryUnit, secondaryUnit: definition.secondaryUnit },
    );
  }

  if (definition.mode === "length" && definition.secondaryUnit !== "ml") {
    throw new StockDomainError("INVALID_UNIT", "Une longueur secondaire doit être exprimée en ml.");
  }
  if (definition.mode === "area" && definition.secondaryUnit !== "m2") {
    throw new StockDomainError("INVALID_UNIT", "Une surface secondaire doit être exprimée en m².");
  }
  if (definition.mode === "volume" && definition.secondaryUnit !== "m3") {
    throw new StockDomainError("INVALID_UNIT", "Un volume secondaire doit être exprimé en m³.");
  }
}

export function convertQuantityToPrimary(
  item: StockItem,
  quantity: number,
  inputUnit: StockUnit | undefined,
): number {
  const unit = inputUnit ?? item.unit;
  if (unit === item.unit) return quantity;

  const secondary = item.secondary;
  if (!secondary || unit !== secondary.secondaryUnit) {
    throw new StockDomainError(
      "INVALID_UNIT",
      "Cette unité n'est pas disponible pour cet article.",
      { primaryUnit: item.unit, requestedUnit: unit, secondary: secondary?.secondaryUnit ?? null },
    );
  }

  const factor = secondaryQuantityPerPrimaryUnit(secondary);
  return quantity / factor;
}

export interface SecondaryQuantityView {
  unit: StockUnit;
  quantity: number;
  quantityPerPrimaryUnit: number;
  fullPrimaryUnits: number;
  secondaryRemainder: number;
}

export function secondaryQuantityView(
  item: StockItem,
  primaryQuantity: number,
): SecondaryQuantityView | null {
  if (!item.secondary) return null;
  const factor = secondaryQuantityPerPrimaryUnit(item.secondary);
  const secondaryQuantity = primaryQuantity * factor;
  const fullPrimaryUnits = Math.floor(primaryQuantity + 1e-9);
  const secondaryRemainder = Math.max(0, secondaryQuantity - fullPrimaryUnits * factor);
  return {
    unit: item.secondary.secondaryUnit,
    quantity: secondaryQuantity,
    quantityPerPrimaryUnit: factor,
    fullPrimaryUnits,
    secondaryRemainder,
  };
}
