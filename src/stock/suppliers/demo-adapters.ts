import { SupplierAvailability, SupplierStockAdapter } from "./types";

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

abstract class DemoSupplierAdapter implements SupplierStockAdapter {
  abstract readonly supplierId: string;
  abstract readonly supplierName: string;
  protected abstract rows(): SupplierAvailability[];

  getStatus() {
    return {
      ready: true,
      mode: "demo" as const,
      label: "Adaptateur de démonstration",
      reason: "Aucune donnée ERP/API réelle n'est utilisée.",
    };
  }

  async search(query: string): Promise<SupplierAvailability[]> {
    const q = norm(query.trim());
    const rows = this.rows();
    if (!q) return structuredClone(rows);
    return structuredClone(rows.filter(row =>
      norm([row.designation, row.supplierReference, row.supplierName].join(" ")).includes(q),
    ));
  }
}

/**
 * IMPORTANT : ces lignes sont des données fictives de démonstration.
 * Elles ne représentent ni les prix, ni les stocks, ni le catalogue réel d'Idea Bois.
 */
export class IdeaBoisDemoAdapter extends DemoSupplierAdapter {
  readonly supplierId = "supplier-demo-idea-bois";
  readonly supplierName = "Idea Bois — démo";

  constructor(private readonly now: () => string = () => new Date().toISOString()) {
    super();
  }

  protected rows(): SupplierAvailability[] {
    const sync = this.now();
    return [
      {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        supplierProductId: "idea-demo-001",
        supplierReference: "DEMO-IB-LAME-PIN-28",
        productId: null,
        designation: "Lame terrasse pin strié — exemple",
        availableQuantity: 180,
        unit: "piece",
        priceHt: null,
        stockStatus: "AVAILABLE",
        lastSyncAt: sync,
        depotId: "demo-depot-1",
        depotName: "Dépôt démo",
        source: "demo",
        isDemo: true,
      },
      {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        supplierProductId: "idea-demo-002",
        supplierReference: "DEMO-IB-LAMB-45",
        productId: null,
        designation: "Lambourde pin — exemple",
        availableQuantity: 24,
        unit: "piece",
        priceHt: null,
        stockStatus: "LOW_STOCK",
        lastSyncAt: sync,
        depotId: "demo-depot-1",
        depotName: "Dépôt démo",
        source: "demo",
        isDemo: true,
      },
      {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        supplierProductId: "idea-demo-003",
        supplierReference: "DEMO-IB-COMP-01",
        productId: null,
        designation: "Lame composite — exemple",
        availableQuantity: 0,
        unit: "piece",
        priceHt: null,
        stockStatus: "ON_ORDER",
        lastSyncAt: sync,
        depotId: "demo-depot-1",
        depotName: "Dépôt démo",
        source: "demo",
        isDemo: true,
      },
    ];
  }
}

/** Deuxième fournisseur fictif pour valider le multi-fournisseur. */
export class GenericSupplierDemoAdapter extends DemoSupplierAdapter {
  readonly supplierId = "supplier-demo-generic";
  readonly supplierName = "Fournisseur BTP — démo";

  constructor(private readonly now: () => string = () => new Date().toISOString()) {
    super();
  }

  protected rows(): SupplierAvailability[] {
    const sync = this.now();
    return [
      {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        supplierProductId: "generic-demo-001",
        supplierReference: "DEMO-FB-CHEV-7080",
        productId: null,
        designation: "Chevron 70 × 80 — exemple",
        availableQuantity: 60,
        unit: "piece",
        priceHt: null,
        stockStatus: "AVAILABLE",
        lastSyncAt: sync,
        depotId: "generic-depot",
        depotName: "Agence démo",
        source: "demo",
        isDemo: true,
      },
      {
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        supplierProductId: "generic-demo-002",
        supplierReference: "DEMO-FB-OSB18",
        productId: null,
        designation: "Panneau OSB 18 mm — exemple",
        availableQuantity: null,
        unit: "piece",
        priceHt: null,
        stockStatus: "UNKNOWN",
        lastSyncAt: null,
        depotId: "generic-depot",
        depotName: "Agence démo",
        source: "demo",
        isDemo: true,
      },
    ];
  }
}
