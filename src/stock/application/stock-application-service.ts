import { StockDomainError } from "../core/errors";
import { StockEngine } from "../core/stock-engine";
import {
  Id,
  StockFamily,
  StockItem,
  StockLocation,
  StockLocationType,
  StockMovement,
  StockSnapshot,
  StockUnit,
} from "../domain/types";
import { StockRepository } from "../repositories/stock-repository";

export const STOCK_UNITS: readonly StockUnit[] = [
  "piece", "ml", "m2", "m3", "kg", "litre", "sac", "boite", "rouleau", "palette",
];

export const DEFAULT_STOCK_FAMILIES = [
  "materiaux", "fournitures", "consommables", "outillage",
] as const;

export interface CreateItemInput {
  name: string;
  family: StockFamily;
  unit: StockUnit;
  initialQuantity?: number;
  locationId?: Id | null;
  minimumQuantity?: number | null;
  internalReference?: string | null;
  supplierReference?: string | null;
  barcode?: string | null;
  notes?: string | null;
}

export interface CreateLocationInput {
  name: string;
  type: StockLocationType;
  chantierId?: Id | null;
  vehicleId?: Id | null;
}

export interface RecordMovementInput {
  productId: Id;
  quantity: number;
  locationId: Id;
  chantierId?: Id | null;
  reason?: string | null;
}

export interface ItemStockView {
  item: StockItem;
  snapshot: StockSnapshot;
  mainLocation: StockLocation | null;
}

export interface MovementHistoryRow {
  movement: StockMovement;
  itemName: string;
  locationFromName: string | null;
  locationToName: string | null;
}

export interface DashboardSummary {
  articleCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  movementCount: number;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

export class StockApplicationService {
  readonly engine: StockEngine;

  constructor(
    private readonly repository: StockRepository,
    private readonly companyId: Id,
    private readonly userId: Id,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => crypto.randomUUID(),
  ) {
    this.engine = new StockEngine(repository, now, id);
  }

  async initialize(): Promise<StockLocation> {
    const locations = await this.repository.listLocations(this.companyId);
    const existing = locations.find(x => x.active && x.name === "Dépôt principal");
    if (existing) return existing;
    if (locations.some(x => x.active)) return locations.find(x => x.active)!;
    return this.createLocation({ name: "Dépôt principal", type: "depot" });
  }

  async createLocation(input: CreateLocationInput): Promise<StockLocation> {
    const name = text(input.name);
    if (!name) throw new StockDomainError("INVALID_LOCATION", "Le nom de l'emplacement est obligatoire.");
    const locations = await this.repository.listLocations(this.companyId);
    const duplicate = locations.find(x => x.active && normalizeSearch(x.name) === normalizeSearch(name));
    if (duplicate) return duplicate;

    const at = this.now();
    const location: StockLocation = {
      id: this.id(),
      companyId: this.companyId,
      name,
      type: input.type,
      chantierId: input.chantierId ?? null,
      vehicleId: input.vehicleId ?? null,
      active: true,
      createdAt: at,
      updatedAt: at,
    };
    await this.repository.saveLocation(location);
    return location;
  }

  async createItem(input: CreateItemInput): Promise<StockItem> {
    const name = text(input.name);
    const family = text(input.family);
    if (!name) throw new StockDomainError("INVALID_ITEM", "La désignation est obligatoire.");
    if (!family) throw new StockDomainError("INVALID_ITEM", "La famille est obligatoire.");
    if (!STOCK_UNITS.includes(input.unit)) {
      throw new StockDomainError("INVALID_UNIT", "Unité Stock inconnue.", { unit: input.unit });
    }
    if (
      input.minimumQuantity !== undefined &&
      input.minimumQuantity !== null &&
      (!Number.isFinite(input.minimumQuantity) || input.minimumQuantity < 0)
    ) {
      throw new StockDomainError("INVALID_QUANTITY", "Le seuil minimum doit être positif ou nul.");
    }

    const defaultLocation = await this.initialize();
    const locationId = input.locationId ?? defaultLocation.id;
    const location = await this.repository.getLocation(this.companyId, locationId);
    if (!location || !location.active) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement sélectionné introuvable.");
    }

    const at = this.now();
    const item: StockItem = {
      id: this.id(),
      companyId: this.companyId,
      productId: null,
      name,
      family,
      internalReference: text(input.internalReference) || null,
      unit: input.unit,
      minimumQuantity: input.minimumQuantity ?? null,
      mainLocationId: locationId,
      supplierReference: text(input.supplierReference) || null,
      barcode: text(input.barcode) || null,
      notes: text(input.notes) || null,
      active: true,
      createdAt: at,
      updatedAt: at,
    };
    await this.repository.saveItem(item);

    const initialQuantity = input.initialQuantity ?? 0;
    if (!Number.isFinite(initialQuantity) || initialQuantity < 0) {
      throw new StockDomainError("INVALID_QUANTITY", "La quantité initiale doit être positive ou nulle.");
    }
    if (initialQuantity > 0) {
      await this.engine.applyMovement({
        companyId: this.companyId,
        productId: item.id,
        quantity: initialQuantity,
        unit: item.unit,
        movementType: "ENTRY",
        locationToId: locationId,
        userId: this.userId,
        sourceModule: "stock_ui",
        sourceId: item.id,
        reason: "Stock initial",
      });
    }
    return item;
  }

  async recordEntry(input: RecordMovementInput): Promise<StockMovement> {
    const item = await this.requireItem(input.productId);
    return this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: input.quantity,
      unit: item.unit,
      movementType: "ENTRY",
      locationToId: input.locationId,
      chantierId: input.chantierId ?? null,
      userId: this.userId,
      sourceModule: "stock_ui",
      sourceId: item.id,
      reason: text(input.reason) || null,
    });
  }

  async recordExit(input: RecordMovementInput): Promise<StockMovement> {
    const item = await this.requireItem(input.productId);
    return this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: input.quantity,
      unit: item.unit,
      movementType: "EXIT",
      locationFromId: input.locationId,
      chantierId: input.chantierId ?? null,
      userId: this.userId,
      sourceModule: "stock_ui",
      sourceId: item.id,
      reason: text(input.reason) || null,
    });
  }

  async listLocations(): Promise<StockLocation[]> {
    const locations = await this.repository.listLocations(this.companyId);
    return locations.filter(x => x.active).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  async listItemViews(search = ""): Promise<ItemStockView[]> {
    const all = (await this.repository.listItems(this.companyId)).filter(x => x.active);
    const needle = normalizeSearch(search);
    const filtered = needle
      ? all.filter(item => normalizeSearch([
          item.name,
          item.internalReference,
          item.family,
          item.supplierReference,
          item.barcode,
        ].filter(Boolean).join(" ")).includes(needle))
      : all;

    const views = await Promise.all(filtered.map(async item => ({
      item,
      snapshot: await this.engine.snapshot(this.companyId, item.id, null),
      mainLocation: item.mainLocationId
        ? await this.repository.getLocation(this.companyId, item.mainLocationId)
        : null,
    })));
    return views.sort((a, b) => a.item.name.localeCompare(b.item.name, "fr"));
  }

  async movementHistory(limit = 100): Promise<MovementHistoryRow[]> {
    const [movements, items, locations] = await Promise.all([
      this.repository.listAllMovements(this.companyId),
      this.repository.listItems(this.companyId),
      this.repository.listLocations(this.companyId),
    ]);
    const itemNames = new Map(items.map(x => [x.id, x.name]));
    const locationNames = new Map(locations.map(x => [x.id, x.name]));
    return movements
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(movement => ({
        movement,
        itemName: itemNames.get(movement.productId) ?? "Article inconnu",
        locationFromName: movement.locationFromId ? locationNames.get(movement.locationFromId) ?? "Emplacement inconnu" : null,
        locationToName: movement.locationToId ? locationNames.get(movement.locationToId) ?? "Emplacement inconnu" : null,
      }));
  }

  async dashboard(): Promise<DashboardSummary> {
    const [views, movements] = await Promise.all([
      this.listItemViews(),
      this.repository.listAllMovements(this.companyId),
    ]);
    return {
      articleCount: views.length,
      lowStockCount: views.filter(x => x.snapshot.status === "LOW_STOCK").length,
      outOfStockCount: views.filter(x => x.snapshot.status === "OUT_OF_STOCK").length,
      movementCount: movements.length,
    };
  }

  private async requireItem(productId: Id): Promise<StockItem> {
    const item = await this.repository.getItem(this.companyId, productId);
    if (!item || !item.active) {
      throw new StockDomainError("PRODUCT_NOT_FOUND", "Article Stock introuvable.", { productId });
    }
    return item;
  }
}
