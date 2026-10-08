import { StockDomainError } from "../core/errors";
import { convertQuantityToPrimary, validateSecondaryDefinition } from "../core/stock-conversion";
import { StockEngine } from "../core/stock-engine";
import {
  Id,
  StockFamily,
  StockItem,
  StockLocation,
  StockLocationType,
  StockMovement,
  StockMovementType,
  StockPurchaseRequirement,
  StockReservation,
  StockSecondaryDefinition,
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

const EPSILON = 1e-9;

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
  section?: string | null;
  secondary?: StockSecondaryDefinition | null;
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
  unit?: StockUnit;
  locationId: Id;
  chantierId?: Id | null;
  reason?: string | null;
}

export interface CreateReservationInput {
  productId: Id;
  quantity: number;
  unit?: StockUnit;
  locationId: Id;
  chantierId: Id;
  reason?: string | null;
}

export interface CreatePurchaseRequirementInput {
  productId: Id;
  quantity: number;
  unit?: StockUnit;
  locationId?: Id | null;
  chantierId?: Id | null;
  reason?: string | null;
}

export interface TransferStockInput {
  productId: Id;
  quantity: number;
  unit?: StockUnit;
  fromLocationId: Id;
  toLocationId: Id;
  chantierId?: Id | null;
  reason?: string | null;
}

export interface StockIncidentInput extends RecordMovementInput {
  movementType: "LOSS" | "BREAKAGE";
}

export interface InventoryCorrectionInput {
  productId: Id;
  locationId: Id;
  countedQuantity: number;
  reason?: string | null;
}

export interface InventoryCorrectionResult {
  theoreticalQuantity: number;
  countedQuantity: number;
  difference: number;
  movement: StockMovement | null;
}

export interface ItemStockView {
  item: StockItem;
  snapshot: StockSnapshot;
  mainLocation: StockLocation | null;
}

export interface ReservationView {
  reservation: StockReservation;
  item: StockItem;
  location: StockLocation | null;
}

export interface PurchaseRequirementView {
  requirement: StockPurchaseRequirement;
  item: StockItem;
  location: StockLocation | null;
}

export interface LocationStockView {
  location: StockLocation;
  snapshot: StockSnapshot;
}

export interface InventoryRow {
  item: StockItem;
  location: StockLocation;
  theoreticalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
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
  activeReservationCount: number;
  purchaseRequirementCount: number;
}

export interface StockAlertView {
  id: string;
  type: "LOW_STOCK" | "OUT_OF_STOCK" | "INVENTORY_DIFFERENCE";
  item: StockItem;
  quantity: number;
  threshold: number | null;
  movementId: string | null;
  createdAt: string;
  message: string;
}

export interface CreateVehicleInput {
  name: string;
  registration?: string | null;
}

export interface VehicleStockLine {
  item: StockItem;
  snapshot: StockSnapshot;
}

export interface VehicleStockView {
  location: StockLocation;
  registration: string | null;
  referenceCount: number;
  reservedReferenceCount: number;
  lines: VehicleStockLine[];
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
    const initialQuantity = input.initialQuantity ?? 0;

    if (!name) throw new StockDomainError("INVALID_ITEM", "La désignation est obligatoire.");
    if (!family) throw new StockDomainError("INVALID_ITEM", "La famille est obligatoire.");
    if (!STOCK_UNITS.includes(input.unit)) {
      throw new StockDomainError("INVALID_UNIT", "Unité Stock inconnue.", { unit: input.unit });
    }
    if (!Number.isFinite(initialQuantity) || initialQuantity < 0) {
      throw new StockDomainError("INVALID_QUANTITY", "La quantité initiale doit être positive ou nulle.");
    }
    if (
      input.minimumQuantity !== undefined &&
      input.minimumQuantity !== null &&
      (!Number.isFinite(input.minimumQuantity) || input.minimumQuantity < 0)
    ) {
      throw new StockDomainError("INVALID_QUANTITY", "Le seuil minimum doit être positif ou nul.");
    }
    validateSecondaryDefinition(input.unit, input.secondary ?? null);

    const barcode = text(input.barcode) || null;
    if (barcode) {
      const items = await this.repository.listItems(this.companyId);
      const duplicateBarcode = items.find(item => item.active && text(item.barcode) === barcode);
      if (duplicateBarcode) {
        throw new StockDomainError(
          "INVALID_ITEM",
          "Ce code-barres est déjà associé à un autre article.",
          { barcode, existingProductId: duplicateBarcode.id },
        );
      }
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
      barcode,
      notes: text(input.notes) || null,
      section: text(input.section) || null,
      secondary: input.secondary ?? null,
      active: true,
      createdAt: at,
      updatedAt: at,
    };
    await this.repository.saveItem(item);

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
    const primaryQuantity = convertQuantityToPrimary(item, input.quantity, input.unit);
    return this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: primaryQuantity,
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
    return this.recordOutgoingMovement("EXIT", input);
  }

  async recordLoss(input: RecordMovementInput): Promise<StockMovement> {
    return this.recordOutgoingMovement("LOSS", input);
  }

  async recordBreakage(input: RecordMovementInput): Promise<StockMovement> {
    return this.recordOutgoingMovement("BREAKAGE", input);
  }

  async recordSiteReturn(input: RecordMovementInput): Promise<StockMovement> {
    const item = await this.requireItem(input.productId);
    const primaryQuantity = convertQuantityToPrimary(item, input.quantity, input.unit);
    return this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: primaryQuantity,
      unit: item.unit,
      movementType: "SITE_RETURN",
      locationToId: input.locationId,
      chantierId: input.chantierId ?? null,
      userId: this.userId,
      sourceModule: "stock_ui",
      sourceId: item.id,
      reason: text(input.reason) || "Retour chantier",
    });
  }

  async transferStock(input: TransferStockInput): Promise<StockMovement> {
    const item = await this.requireItem(input.productId);
    const primaryQuantity = convertQuantityToPrimary(item, input.quantity, input.unit);
    if (input.fromLocationId === input.toLocationId) {
      throw new StockDomainError("INVALID_MOVEMENT", "Le départ et l'arrivée doivent être différents.");
    }
    return this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: primaryQuantity,
      unit: item.unit,
      movementType: "TRANSFER",
      locationFromId: input.fromLocationId,
      locationToId: input.toLocationId,
      chantierId: input.chantierId ?? null,
      userId: this.userId,
      sourceModule: "stock_ui",
      sourceId: item.id,
      reason: text(input.reason) || "Transfert",
    });
  }

  async createReservation(input: CreateReservationInput): Promise<StockReservation> {
    const item = await this.requireItem(input.productId);
    const chantierId = text(input.chantierId);
    if (!chantierId) {
      throw new StockDomainError("VALIDATION_REQUIRED", "Le chantier est obligatoire pour réserver du stock.");
    }
    const primaryQuantity = convertQuantityToPrimary(item, input.quantity, input.unit);
    return this.engine.reserve({
      companyId: this.companyId,
      productId: item.id,
      quantity: primaryQuantity,
      unit: item.unit,
      locationId: input.locationId,
      chantierId,
      userId: this.userId,
      sourceModule: "stock_ui",
      sourceId: chantierId,
      reason: text(input.reason) || null,
    });
  }

  async releaseReservation(reservationId: Id): Promise<StockReservation> {
    return this.engine.releaseReservation(this.companyId, reservationId);
  }

  async listActiveReservations(): Promise<ReservationView[]> {
    const [reservations, items, locations] = await Promise.all([
      this.repository.listAllReservations(this.companyId),
      this.repository.listItems(this.companyId),
      this.repository.listLocations(this.companyId),
    ]);
    const itemMap = new Map(items.map(item => [item.id, item]));
    const locationMap = new Map(locations.map(location => [location.id, location]));
    return reservations
      .filter(reservation => reservation.status === "ACTIVE")
      .map(reservation => {
        const item = itemMap.get(reservation.productId);
        if (!item) return null;
        return {
          reservation,
          item,
          location: reservation.locationId ? locationMap.get(reservation.locationId) ?? null : null,
        } satisfies ReservationView;
      })
      .filter((value): value is ReservationView => value !== null)
      .sort((a, b) => b.reservation.createdAt.localeCompare(a.reservation.createdAt));
  }

  async createPurchaseRequirement(input: CreatePurchaseRequirementInput): Promise<StockPurchaseRequirement> {
    const item = await this.requireItem(input.productId);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new StockDomainError("INVALID_QUANTITY", "La quantité à réapprovisionner doit être strictement positive.");
    }
    const primaryQuantity = convertQuantityToPrimary(item, input.quantity, input.unit);
    const locationId = input.locationId ?? item.mainLocationId ?? null;
    if (locationId) {
      const location = await this.repository.getLocation(this.companyId, locationId);
      if (!location || !location.active) {
        throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement de réapprovisionnement introuvable.");
      }
    }

    const at = this.now();
    const requirement: StockPurchaseRequirement = {
      id: this.id(),
      companyId: this.companyId,
      productId: item.id,
      locationId,
      chantierId: text(input.chantierId) || null,
      quantity: primaryQuantity,
      unit: item.unit,
      status: "DRAFT",
      reason: text(input.reason) || null,
      sourceModule: "stock_ui",
      sourceId: item.id,
      createdBy: this.userId,
      createdAt: at,
      updatedAt: at,
    };
    await this.repository.savePurchaseRequirement(requirement);
    return requirement;
  }

  async listPurchaseRequirements(): Promise<PurchaseRequirementView[]> {
    const [requirements, items, locations] = await Promise.all([
      this.repository.listPurchaseRequirements(this.companyId),
      this.repository.listItems(this.companyId),
      this.repository.listLocations(this.companyId),
    ]);
    const itemMap = new Map(items.map(item => [item.id, item]));
    const locationMap = new Map(locations.map(location => [location.id, location]));
    return requirements
      .map(requirement => {
        const item = itemMap.get(requirement.productId);
        if (!item) return null;
        return {
          requirement,
          item,
          location: requirement.locationId ? locationMap.get(requirement.locationId) ?? null : null,
        } satisfies PurchaseRequirementView;
      })
      .filter((value): value is PurchaseRequirementView => value !== null)
      .sort((a, b) => b.requirement.createdAt.localeCompare(a.requirement.createdAt));
  }

  async applyInventoryCount(input: InventoryCorrectionInput): Promise<InventoryCorrectionResult> {
    if (!Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) {
      throw new StockDomainError("INVALID_QUANTITY", "La quantité comptée doit être positive ou nulle.");
    }
    const item = await this.requireItem(input.productId);
    const location = await this.repository.getLocation(this.companyId, input.locationId);
    if (!location || !location.active) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement d'inventaire introuvable.");
    }
    const snapshot = await this.engine.snapshot(this.companyId, item.id, location.id);
    const difference = input.countedQuantity - snapshot.physicalQuantity;
    if (Math.abs(difference) <= EPSILON) {
      return {
        theoreticalQuantity: snapshot.physicalQuantity,
        countedQuantity: input.countedQuantity,
        difference: 0,
        movement: null,
      };
    }

    const movement = await this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: difference,
      unit: item.unit,
      movementType: "ADJUSTMENT",
      locationFromId: difference < 0 ? location.id : null,
      locationToId: difference > 0 ? location.id : null,
      userId: this.userId,
      sourceModule: "stock_inventory",
      sourceId: item.id,
      reason: text(input.reason) || `Inventaire ${location.name}`,
    });

    return {
      theoreticalQuantity: snapshot.physicalQuantity,
      countedQuantity: input.countedQuantity,
      difference,
      movement,
    };
  }

  async inventoryRows(locationId: Id, search = ""): Promise<InventoryRow[]> {
    const location = await this.repository.getLocation(this.companyId, locationId);
    if (!location || !location.active) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement d'inventaire introuvable.");
    }
    const views = await this.listItemViews(search);
    const rows = await Promise.all(views.map(async ({ item }) => {
      const snapshot = await this.engine.snapshot(this.companyId, item.id, location.id);
      return {
        item,
        location,
        theoreticalQuantity: snapshot.physicalQuantity,
        reservedQuantity: snapshot.reservedQuantity,
        availableQuantity: snapshot.availableQuantity,
      } satisfies InventoryRow;
    }));
    return rows.sort((a, b) => a.item.name.localeCompare(b.item.name, "fr"));
  }

  async locationBreakdown(productId: Id): Promise<LocationStockView[]> {
    await this.requireItem(productId);
    const locations = await this.listLocations();
    const rows = await Promise.all(locations.map(async location => ({
      location,
      snapshot: await this.engine.snapshot(this.companyId, productId, location.id),
    })));
    return rows
      .filter(x => Math.abs(x.snapshot.physicalQuantity) > EPSILON || Math.abs(x.snapshot.reservedQuantity) > EPSILON)
      .sort((a, b) => a.location.name.localeCompare(b.location.name, "fr"));
  }

  async listLocations(): Promise<StockLocation[]> {
    const locations = await this.repository.listLocations(this.companyId);
    return locations.filter(x => x.active).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  async createVehicle(input: CreateVehicleInput): Promise<StockLocation> {
    const name = text(input.name);
    if (!name) {
      throw new StockDomainError("INVALID_LOCATION", "Le nom du véhicule est obligatoire.");
    }
    const registration = text(input.registration) || null;
    return this.createLocation({
      name,
      type: "vehicule",
      vehicleId: registration,
    });
  }

  async listVehicleStocks(): Promise<VehicleStockView[]> {
    const [locations, items] = await Promise.all([
      this.listLocations(),
      this.repository.listItems(this.companyId),
    ]);
    const vehicles = locations.filter(location => location.type === "vehicule" && location.active);

    const views = await Promise.all(vehicles.map(async location => {
      const lines = (await Promise.all(
        items
          .filter(item => item.active)
          .map(async item => ({
            item,
            snapshot: await this.engine.snapshot(this.companyId, item.id, location.id),
          })),
      ))
        .filter(line => Math.abs(line.snapshot.physicalQuantity) > EPSILON || Math.abs(line.snapshot.reservedQuantity) > EPSILON)
        .sort((a, b) => a.item.name.localeCompare(b.item.name, "fr"));

      return {
        location,
        registration: location.vehicleId ?? null,
        referenceCount: lines.filter(line => line.snapshot.physicalQuantity > EPSILON).length,
        reservedReferenceCount: lines.filter(line => line.snapshot.reservedQuantity > EPSILON).length,
        lines,
      } satisfies VehicleStockView;
    }));

    return views.sort((a, b) => a.location.name.localeCompare(b.location.name, "fr"));
  }

  async findItemByBarcode(rawCode: string): Promise<StockItem | null> {
    const code = text(rawCode);
    if (!code) return null;
    const items = await this.repository.listItems(this.companyId);
    return items.find(item => item.active && text(item.barcode) === code) ?? null;
  }

  async getItemView(productId: Id): Promise<ItemStockView> {
    const item = await this.requireItem(productId);
    return {
      item,
      snapshot: await this.engine.snapshot(this.companyId, item.id, null),
      mainLocation: item.mainLocationId
        ? await this.repository.getLocation(this.companyId, item.mainLocationId)
        : null,
    };
  }

  async getLocation(locationId: Id): Promise<StockLocation> {
    const location = await this.repository.getLocation(this.companyId, locationId);
    if (!location || !location.active) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement Stock introuvable.", { locationId });
    }
    return location;
  }

  async listItemViews(search = ""): Promise<ItemStockView[]> {
    const all = (await this.repository.listItems(this.companyId)).filter(x => x.active);
    const needle = normalizeSearch(search);
    const filtered = needle
      ? all.filter(item => normalizeSearch([
          item.name,
          item.internalReference,
          item.family,
          item.section,
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

  async listAlerts(): Promise<StockAlertView[]> {
    const [views, movements] = await Promise.all([
      this.listItemViews(),
      this.repository.listAllMovements(this.companyId),
    ]);

    const current: StockAlertView[] = views
      .filter(view => view.snapshot.status === "LOW_STOCK" || view.snapshot.status === "OUT_OF_STOCK")
      .map(view => {
        const type = view.snapshot.status === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "LOW_STOCK";
        return {
          id: `${type}:${view.item.id}`,
          type,
          item: view.item,
          quantity: view.snapshot.availableQuantity,
          threshold: view.item.minimumQuantity,
          movementId: null,
          createdAt: this.now(),
          message: type === "OUT_OF_STOCK"
            ? "Article en rupture."
            : `Stock disponible sous le seuil minimum${view.item.minimumQuantity === null ? "" : ` de ${view.item.minimumQuantity}`}.`,
        } satisfies StockAlertView;
      });

    const itemMap = new Map(views.map(view => [view.item.id, view.item]));
    const inventory = movements
      .filter(movement => movement.movementType === "ADJUSTMENT" && movement.sourceModule === "stock_inventory")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .reduce<StockAlertView[]>((alerts, movement) => {
        const item = itemMap.get(movement.productId);
        if (!item) return alerts;
        alerts.push({
          id: `INVENTORY_DIFFERENCE:${movement.id}`,
          type: "INVENTORY_DIFFERENCE",
          item,
          quantity: movement.quantity,
          threshold: item.minimumQuantity,
          movementId: movement.id,
          createdAt: movement.createdAt,
          message: `Écart d'inventaire corrigé de ${movement.quantity > 0 ? "+" : ""}${movement.quantity} ${item.unit}.`,
        });
        return alerts;
      }, []);

    const order: Record<StockAlertView["type"], number> = {
      OUT_OF_STOCK: 0,
      LOW_STOCK: 1,
      INVENTORY_DIFFERENCE: 2,
    };

    return [...current, ...inventory].sort((a, b) => {
      const typeOrder = order[a.type] - order[b.type];
      return typeOrder !== 0 ? typeOrder : b.createdAt.localeCompare(a.createdAt);
    });
  }

  async dashboard(): Promise<DashboardSummary> {
    const [views, movements, reservations, requirements] = await Promise.all([
      this.listItemViews(),
      this.repository.listAllMovements(this.companyId),
      this.repository.listAllReservations(this.companyId),
      this.repository.listPurchaseRequirements(this.companyId),
    ]);
    return {
      articleCount: views.length,
      lowStockCount: views.filter(x => x.snapshot.status === "LOW_STOCK").length,
      outOfStockCount: views.filter(x => x.snapshot.status === "OUT_OF_STOCK").length,
      movementCount: movements.length,
      activeReservationCount: reservations.filter(x => x.status === "ACTIVE").length,
      purchaseRequirementCount: requirements.filter(x => x.status === "DRAFT").length,
    };
  }

  private async recordOutgoingMovement(
    movementType: Extract<StockMovementType, "EXIT" | "LOSS" | "BREAKAGE">,
    input: RecordMovementInput,
  ): Promise<StockMovement> {
    const item = await this.requireItem(input.productId);
    const primaryQuantity = convertQuantityToPrimary(item, input.quantity, input.unit);
    return this.engine.applyMovement({
      companyId: this.companyId,
      productId: item.id,
      quantity: primaryQuantity,
      unit: item.unit,
      movementType,
      locationFromId: input.locationId,
      chantierId: input.chantierId ?? null,
      userId: this.userId,
      sourceModule: "stock_ui",
      sourceId: item.id,
      reason: text(input.reason) || null,
    });
  }

  private async requireItem(productId: Id): Promise<StockItem> {
    const item = await this.repository.getItem(this.companyId, productId);
    if (!item || !item.active) {
      throw new StockDomainError("PRODUCT_NOT_FOUND", "Article Stock introuvable.", { productId });
    }
    return item;
  }
}
