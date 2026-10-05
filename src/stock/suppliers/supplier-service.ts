import { StockDomainError } from "../core/errors";
import {
  SupplierActionDraft,
  SupplierAvailability,
  SupplierAvailabilityView,
  SupplierDataFreshness,
  SupplierStockAdapter,
} from "./types";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

export class SupplierStockService {
  private readonly adapters = new Map<string, SupplierStockAdapter>();

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => crypto.randomUUID(),
    private readonly staleAfterMinutes = 180,
  ) {}

  register(adapter: SupplierStockAdapter): void {
    this.adapters.set(adapter.supplierId, adapter);
  }

  listAdapters() {
    return [...this.adapters.values()].map(adapter => ({
      supplierId: adapter.supplierId,
      supplierName: adapter.supplierName,
      status: adapter.getStatus(),
    }));
  }

  async search(query = ""): Promise<SupplierAvailabilityView[]> {
    const needle = normalize(query);
    const availableAdapters = [...this.adapters.values()].filter(adapter => adapter.getStatus().ready);

    const batches = await Promise.all(
      availableAdapters.map(async adapter => {
        const rows = await adapter.search(query);
        return rows.filter(row => {
          if (!needle) return true;
          return normalize([
            row.designation,
            row.supplierReference,
            row.supplierName,
            row.depotName ?? "",
          ].join(" ")).includes(needle);
        });
      }),
    );

    return batches
      .flat()
      .map(row => ({ ...row, ...this.freshness(row) }))
      .sort((a, b) => {
        const stockOrder = this.stockRank(a.stockStatus) - this.stockRank(b.stockStatus);
        if (stockOrder !== 0) return stockOrder;
        const freshnessOrder = this.freshnessRank(a.freshness) - this.freshnessRank(b.freshness);
        if (freshnessOrder !== 0) return freshnessOrder;
        return a.supplierName.localeCompare(b.supplierName, "fr");
      });
  }

  prepareQuoteDraft(
    availability: SupplierAvailabilityView,
    quantity: number,
  ): SupplierActionDraft {
    return this.prepareAction("QUOTE_REQUEST", availability, quantity);
  }

  prepareOrderDraft(
    availability: SupplierAvailabilityView,
    quantity: number,
  ): SupplierActionDraft {
    return this.prepareAction("ORDER_REQUEST", availability, quantity);
  }

  private prepareAction(
    type: SupplierActionDraft["type"],
    availability: SupplierAvailabilityView,
    quantity: number,
  ): SupplierActionDraft {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new StockDomainError(
        "INVALID_QUANTITY",
        "La quantité demandée doit être strictement positive.",
        { quantity },
      );
    }

    if (availability.freshness === "STALE") {
      throw new StockDomainError(
        "VALIDATION_REQUIRED",
        "La disponibilité fournisseur est périmée. Actualisez les données avant de préparer une action.",
        { lastSyncAt: availability.lastSyncAt },
      );
    }

    if (availability.stockStatus === "OUT_OF_STOCK") {
      throw new StockDomainError(
        "VALIDATION_REQUIRED",
        "Le fournisseur indique une rupture. Une action automatique n'est pas préparée.",
        { supplierReference: availability.supplierReference },
      );
    }

    return {
      id: this.id(),
      type,
      supplierId: availability.supplierId,
      supplierName: availability.supplierName,
      supplierReference: availability.supplierReference,
      productId: availability.productId,
      designation: availability.designation,
      quantity,
      unit: availability.unit,
      targetModule: type === "ORDER_REQUEST" ? "commandes" : "supplier_quote",
      validationRequired: true,
      createdAt: this.now(),
      sourceAvailability: {
        availableQuantity: availability.availableQuantity,
        stockStatus: availability.stockStatus,
        lastSyncAt: availability.lastSyncAt,
        freshness: availability.freshness,
      },
    };
  }

  private freshness(row: SupplierAvailability): {
    freshness: SupplierDataFreshness;
    ageMinutes: number | null;
  } {
    if (!row.lastSyncAt) return { freshness: "UNKNOWN", ageMinutes: null };
    const nowMs = new Date(this.now()).getTime();
    const syncMs = new Date(row.lastSyncAt).getTime();
    if (!Number.isFinite(nowMs) || !Number.isFinite(syncMs)) {
      return { freshness: "UNKNOWN", ageMinutes: null };
    }
    const ageMinutes = Math.max(0, Math.round((nowMs - syncMs) / 60_000));
    return {
      freshness: ageMinutes > this.staleAfterMinutes ? "STALE" : "FRESH",
      ageMinutes,
    };
  }

  private stockRank(status: SupplierAvailability["stockStatus"]): number {
    return ({
      AVAILABLE: 0,
      LOW_STOCK: 1,
      ON_ORDER: 2,
      UNKNOWN: 3,
      OUT_OF_STOCK: 4,
    })[status];
  }

  private freshnessRank(freshness: SupplierDataFreshness): number {
    return ({ FRESH: 0, UNKNOWN: 1, STALE: 2 })[freshness];
  }
}
