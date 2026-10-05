import { StockApplicationService } from "../application/stock-application-service";
import { StockDomainError } from "../core/errors";
import { StockItem, StockLocation, StockUnit } from "../domain/types";

export type ExpertScanAction =
  | "SELECT_PRODUCT"
  | "ENTRY"
  | "EXIT"
  | "TRANSFER"
  | "SITE_RETURN";

export interface ExpertScanDraft {
  rawCode: string;
  sourceKind: "BARCODE" | "SPEEDARTI_QR";
  action: ExpertScanAction;
  item: StockItem;
  quantity: number | null;
  unit: StockUnit;
  locationFrom: StockLocation | null;
  locationTo: StockLocation | null;
  chantierId: string | null;
  validationRequired: true;
  applied: false;
  message: string;
}

export interface CreateExpertQrInput {
  action: Exclude<ExpertScanAction, "SELECT_PRODUCT">;
  productId: string;
  quantity: number;
  unit: StockUnit;
  locationFromId?: string | null;
  locationToId?: string | null;
  chantierId?: string | null;
}

export class StockExpertScanService {
  constructor(private readonly stock: StockApplicationService) {}

  async resolve(rawCode: string): Promise<ExpertScanDraft> {
    const raw = rawCode.trim();
    if (!raw) {
      throw new StockDomainError("VALIDATION_REQUIRED", "Le code scanné est vide.");
    }

    if (raw.toLowerCase().startsWith("speedarti://stock/v1")) {
      return this.resolveSpeedArtiQr(raw);
    }

    const item = await this.stock.findItemByBarcode(raw);
    if (!item) {
      throw new StockDomainError(
        "PRODUCT_NOT_FOUND",
        "Aucun article Stock ne correspond à ce code-barres.",
        { barcode: raw },
      );
    }

    return {
      rawCode: raw,
      sourceKind: "BARCODE",
      action: "SELECT_PRODUCT",
      item,
      quantity: null,
      unit: item.unit,
      locationFrom: null,
      locationTo: null,
      chantierId: null,
      validationRequired: true,
      applied: false,
      message: "Article identifié. Choisissez l'action à effectuer ; aucun mouvement n'est créé par le scan seul.",
    };
  }

  createQrPayload(input: CreateExpertQrInput): string {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new StockDomainError("INVALID_QUANTITY", "La quantité du QR doit être strictement positive.");
    }

    const url = new URL("speedarti://stock/v1");
    url.searchParams.set("action", input.action);
    url.searchParams.set("product", input.productId);
    url.searchParams.set("quantity", String(input.quantity));
    url.searchParams.set("unit", input.unit);
    if (input.locationFromId) url.searchParams.set("from", input.locationFromId);
    if (input.locationToId) url.searchParams.set("to", input.locationToId);
    if (input.chantierId) url.searchParams.set("chantier", input.chantierId);
    return url.toString();
  }

  async confirm(draft: ExpertScanDraft, confirmed: boolean): Promise<void> {
    if (!confirmed) {
      throw new StockDomainError(
        "VALIDATION_REQUIRED",
        "Une validation humaine explicite est obligatoire avant toute écriture issue d'un scan.",
      );
    }
    if (draft.action === "SELECT_PRODUCT") {
      throw new StockDomainError(
        "VALIDATION_REQUIRED",
        "Un simple code-barres identifie l'article mais ne définit pas l'action Stock.",
      );
    }
    if (draft.quantity === null || draft.quantity <= 0) {
      throw new StockDomainError("INVALID_QUANTITY", "La quantité du brouillon scan est invalide.");
    }

    if (draft.action === "ENTRY") {
      if (!draft.locationTo) throw new StockDomainError("LOCATION_NOT_FOUND", "Destination manquante.");
      await this.stock.recordEntry({
        productId: draft.item.id,
        quantity: draft.quantity,
        unit: draft.unit,
        locationId: draft.locationTo.id,
        chantierId: draft.chantierId,
        reason: "Entrée confirmée après scan QR",
      });
      return;
    }

    if (draft.action === "EXIT") {
      if (!draft.locationFrom) throw new StockDomainError("LOCATION_NOT_FOUND", "Emplacement de sortie manquant.");
      await this.stock.recordExit({
        productId: draft.item.id,
        quantity: draft.quantity,
        unit: draft.unit,
        locationId: draft.locationFrom.id,
        chantierId: draft.chantierId,
        reason: "Sortie confirmée après scan QR",
      });
      return;
    }

    if (draft.action === "TRANSFER") {
      if (!draft.locationFrom || !draft.locationTo) {
        throw new StockDomainError("LOCATION_NOT_FOUND", "Origine ou destination du transfert manquante.");
      }
      await this.stock.transferStock({
        productId: draft.item.id,
        quantity: draft.quantity,
        unit: draft.unit,
        fromLocationId: draft.locationFrom.id,
        toLocationId: draft.locationTo.id,
        chantierId: draft.chantierId,
        reason: "Transfert confirmé après scan QR",
      });
      return;
    }

    if (!draft.locationTo) throw new StockDomainError("LOCATION_NOT_FOUND", "Destination du retour manquante.");
    await this.stock.recordSiteReturn({
      productId: draft.item.id,
      quantity: draft.quantity,
      unit: draft.unit,
      locationId: draft.locationTo.id,
      chantierId: draft.chantierId,
      reason: "Retour chantier confirmé après scan QR",
    });
  }

  private async resolveSpeedArtiQr(raw: string): Promise<ExpertScanDraft> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new StockDomainError("VALIDATION_REQUIRED", "QR SpeedArti illisible.");
    }

    if (url.protocol !== "speedarti:" || url.hostname !== "stock" || url.pathname !== "/v1") {
      throw new StockDomainError("VALIDATION_REQUIRED", "Format QR SpeedArti non reconnu.");
    }

    const productId = (url.searchParams.get("product") ?? "").trim();
    const action = this.parseAction(url.searchParams.get("action"));
    const quantity = Number(url.searchParams.get("quantity"));
    const unit = (url.searchParams.get("unit") ?? "") as StockUnit;
    const chantierId = (url.searchParams.get("chantier") ?? "").trim() || null;
    const fromId = (url.searchParams.get("from") ?? "").trim() || null;
    const toId = (url.searchParams.get("to") ?? "").trim() || null;

    if (!productId) throw new StockDomainError("PRODUCT_NOT_FOUND", "Le QR ne contient aucun article.");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new StockDomainError("INVALID_QUANTITY", "Le QR contient une quantité invalide.");
    }

    const view = await this.stock.getItemView(productId);
    const allowedUnits: StockUnit[] = [view.item.unit];
    if (view.item.secondary) allowedUnits.push(view.item.secondary.secondaryUnit);
    if (!allowedUnits.includes(unit)) {
      throw new StockDomainError(
        "INVALID_UNIT",
        "L'unité du QR ne correspond pas à l'article.",
        { unit, allowedUnits },
      );
    }

    const locationFrom = fromId ? await this.stock.getLocation(fromId) : null;
    const locationTo = toId ? await this.stock.getLocation(toId) : null;

    if (action === "ENTRY" && !locationTo) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Le QR d'entrée doit contenir une destination.");
    }
    if (action === "EXIT" && !locationFrom) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Le QR de sortie doit contenir un emplacement.");
    }
    if (action === "TRANSFER" && (!locationFrom || !locationTo)) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Le QR de transfert doit contenir origine et destination.");
    }
    if (action === "SITE_RETURN" && !locationTo) {
      throw new StockDomainError("LOCATION_NOT_FOUND", "Le QR de retour doit contenir une destination.");
    }

    return {
      rawCode: raw,
      sourceKind: "SPEEDARTI_QR",
      action,
      item: view.item,
      quantity,
      unit,
      locationFrom,
      locationTo,
      chantierId,
      validationRequired: true,
      applied: false,
      message: "QR analysé. Vérifiez l'article, la quantité et l'emplacement avant de confirmer.",
    };
  }

  private parseAction(value: string | null): Exclude<ExpertScanAction, "SELECT_PRODUCT"> {
    const action = (value ?? "").toUpperCase();
    if (action === "ENTRY" || action === "EXIT" || action === "TRANSFER" || action === "SITE_RETURN") {
      return action;
    }
    throw new StockDomainError("VALIDATION_REQUIRED", "Action QR Stock inconnue.", { action });
  }
}
