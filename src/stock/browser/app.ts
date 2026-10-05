import { StockApplicationService } from "../application/stock-application-service";
import { AngelSupplierSearchService } from "../angele/supplier-search";
import { StockDomainError } from "../core/errors";
import { secondaryQuantityView } from "../core/stock-conversion";
import { StockItem, StockLocation, StockMovementType, StockSecondaryDefinition, StockUnit } from "../domain/types";
import { loadBtpDemoData } from "../demo/demo-data";
import { LocalStorageStockRepository } from "../repositories/local-storage-stock-repository";
import { ExpertScanDraft, StockExpertScanService } from "../expert/scan-service";
import { GenericSupplierDemoAdapter, IdeaBoisDemoAdapter } from "../suppliers/demo-adapters";
import { SupplierStockService } from "../suppliers/supplier-service";
import { SupplierActionDraft, SupplierAvailabilityView, SupplierStockStatus } from "../suppliers/types";

const COMPANY_ID = "demo-company";
const USER_ID = "demo-user";
const repository = new LocalStorageStockRepository(window.localStorage);
const service = new StockApplicationService(repository, COMPANY_ID, USER_ID);
const supplierService = new SupplierStockService();
supplierService.register(new IdeaBoisDemoAdapter());
supplierService.register(new GenericSupplierDemoAdapter());
const angelSupplierService = new AngelSupplierSearchService(supplierService);
const expertScanService = new StockExpertScanService(service);

const $ = <T extends Element>(selector: string): T => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Élément DOM introuvable : ${selector}`);
  return element as T;
};

const UNIT_LABELS: Record<StockUnit, string> = {
  piece: "pièce", ml: "ml", m2: "m²", m3: "m³", kg: "kg", litre: "L",
  sac: "sac", boite: "boîte", rouleau: "rouleau", palette: "palette",
};

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  ENTRY: "Entrée", EXIT: "Sortie", TRANSFER: "Transfert", ADJUSTMENT: "Ajustement",
  LOSS: "Perte", BREAKAGE: "Casse", SITE_RETURN: "Retour chantier",
};

let search = "";
let supplierSearch = "";
let lastSupplierDraft: SupplierActionDraft | null = null;
let currentScanDraft: ExpertScanDraft | null = null;
let expertCameraStream: MediaStream | null = null;
let expertCameraFrame = 0;
let toastTimer: number | null = null;

function quantity(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value);
}
function unitLabel(unit: StockUnit, value = 2): string {
  const singular = UNIT_LABELS[unit];
  if (Math.abs(value) === 1) return singular;
  if (unit === "piece") return "pièces";
  if (unit === "boite") return "boîtes";
  if (unit === "sac") return "sacs";
  if (unit === "rouleau") return "rouleaux";
  if (unit === "palette") return "palettes";
  return singular;
}

function stockQuantityLines(item: StockItem, primaryQuantity: number): { main: string; secondary: string | null } {
  const secondary = secondaryQuantityView(item, primaryQuantity);
  if (!secondary) {
    return { main: `${quantity(primaryQuantity)} ${unitLabel(item.unit, primaryQuantity)}`, secondary: null };
  }

  const packagingUnits: StockUnit[] = ["boite", "sac", "rouleau", "palette"];
  const hasRemainder = secondary.secondaryRemainder > 1e-6;
  const main = packagingUnits.includes(item.unit) && hasRemainder
    ? `${secondary.fullPrimaryUnits} ${unitLabel(item.unit, secondary.fullPrimaryUnits)} complètes + ${quantity(secondary.secondaryRemainder)} ${unitLabel(secondary.unit, secondary.secondaryRemainder)}`
    : `${quantity(primaryQuantity)} ${unitLabel(item.unit, primaryQuantity)}`;

  return {
    main,
    secondary: `${quantity(secondary.quantity)} ${unitLabel(secondary.unit, secondary.quantity)} au total`,
  };
}

function setUnitOptions(select: HTMLSelectElement, item: StockItem): void {
  const options = [{ value: item.unit, label: unitLabel(item.unit) }];
  if (item.secondary) {
    options.push({ value: item.secondary.secondaryUnit, label: unitLabel(item.secondary.secondaryUnit) });
  }
  select.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join("");
  select.value = item.unit;
}

function secondaryDefinitionFromForm(data: FormData): StockSecondaryDefinition | null {
  const mode = String(data.get("secondaryMode") ?? "none");
  if (mode === "none") return null;

  if (mode === "manual") {
    return {
      mode: "manual",
      secondaryUnit: String(data.get("secondaryUnit") ?? "piece") as StockUnit,
      quantityPerPrimaryUnit: Number(data.get("secondaryPerPrimary") ?? 0),
    };
  }

  const lengthM = Number(data.get(mode === "length" ? "lengthOnlyM" : mode === "area" ? "areaLengthM" : "volumeLengthM") ?? 0);
  const lengthMm = lengthM * 1000;
  if (mode === "length") {
    return { mode: "length", secondaryUnit: "ml", lengthMm };
  }

  const widthM = Number(data.get(mode === "area" ? "areaWidthM" : "volumeWidthM") ?? 0);
  const widthMm = widthM * 1000;
  if (mode === "area") {
    return { mode: "area", secondaryUnit: "m2", lengthMm, widthMm };
  }

  const thicknessMm = Number(data.get("thicknessMm") ?? 0);
  return { mode: "volume", secondaryUnit: "m3", lengthMm, widthMm, thicknessMm };
}
function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function escapeHtml(value: string): string {
  const div = document.createElement("div"); div.textContent = value; return div.innerHTML;
}
function showToast(message: string, error = false): void {
  const toast = $("#toast") as HTMLDivElement;
  toast.textContent = message; toast.classList.toggle("error", error); toast.classList.add("show");
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}
function explainError(error: unknown): string {
  if (error instanceof StockDomainError) {
    if (error.code === "STOCK_INSUFFICIENT") {
      const available = Number(error.details.availableQuantity ?? 0);
      return `Stock insuffisant. Disponible : ${quantity(available)}.`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}
function locationTypeLabel(type: StockLocation["type"]): string {
  return ({ depot: "Dépôt", atelier: "Atelier", vehicule: "Véhicule", chantier: "Chantier", autre: "Autre" })[type];
}
function statusBadge(status: string): string {
  if (status === "OUT_OF_STOCK") return `<span class="badge out">Rupture</span>`;
  if (status === "LOW_STOCK") return `<span class="badge low">Stock faible</span>`;
  return `<span class="badge good">Disponible</span>`;
}

function supplierStatus(status: SupplierStockStatus): { label: string; css: string } {
  return ({
    AVAILABLE: { label: "Disponible", css: "good" },
    LOW_STOCK: { label: "Stock faible", css: "low" },
    OUT_OF_STOCK: { label: "Rupture", css: "out" },
    ON_ORDER: { label: "Sur commande", css: "info" },
    UNKNOWN: { label: "Inconnu", css: "neutral" },
  })[status];
}

function supplierFreshness(row: SupplierAvailabilityView): string {
  if (row.freshness === "FRESH") return row.ageMinutes === 0 ? "Synchronisé à l'instant" : `Synchronisé il y a ${row.ageMinutes} min`;
  if (row.freshness === "STALE") return `Donnée périmée · ${row.ageMinutes ?? "?"} min`;
  return "Date de synchronisation inconnue";
}

function euro(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function renderSupplierDraft(): void {
  const box = $("#supplier-draft") as HTMLDivElement;
  if (!lastSupplierDraft) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }

  box.hidden = false;
  box.innerHTML = `
    <div>
      <strong>${lastSupplierDraft.type === "ORDER_REQUEST" ? "Brouillon de commande préparé" : "Demande de devis préparée"}</strong>
      <span>${escapeHtml(lastSupplierDraft.supplierName)} · ${escapeHtml(lastSupplierDraft.designation)} · ${quantity(lastSupplierDraft.quantity)} ${unitLabel(lastSupplierDraft.unit, lastSupplierDraft.quantity)}</span>
    </div>
    <span class="badge info">Validation humaine obligatoire</span>
  `;
}

async function fillLocationSelects(): Promise<void> {
  const locations = await service.listLocations();
  const options = locations.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join("");
  for (const id of ["item-location-select", "movement-location-select", "transfer-from-select", "transfer-to-select", "incident-location-select", "inventory-location-select", "reservation-location-select", "replenish-location-select"]) {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (el) el.innerHTML = options;
  }
}

async function renderDashboard(): Promise<void> {
  const summary = await service.dashboard();
  $("#stat-articles").textContent = String(summary.articleCount);
  $("#stat-low").textContent = String(summary.lowStockCount);
  $("#stat-out").textContent = String(summary.outOfStockCount);
  $("#stat-movements").textContent = String(summary.movementCount);
  $("#stat-reservations").textContent = String(summary.activeReservationCount);
  $("#stat-replenish").textContent = String(summary.purchaseRequirementCount);
  const demoButton = document.getElementById("load-demo-button") as HTMLButtonElement | null;
  if (demoButton) demoButton.hidden = summary.articleCount > 0;
}

async function renderStock(): Promise<void> {
  const views = await service.listItemViews(search);
  const list = $("#stock-list") as HTMLDivElement;
  if (!views.length) {
    list.innerHTML = `<div class="empty"><strong>${search ? "Aucun article trouvé" : "Votre stock est vide"}</strong><span>${search ? "Essayez une autre recherche." : "Ajoutez votre premier article pour commencer."}</span></div>`;
    return;
  }

  const blocks = await Promise.all(views.map(async ({ item, snapshot, mainLocation }) => {
    const breakdown = await service.locationBreakdown(item.id);
    const locations = breakdown.length
      ? `<div class="location-breakdown">${breakdown.map(row => {
          const local = stockQuantityLines(item, row.snapshot.physicalQuantity);
          return `<span><strong>${escapeHtml(row.location.name)}</strong> ${escapeHtml(local.main)}${local.secondary ? ` · ${escapeHtml(local.secondary)}` : ""}</span>`;
        }).join("")}</div>`
      : `<div class="location-breakdown"><span>Aucune quantité physique localisée.</span></div>`;
    const availableDisplay = stockQuantityLines(item, snapshot.availableQuantity);
    const physicalDisplay = stockQuantityLines(item, snapshot.physicalQuantity);
    const reservedDisplay = stockQuantityLines(item, snapshot.reservedQuantity);
    return `
      <article class="stock-card" data-product-id="${escapeHtml(item.id)}">
        <div>
          <div class="stock-title"><h3>${escapeHtml(item.name)}</h3>${statusBadge(snapshot.status)}</div>
          <div class="stock-meta">
            <span>${escapeHtml(item.family)}</span>
            ${item.internalReference ? `<span>Réf. ${escapeHtml(item.internalReference)}</span>` : ""}
            <span>Principal : ${escapeHtml(mainLocation?.name ?? "Sans emplacement")}</span>
            ${item.minimumQuantity !== null ? `<span>Seuil : ${quantity(item.minimumQuantity)} ${UNIT_LABELS[item.unit]}</span>` : ""}
          </div>
          ${locations}
        </div>
        <div class="stock-qty">
          <strong>${escapeHtml(availableDisplay.main)}</strong>
          <span>${availableDisplay.secondary ? `${escapeHtml(availableDisplay.secondary)} · ` : ""}${snapshot.reservedQuantity > 0 ? `${escapeHtml(physicalDisplay.main)} physique · ${escapeHtml(reservedDisplay.main)} réservé` : "disponible"}</span>
        </div>
        <div class="stock-actions">
          <button class="button secondary small" data-action="entry">+ Entrée</button>
          <button class="button danger-soft small" data-action="exit">− Sortie</button>
          <button class="button ghost small" data-action="transfer">⇄ Transférer</button>
          <button class="button ghost small" data-action="reserve">Réserver</button>
          <button class="button secondary small" data-action="replenish">Réapprovisionner</button>
          <button class="button ghost small" data-action="incident">Autre mouvement</button>
        </div>
      </article>`;
  }));
  list.innerHTML = blocks.join("");

  list.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const card = button.closest<HTMLElement>("[data-product-id]");
      const productId = card?.dataset.productId;
      const action = button.dataset.action;
      if (!productId) return;
      if (action === "entry" || action === "exit") await openMovement(productId, action);
      else if (action === "transfer") await openTransfer(productId);
      else if (action === "reserve") await openReservation(productId);
      else if (action === "replenish") await openReplenish(productId);
      else if (action === "incident") await openIncident(productId);
    });
  });
}

async function renderAlerts(): Promise<void> {
  const alerts = await service.listAlerts();
  const list = $("#alert-list") as HTMLDivElement;
  if (!alerts.length) {
    list.innerHTML = `<div class="empty"><strong>Aucune alerte</strong><span>Les ruptures, stocks faibles et écarts d'inventaire apparaîtront ici.</span></div>`;
    return;
  }

  list.innerHTML = alerts.map(alert => {
    const kind = alert.type === "OUT_OF_STOCK"
      ? { label: "Rupture", css: "out" }
      : alert.type === "LOW_STOCK"
        ? { label: "Stock faible", css: "low" }
        : { label: "Écart inventaire", css: "info" };
    const display = stockQuantityLines(alert.item, alert.quantity);
    const threshold = alert.threshold === null
      ? ""
      : ` · Seuil ${quantity(alert.threshold)} ${unitLabel(alert.item.unit, alert.threshold)}`;
    return `<article class="alert-row">
      <div>
        <div class="alert-title"><strong>${escapeHtml(alert.item.name)}</strong><span class="badge ${kind.css}">${kind.label}</span></div>
        <span>${escapeHtml(alert.message)}${threshold}${alert.type === "INVENTORY_DIFFERENCE" ? ` · ${dateLabel(alert.createdAt)}` : ""}</span>
      </div>
      <div class="alert-qty">${escapeHtml(display.main)}${display.secondary ? `<small>${escapeHtml(display.secondary)}</small>` : ""}</div>
    </article>`;
  }).join("");
}


async function renderAngelSupplierAnswer(query: string): Promise<void> {
  const box = $("#angel-supplier-answer") as HTMLDivElement;
  const answer = await angelSupplierService.search(query);
  box.hidden = false;

  if (!answer.results.length) {
    box.innerHTML = `
      <div class="angel-answer-head"><strong>Ángel — réponse fournisseur</strong><span class="badge neutral">Aucune correspondance</span></div>
      <p>${escapeHtml(answer.message)}</p>
      <small>Source : SupplierStockService · aucune lecture directe de table fournisseur.</small>
    `;
    return;
  }

  box.innerHTML = `
    <div class="angel-answer-head"><strong>Ángel — réponse fournisseur</strong><span class="badge info">${answer.results.length} résultat${answer.results.length > 1 ? "s" : ""}</span></div>
    <p>${escapeHtml(answer.message)}</p>
    <div class="angel-answer-results">
      ${answer.results.map(row => {
        const status = supplierStatus(row.stockStatus as SupplierStockStatus);
        const available = row.availableQuantity === null
          ? "Quantité non communiquée"
          : `${quantity(row.availableQuantity)} ${unitLabel(row.unit as StockUnit, row.availableQuantity)}`;
        return `<div>
          <strong>${escapeHtml(row.supplierName)} · réf. ${escapeHtml(row.supplierReference)}</strong>
          <span>${escapeHtml(available)} · ${status.label} · ${escapeHtml(row.freshness)}</span>
        </div>`;
      }).join("")}
    </div>
    <small>Source : SupplierStockService · stock artisan non fusionné · aucune table fournisseur lue directement.</small>
  `;
}

async function renderSuppliers(): Promise<void> {
  const rows = await supplierService.search(supplierSearch);
  const list = $("#supplier-list") as HTMLDivElement;
  renderSupplierDraft();

  if (!rows.length) {
    list.innerHTML = `<div class="empty"><strong>Aucune disponibilité fournisseur trouvée</strong><span>Essayez une autre désignation ou référence.</span></div>`;
    return;
  }

  list.innerHTML = rows.map((row, index) => {
    const status = supplierStatus(row.stockStatus);
    const available = row.availableQuantity === null
      ? "Quantité non communiquée"
      : `${quantity(row.availableQuantity)} ${unitLabel(row.unit, row.availableQuantity)}`;
    const price = row.priceHt === null ? "Prix non communiqué" : `${euro(row.priceHt)} HT / ${unitLabel(row.unit, 1)}`;

    return `
      <article class="supplier-card" data-supplier-index="${index}">
        <div class="supplier-card-head">
          <div>
            <span class="supplier-name">${escapeHtml(row.supplierName)}</span>
            <h3>${escapeHtml(row.designation)}</h3>
          </div>
          <span class="badge ${status.css}">${status.label}</span>
        </div>
        <div class="supplier-meta">
          <span>Réf. ${escapeHtml(row.supplierReference)}</span>
          <span>${escapeHtml(row.depotName ?? "Dépôt non renseigné")}</span>
          <span>${escapeHtml(supplierFreshness(row))}</span>
        </div>
        <div class="supplier-availability">
          <div><span>Disponibilité fournisseur</span><strong>${escapeHtml(available)}</strong></div>
          <div><span>Prix</span><strong>${escapeHtml(price)}</strong></div>
        </div>
        <div class="supplier-actions">
          <label>Quantité<input type="number" min="0.000001" step="any" value="1" data-supplier-quantity></label>
          <button class="button ghost small" data-supplier-action="quote">Demander un devis</button>
          <button class="button secondary small" data-supplier-action="order">Préparer commande</button>
        </div>
        ${row.isDemo ? `<div class="demo-watermark">Données de démonstration — aucune donnée ERP réelle</div>` : ""}
      </article>
    `;
  }).join("");

  list.querySelectorAll<HTMLElement>("[data-supplier-index]").forEach(card => {
    const index = Number(card.dataset.supplierIndex ?? -1);
    const row = rows[index];
    if (!row) return;
    const input = card.querySelector<HTMLInputElement>("[data-supplier-quantity]");
    card.querySelectorAll<HTMLButtonElement>("[data-supplier-action]").forEach(button => {
      button.addEventListener("click", () => {
        try {
          const requested = Number(input?.value ?? 0);
          lastSupplierDraft = button.dataset.supplierAction === "order"
            ? supplierService.prepareOrderDraft(row, requested)
            : supplierService.prepareQuoteDraft(row, requested);
          renderSupplierDraft();
          showToast(button.dataset.supplierAction === "order"
            ? "Brouillon envoyé vers le futur circuit Commandes / Achats. Aucune commande réelle créée."
            : "Demande de devis préparée. Aucun envoi fournisseur réel.");
        } catch (error) {
          showToast(explainError(error), true);
        }
      });
    });
  });
}


async function fillExpertSelects(): Promise<void> {
  const [views, locations, vehicles] = await Promise.all([
    service.listItemViews(),
    service.listLocations(),
    service.listVehicleStocks(),
  ]);

  const itemOptions = views.map(view =>
    `<option value="${escapeHtml(view.item.id)}">${escapeHtml(view.item.name)}</option>`
  ).join("");
  for (const id of ["vehicle-load-product", "expert-qr-product"]) {
    const select = document.getElementById(id) as HTMLSelectElement | null;
    if (select) select.innerHTML = itemOptions;
  }

  const locationOptions = locations.map(location =>
    `<option value="${escapeHtml(location.id)}">${escapeHtml(location.name)}</option>`
  ).join("");
  for (const id of ["expert-qr-from", "expert-qr-to"]) {
    const select = document.getElementById(id) as HTMLSelectElement | null;
    if (select) select.innerHTML = `<option value="">—</option>${locationOptions}`;
  }

  const vehicleSelect = document.getElementById("vehicle-load-vehicle") as HTMLSelectElement | null;
  if (vehicleSelect) {
    vehicleSelect.innerHTML = vehicles.length
      ? vehicles.map(vehicle => `<option value="${escapeHtml(vehicle.location.id)}">${escapeHtml(vehicle.location.name)}${vehicle.registration ? ` · ${escapeHtml(vehicle.registration)}` : ""}</option>`).join("")
      : `<option value="">Aucun véhicule</option>`;
  }

  const loadProduct = document.getElementById("vehicle-load-product") as HTMLSelectElement | null;
  if (loadProduct && loadProduct.value) {
    const view = views.find(row => row.item.id === loadProduct.value);
    const unitSelect = document.getElementById("vehicle-load-unit") as HTMLSelectElement | null;
    if (view && unitSelect) setUnitOptions(unitSelect, view.item);
  }

  const qrProduct = document.getElementById("expert-qr-product") as HTMLSelectElement | null;
  if (qrProduct && qrProduct.value) {
    const view = views.find(row => row.item.id === qrProduct.value);
    const unitSelect = document.getElementById("expert-qr-unit") as HTMLSelectElement | null;
    if (view && unitSelect) setUnitOptions(unitSelect, view.item);
  }
}

async function renderVehicles(): Promise<void> {
  const vehicles = await service.listVehicleStocks();
  const list = $("#vehicle-stock-list") as HTMLDivElement;
  if (!vehicles.length) {
    list.innerHTML = `<div class="empty"><strong>Aucun véhicule</strong><span>Créez un véhicule pour gérer son stock séparément.</span></div>`;
    return;
  }

  list.innerHTML = vehicles.map(vehicle => `
    <article class="vehicle-card" data-vehicle-id="${escapeHtml(vehicle.location.id)}">
      <div class="vehicle-card-head">
        <div>
          <strong>${escapeHtml(vehicle.location.name)}</strong>
          <span>${vehicle.registration ? escapeHtml(vehicle.registration) : "Immatriculation non renseignée"} · ${vehicle.referenceCount} référence${vehicle.referenceCount > 1 ? "s" : ""}</span>
        </div>
        <span class="badge ${vehicle.reservedReferenceCount > 0 ? "low" : "good"}">${vehicle.reservedReferenceCount} réservée${vehicle.reservedReferenceCount > 1 ? "s" : ""}</span>
      </div>
      <div class="vehicle-lines">
        ${vehicle.lines.length ? vehicle.lines.map(line => {
          const display = stockQuantityLines(line.item, line.snapshot.physicalQuantity);
          const available = stockQuantityLines(line.item, line.snapshot.availableQuantity);
          return `<div class="vehicle-line" data-product-id="${escapeHtml(line.item.id)}">
            <div><strong>${escapeHtml(line.item.name)}</strong><span>${escapeHtml(display.main)}${display.secondary ? ` · ${escapeHtml(display.secondary)}` : ""} · disponible ${escapeHtml(available.main)}</span></div>
            <div class="vehicle-line-actions">
              <button class="button ghost small" data-vehicle-action="return">Retour dépôt</button>
              <button class="button danger-soft small" data-vehicle-action="site-exit">Sortie chantier</button>
            </div>
          </div>`;
        }).join("") : `<div class="empty compact-empty"><strong>Véhicule vide</strong><span>Chargez du matériel depuis le dépôt principal.</span></div>`}
      </div>
    </article>
  `).join("");

  list.querySelectorAll<HTMLButtonElement>("[data-vehicle-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const line = button.closest<HTMLElement>("[data-product-id]");
      const card = button.closest<HTMLElement>("[data-vehicle-id]");
      const productId = line?.dataset.productId;
      const vehicleId = card?.dataset.vehicleId;
      if (!productId || !vehicleId) return;

      if (button.dataset.vehicleAction === "return") {
        await openTransfer(productId);
        const form = $("#transfer-form") as HTMLFormElement;
        const depot = (await service.listLocations()).find(location => location.name === "Dépôt principal");
        (form.elements.namedItem("fromLocationId") as HTMLSelectElement).value = vehicleId;
        if (depot) (form.elements.namedItem("toLocationId") as HTMLSelectElement).value = depot.id;
        (form.elements.namedItem("reason") as HTMLInputElement).value = "Retour véhicule vers dépôt";
      } else {
        await openMovement(productId, "exit");
        const form = $("#movement-form") as HTMLFormElement;
        (form.elements.namedItem("locationId") as HTMLSelectElement).value = vehicleId;
        (form.elements.namedItem("reason") as HTMLInputElement).value = "Sortie depuis véhicule pour chantier";
      }
    });
  });
}

function scanActionLabel(action: ExpertScanDraft["action"]): string {
  return ({
    SELECT_PRODUCT: "Article identifié",
    ENTRY: "Entrée",
    EXIT: "Sortie",
    TRANSFER: "Transfert",
    SITE_RETURN: "Retour chantier",
  })[action];
}

function renderScanDraft(draft: ExpertScanDraft): void {
  const box = $("#expert-scan-result") as HTMLDivElement;
  box.hidden = false;
  const source = draft.sourceKind === "BARCODE" ? "Code-barres" : "QR SpeedArti";
  const location = draft.action === "TRANSFER"
    ? `${draft.locationFrom?.name ?? "?"} → ${draft.locationTo?.name ?? "?"}`
    : draft.locationTo?.name ?? draft.locationFrom?.name ?? "À choisir";
  box.innerHTML = `
    <div class="scan-result-head"><div><span class="eyebrow">${source}</span><strong>${escapeHtml(draft.item.name)}</strong></div><span class="badge info">${scanActionLabel(draft.action)}</span></div>
    <div class="scan-result-grid">
      <span>Quantité<strong>${draft.quantity === null ? "À saisir" : `${quantity(draft.quantity)} ${unitLabel(draft.unit, draft.quantity)}`}</strong></span>
      <span>Emplacement<strong>${escapeHtml(location)}</strong></span>
      <span>Chantier<strong>${escapeHtml(draft.chantierId ?? "Non renseigné")}</strong></span>
    </div>
    <p>${escapeHtml(draft.message)}</p>
    <div class="scan-result-actions">
      ${draft.action === "SELECT_PRODUCT" ? `
        <button class="button secondary small" data-scan-product-action="entry">Entrée</button>
        <button class="button danger-soft small" data-scan-product-action="exit">Sortie</button>
        <button class="button ghost small" data-scan-product-action="transfer">Transfert</button>
      ` : `<button id="expert-scan-confirm" class="button primary">Confirmer l'action</button>`}
    </div>
    <small>Validation humaine obligatoire : le scan seul ne modifie jamais le Stock.</small>
  `;

  box.querySelectorAll<HTMLButtonElement>("[data-scan-product-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const action = button.dataset.scanProductAction;
      if (action === "entry" || action === "exit") await openMovement(draft.item.id, action);
      else await openTransfer(draft.item.id);
    });
  });

  const confirm = box.querySelector<HTMLButtonElement>("#expert-scan-confirm");
  confirm?.addEventListener("click", async () => {
    try {
      await expertScanService.confirm(draft, true);
      currentScanDraft = null;
      box.innerHTML = `<div class="success-box"><strong>Action confirmée</strong><span>Le mouvement a été enregistré et tracé.</span></div>`;
      showToast("Mouvement Stock confirmé après scan.");
      await refresh();
    } catch (error) {
      showToast(explainError(error), true);
    }
  });
}

async function analyzeExpertCode(raw: string): Promise<void> {
  currentScanDraft = await expertScanService.resolve(raw);
  renderScanDraft(currentScanDraft);
}

function stopExpertCamera(): void {
  expertCameraFrame += 1;
  expertCameraStream?.getTracks().forEach(track => track.stop());
  expertCameraStream = null;
  const wrap = document.getElementById("expert-camera-wrap") as HTMLElement | null;
  const video = document.getElementById("expert-camera-video") as HTMLVideoElement | null;
  if (video) video.srcObject = null;
  if (wrap) wrap.hidden = true;
  const stop = document.getElementById("expert-camera-stop") as HTMLButtonElement | null;
  if (stop) stop.hidden = true;
}

async function startExpertCamera(): Promise<void> {
  const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => { detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
  if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
    showToast("Le scan caméra natif n'est pas disponible sur ce navigateur. Utilisez un lecteur code-barres ou collez le code.", true);
    return;
  }

  stopExpertCamera();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  expertCameraStream = stream;
  const video = $("#expert-camera-video") as HTMLVideoElement;
  const wrap = $("#expert-camera-wrap") as HTMLElement;
  const stop = $("#expert-camera-stop") as HTMLButtonElement;
  video.srcObject = stream;
  wrap.hidden = false;
  stop.hidden = false;
  await video.play();

  const detector = new BarcodeDetectorCtor({ formats: ["qr_code", "ean_13", "ean_8", "code_128"] });
  const frameId = ++expertCameraFrame;

  const loop = async () => {
    if (frameId !== expertCameraFrame || !expertCameraStream) return;
    try {
      const results = await detector.detect(video);
      const raw = results.find(result => result.rawValue)?.rawValue?.trim();
      if (raw) {
        const input = $("#expert-scan-input") as HTMLInputElement;
        input.value = raw;
        stopExpertCamera();
        await analyzeExpertCode(raw);
        return;
      }
    } catch {
      // La caméra continue : une frame illisible n'est pas une erreur métier.
    }
    window.setTimeout(() => { void loop(); }, 250);
  };
  await loop();
}

async function renderHistory(): Promise<void> {
  const rows = await service.movementHistory();
  const list = $("#history-list") as HTMLDivElement;
  if (!rows.length) {
    list.innerHTML = `<div class="empty"><strong>Aucun mouvement</strong><span>Les opérations de stock apparaîtront ici.</span></div>`;
    return;
  }
  list.innerHTML = rows.map(({ movement, itemName, locationFromName, locationToName }) => {
    const positive = ["ENTRY", "SITE_RETURN"].includes(movement.movementType) || (movement.movementType === "ADJUSTMENT" && movement.quantity > 0);
    const negative = ["EXIT", "LOSS", "BREAKAGE"].includes(movement.movementType) || (movement.movementType === "ADJUSTMENT" && movement.quantity < 0);
    const sign = positive ? "+" : negative ? "−" : "";
    const location = movement.movementType === "TRANSFER"
      ? `${locationFromName ?? "?"} → ${locationToName ?? "?"}`
      : locationToName ?? locationFromName ?? "";
    const chantier = movement.chantierId ? ` · Chantier ${escapeHtml(movement.chantierId)}` : "";
    return `<article class="history-row">
      <div class="history-main"><strong>${escapeHtml(itemName)} · ${MOVEMENT_LABELS[movement.movementType]}</strong>
      <span>${escapeHtml(location)}${movement.reason ? ` · ${escapeHtml(movement.reason)}` : ""}${chantier} · ${dateLabel(movement.createdAt)}</span></div>
      <div class="history-qty ${positive ? "entry" : negative ? "exit" : ""}">${sign}${quantity(Math.abs(movement.quantity))} ${UNIT_LABELS[movement.unit]}</div>
    </article>`;
  }).join("");
}

async function renderLocations(): Promise<void> {
  const locations = await service.listLocations();
  const list = $("#location-list") as HTMLDivElement;
  list.innerHTML = locations.map(location => `
    <article class="location-row"><div><strong>${escapeHtml(location.name)}</strong><span>${escapeHtml(locationTypeLabel(location.type))}</span></div>
    ${location.name === "Dépôt principal" ? `<span class="badge good">Par défaut</span>` : ""}</article>`).join("");
}

async function renderReservationsAndNeeds(): Promise<void> {
  const [reservations, requirements] = await Promise.all([
    service.listActiveReservations(),
    service.listPurchaseRequirements(),
  ]);

  const reservationList = $("#reservation-list") as HTMLDivElement;
  if (!reservations.length) {
    reservationList.innerHTML = `<div class="empty"><strong>Aucune réservation active</strong><span>Réservez du matériel pour un chantier depuis Mon stock.</span></div>`;
  } else {
    reservationList.innerHTML = reservations.map(({ reservation, item, location }) => `
      <article class="reservation-row" data-reservation-id="${escapeHtml(reservation.id)}">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>Chantier ${escapeHtml(reservation.chantierId ?? "non renseigné")} · ${escapeHtml(location?.name ?? "Tous emplacements")}${reservation.reason ? ` · ${escapeHtml(reservation.reason)}` : ""} · ${dateLabel(reservation.createdAt)}</span>
        </div>
        <div class="reservation-qty">${quantity(reservation.quantity)} ${UNIT_LABELS[item.unit]}</div>
        <button class="button ghost small" data-release>Libérer</button>
      </article>
    `).join("");

    reservationList.querySelectorAll<HTMLButtonElement>("[data-release]").forEach(button => {
      button.addEventListener("click", async () => {
        const row = button.closest<HTMLElement>("[data-reservation-id]");
        const reservationId = row?.dataset.reservationId;
        if (!reservationId) return;
        try {
          await service.releaseReservation(reservationId);
          showToast("Réservation libérée.");
          await refresh();
        } catch (error) {
          showToast(explainError(error), true);
        }
      });
    });
  }

  const requirementList = $("#requirement-list") as HTMLDivElement;
  if (!requirements.length) {
    requirementList.innerHTML = `<div class="empty"><strong>Aucun besoin d'achat préparé</strong><span>Le Stock prépare un besoin, mais ne crée jamais lui-même une commande fournisseur.</span></div>`;
  } else {
    requirementList.innerHTML = requirements.map(({ requirement, item, location }) => `
      <article class="requirement-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(location?.name ?? "Emplacement non défini")}${requirement.chantierId ? ` · Chantier ${escapeHtml(requirement.chantierId)}` : ""}${requirement.reason ? ` · ${escapeHtml(requirement.reason)}` : ""}</span>
        </div>
        <div class="requirement-qty">${quantity(requirement.quantity)} ${UNIT_LABELS[item.unit]}</div>
        <span class="badge low">Brouillon Commandes</span>
      </article>
    `).join("");
  }
}

async function renderInventory(): Promise<void> {
  const select = $("#inventory-location-select") as HTMLSelectElement;
  const locationId = select.value;
  const list = $("#inventory-list") as HTMLDivElement;
  if (!locationId) { list.innerHTML = `<div class="empty"><strong>Aucun emplacement</strong></div>`; return; }
  const rows = await service.inventoryRows(locationId, search);
  if (!rows.length) { list.innerHTML = `<div class="empty"><strong>Aucun article à inventorier</strong></div>`; return; }
  list.innerHTML = rows.map(row => `
    <article class="inventory-row" data-product-id="${escapeHtml(row.item.id)}">
      <div class="inventory-main"><strong>${escapeHtml(row.item.name)}</strong><span>${row.reservedQuantity > 0 ? `${quantity(row.reservedQuantity)} réservé` : escapeHtml(row.item.family)}</span></div>
      <div class="inventory-theoretical"><span>Théorique</span><strong>${quantity(row.theoreticalQuantity)} ${UNIT_LABELS[row.item.unit]}</strong></div>
      <label class="inventory-count">Compté<input type="number" min="0" step="any" value="${row.theoreticalQuantity}" data-counted></label>
      <div class="inventory-difference" data-difference>Écart : 0</div>
      <button class="button secondary small" data-correct>Corriger le stock</button>
    </article>`).join("");

  list.querySelectorAll<HTMLElement>(".inventory-row").forEach(row => {
    const productId = row.dataset.productId ?? "";
    const input = row.querySelector<HTMLInputElement>("[data-counted]");
    const diff = row.querySelector<HTMLElement>("[data-difference]");
    const correct = row.querySelector<HTMLButtonElement>("[data-correct]");
    if (!input || !diff || !correct) return;
    const update = async () => {
      const current = (await service.inventoryRows(locationId)).find(x => x.item.id === productId);
      if (!current) return;
      const counted = Number(input.value);
      const delta = Number.isFinite(counted) ? counted - current.theoreticalQuantity : 0;
      diff.textContent = `Écart : ${delta > 0 ? "+" : ""}${quantity(delta)} ${UNIT_LABELS[current.item.unit]}`;
      diff.classList.toggle("positive", delta > 0); diff.classList.toggle("negative", delta < 0);
    };
    input.addEventListener("input", () => { void update(); });
    correct.addEventListener("click", async () => {
      try {
        const counted = Number(input.value);
        const result = await service.applyInventoryCount({ productId, locationId, countedQuantity: counted });
        showToast(result.movement ? `Stock corrigé : écart ${result.difference > 0 ? "+" : ""}${quantity(result.difference)}.` : "Aucun écart à corriger.");
        await refresh();
      } catch (error) { showToast(explainError(error), true); }
    });
  });
}

async function refresh(): Promise<void> {
  await fillLocationSelects();
  await fillExpertSelects();
  await Promise.all([renderDashboard(), renderStock(), renderAlerts(), renderSuppliers(), renderHistory(), renderLocations(), renderInventory(), renderReservationsAndNeeds(), renderVehicles()]);
}

async function openMovement(productId: string, mode: "entry" | "exit"): Promise<void> {
  const view = (await service.listItemViews()).find(x => x.item.id === productId); if (!view) return;
  const form = $("#movement-form") as HTMLFormElement;
  (form.elements.namedItem("productId") as HTMLInputElement).value = productId;
  (form.elements.namedItem("mode") as HTMLInputElement).value = mode;
  (form.elements.namedItem("quantity") as HTMLInputElement).value = "";
  (form.elements.namedItem("chantierId") as HTMLInputElement).value = "";
  (form.elements.namedItem("reason") as HTMLInputElement).value = "";
  const loc = form.elements.namedItem("locationId") as HTMLSelectElement; if (view.item.mainLocationId) loc.value = view.item.mainLocationId;
  setUnitOptions(form.elements.namedItem("unit") as HTMLSelectElement, view.item);
  $("#movement-title").textContent = mode === "entry" ? "Entrée de stock" : "Sortie de stock";
  $("#movement-eyebrow").textContent = mode === "entry" ? "Réception / ajout" : "Utilisation / chantier";
  $("#movement-product").textContent = `${view.item.name} — ${quantity(view.snapshot.availableQuantity)} ${UNIT_LABELS[view.item.unit]} disponibles`;
  ($("#movement-dialog") as HTMLDialogElement).showModal();
}

async function openTransfer(productId: string): Promise<void> {
  const view = (await service.listItemViews()).find(x => x.item.id === productId); if (!view) return;
  const form = $("#transfer-form") as HTMLFormElement;
  (form.elements.namedItem("productId") as HTMLInputElement).value = productId;
  (form.elements.namedItem("quantity") as HTMLInputElement).value = "";
  (form.elements.namedItem("chantierId") as HTMLInputElement).value = "";
  (form.elements.namedItem("reason") as HTMLInputElement).value = "";
  if (view.item.mainLocationId) (form.elements.namedItem("fromLocationId") as HTMLSelectElement).value = view.item.mainLocationId;
  setUnitOptions(form.elements.namedItem("unit") as HTMLSelectElement, view.item);
  $("#transfer-product").textContent = `${view.item.name} — ${quantity(view.snapshot.availableQuantity)} ${UNIT_LABELS[view.item.unit]} disponibles au total`;
  ($("#transfer-dialog") as HTMLDialogElement).showModal();
}

async function openIncident(productId: string): Promise<void> {
  const view = (await service.listItemViews()).find(x => x.item.id === productId); if (!view) return;
  const form = $("#incident-form") as HTMLFormElement;
  (form.elements.namedItem("productId") as HTMLInputElement).value = productId;
  (form.elements.namedItem("quantity") as HTMLInputElement).value = "";
  (form.elements.namedItem("reason") as HTMLInputElement).value = "";
  (form.elements.namedItem("chantierId") as HTMLInputElement).value = "";
  if (view.item.mainLocationId) (form.elements.namedItem("locationId") as HTMLSelectElement).value = view.item.mainLocationId;
  setUnitOptions(form.elements.namedItem("unit") as HTMLSelectElement, view.item);
  $("#incident-product").textContent = view.item.name;
  ($("#incident-dialog") as HTMLDialogElement).showModal();
}

async function openReservation(productId: string): Promise<void> {
  const view = (await service.listItemViews()).find(x => x.item.id === productId);
  if (!view) return;
  const form = $("#reservation-form") as HTMLFormElement;
  (form.elements.namedItem("productId") as HTMLInputElement).value = productId;
  (form.elements.namedItem("quantity") as HTMLInputElement).value = "";
  (form.elements.namedItem("chantierId") as HTMLInputElement).value = "";
  (form.elements.namedItem("reason") as HTMLInputElement).value = "";
  if (view.item.mainLocationId) {
    (form.elements.namedItem("locationId") as HTMLSelectElement).value = view.item.mainLocationId;
  }
  setUnitOptions(form.elements.namedItem("unit") as HTMLSelectElement, view.item);
  $("#reservation-product").textContent = `${view.item.name} — ${quantity(view.snapshot.availableQuantity)} ${UNIT_LABELS[view.item.unit]} disponibles`;
  ($("#reservation-dialog") as HTMLDialogElement).showModal();
}

async function openReplenish(productId: string): Promise<void> {
  const view = (await service.listItemViews()).find(x => x.item.id === productId);
  if (!view) return;
  const form = $("#replenish-form") as HTMLFormElement;
  (form.elements.namedItem("productId") as HTMLInputElement).value = productId;
  (form.elements.namedItem("quantity") as HTMLInputElement).value = "";
  (form.elements.namedItem("chantierId") as HTMLInputElement).value = "";
  (form.elements.namedItem("reason") as HTMLInputElement).value = "";
  if (view.item.mainLocationId) {
    (form.elements.namedItem("locationId") as HTMLSelectElement).value = view.item.mainLocationId;
  }
  setUnitOptions(form.elements.namedItem("unit") as HTMLSelectElement, view.item);
  const threshold = view.item.minimumQuantity === null
    ? "Aucun seuil minimum défini."
    : `Seuil minimum : ${quantity(view.item.minimumQuantity)} ${UNIT_LABELS[view.item.unit]}.`;
  $("#replenish-product").textContent = `${view.item.name} — ${quantity(view.snapshot.availableQuantity)} ${UNIT_LABELS[view.item.unit]} disponibles. ${threshold}`;
  ($("#replenish-dialog") as HTMLDialogElement).showModal();
}

function openDialog(id: string): void { (document.getElementById(id) as HTMLDialogElement | null)?.showModal(); }
function closeDialog(id: string): void { (document.getElementById(id) as HTMLDialogElement | null)?.close(); }

function wireTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach(button => button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
    button.classList.add("active"); document.getElementById(`${tab}-panel`)?.classList.add("active");
  }));
}
function wireDialogs(): void {
  document.querySelectorAll<HTMLElement>("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.close ?? "")));
  $("#add-item-button").addEventListener("click", () => openDialog("item-dialog"));
  $("#add-location-button").addEventListener("click", () => openDialog("location-dialog"));
}

function wireForms(): void {
  const itemForm = $("#item-form") as HTMLFormElement;
  itemForm.addEventListener("submit", async event => { event.preventDefault(); const data = new FormData(itemForm); try {
    const thresholdRaw = String(data.get("minimumQuantity") ?? "").trim();
    await service.createItem({ name:String(data.get("name")??""), family:String(data.get("family")??""), unit:String(data.get("unit")??"piece") as StockUnit, initialQuantity:Number(data.get("initialQuantity")??0), locationId:String(data.get("locationId")??""), minimumQuantity:thresholdRaw?Number(thresholdRaw):null, internalReference:String(data.get("internalReference")??""), supplierReference:String(data.get("supplierReference")??""), barcode:String(data.get("barcode")??""), notes:String(data.get("notes")??""), secondary:secondaryDefinitionFromForm(data) });
    itemForm.reset(); closeDialog("item-dialog"); showToast("Article ajouté au stock."); await refresh();
  } catch(error){showToast(explainError(error),true);} });

  const movementForm = $("#movement-form") as HTMLFormElement;
  movementForm.addEventListener("submit", async event => { event.preventDefault(); const data=new FormData(movementForm); const mode=String(data.get("mode")??""); try {
    const input={productId:String(data.get("productId")??""),quantity:Number(data.get("quantity")??0),unit:String(data.get("unit")??"piece") as StockUnit,locationId:String(data.get("locationId")??""),chantierId:String(data.get("chantierId")??"").trim()||null,reason:String(data.get("reason")??"").trim()||null};
    if(mode==="entry") await service.recordEntry(input); else await service.recordExit(input);
    closeDialog("movement-dialog"); showToast(mode==="entry"?"Entrée enregistrée.":"Sortie enregistrée."); await refresh();
  }catch(error){showToast(explainError(error),true);} });

  const transferForm = $("#transfer-form") as HTMLFormElement;
  transferForm.addEventListener("submit", async event => { event.preventDefault(); const data=new FormData(transferForm); try {
    await service.transferStock({productId:String(data.get("productId")??""),quantity:Number(data.get("quantity")??0),unit:String(data.get("unit")??"piece") as StockUnit,fromLocationId:String(data.get("fromLocationId")??""),toLocationId:String(data.get("toLocationId")??""),chantierId:String(data.get("chantierId")??"").trim()||null,reason:String(data.get("reason")??"").trim()||null});
    closeDialog("transfer-dialog"); showToast("Transfert enregistré."); await refresh();
  }catch(error){showToast(explainError(error),true);} });

  const incidentForm = $("#incident-form") as HTMLFormElement;
  incidentForm.addEventListener("submit", async event => { event.preventDefault(); const data=new FormData(incidentForm); try {
    const kind=String(data.get("kind")??"LOSS");
    const input={productId:String(data.get("productId")??""),quantity:Number(data.get("quantity")??0),unit:String(data.get("unit")??"piece") as StockUnit,locationId:String(data.get("locationId")??""),chantierId:String(data.get("chantierId")??"").trim()||null,reason:String(data.get("reason")??"").trim()||null};
    if(kind==="BREAKAGE") await service.recordBreakage(input); else if(kind==="SITE_RETURN") await service.recordSiteReturn(input); else await service.recordLoss(input);
    closeDialog("incident-dialog"); showToast("Mouvement enregistré."); await refresh();
  }catch(error){showToast(explainError(error),true);} });

  const reservationForm = $("#reservation-form") as HTMLFormElement;
  reservationForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(reservationForm);
    try {
      await service.createReservation({
        productId: String(data.get("productId") ?? ""),
        quantity: Number(data.get("quantity") ?? 0),
        unit: String(data.get("unit") ?? "piece") as StockUnit,
        locationId: String(data.get("locationId") ?? ""),
        chantierId: String(data.get("chantierId") ?? "").trim(),
        reason: String(data.get("reason") ?? "").trim() || null,
      });
      closeDialog("reservation-dialog");
      showToast("Stock réservé pour le chantier.");
      await refresh();
    } catch (error) {
      showToast(explainError(error), true);
    }
  });

  const replenishForm = $("#replenish-form") as HTMLFormElement;
  replenishForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(replenishForm);
    try {
      await service.createPurchaseRequirement({
        productId: String(data.get("productId") ?? ""),
        quantity: Number(data.get("quantity") ?? 0),
        unit: String(data.get("unit") ?? "piece") as StockUnit,
        locationId: String(data.get("locationId") ?? "") || null,
        chantierId: String(data.get("chantierId") ?? "").trim() || null,
        reason: String(data.get("reason") ?? "").trim() || null,
      });
      closeDialog("replenish-dialog");
      showToast("Besoin d'achat préparé pour Commandes / Achats.");
      await refresh();
    } catch (error) {
      showToast(explainError(error), true);
    }
  });

  const locationForm = $("#location-form") as HTMLFormElement;
  locationForm.addEventListener("submit", async event => { event.preventDefault(); const data=new FormData(locationForm); try {
    await service.createLocation({name:String(data.get("name")??""),type:String(data.get("type")??"depot") as StockLocation["type"]});
    locationForm.reset(); closeDialog("location-dialog"); showToast("Emplacement ajouté."); await refresh();
  }catch(error){showToast(explainError(error),true);} });
}

function wireSecondaryFields(): void {
  const mode = $("#secondary-mode") as HTMLSelectElement;
  const groups = Array.from(document.querySelectorAll<HTMLElement>("[data-secondary-group]"));
  const refreshFields = () => {
    const selected = mode.value;
    groups.forEach(group => {
      group.hidden = group.dataset.secondaryGroup !== selected;
    });
  };
  mode.addEventListener("change", refreshFields);
  refreshFields();
}

function wireDemoData(): void {
  const button = document.getElementById("load-demo-button") as HTMLButtonElement | null;
  if (!button) return;
  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      await loadBtpDemoData(service);
      showToast("Exemples BTP chargés.");
      await refresh();
    } catch (error) {
      showToast(explainError(error), true);
    } finally {
      button.disabled = false;
    }
  });
}

function wireAngelSupplier(): void {
  const form = $("#angel-supplier-form") as HTMLFormElement;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form);
    const query = String(data.get("query") ?? "").trim();
    if (!query) {
      showToast("Saisissez une question ou un produit à rechercher.", true);
      return;
    }
    try {
      await renderAngelSupplierAnswer(query);
    } catch (error) {
      showToast(explainError(error), true);
    }
  });
}

function wireSupplierSearch(): void {
  const input = $("#supplier-search-input") as HTMLInputElement;
  input.addEventListener("input", async () => {
    supplierSearch = input.value;
    await renderSuppliers();
  });
}

function wireExpert(): void {
  const scanForm = $("#expert-scan-form") as HTMLFormElement;
  scanForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(scanForm);
    try {
      await analyzeExpertCode(String(data.get("code") ?? ""));
    } catch (error) {
      currentScanDraft = null;
      showToast(explainError(error), true);
    }
  });

  $("#expert-camera-button").addEventListener("click", () => {
    void startExpertCamera().catch(error => showToast(explainError(error), true));
  });
  $("#expert-camera-stop").addEventListener("click", () => stopExpertCamera());

  const createVehicleForm = $("#vehicle-create-form") as HTMLFormElement;
  createVehicleForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(createVehicleForm);
    try {
      await service.createVehicle({
        name: String(data.get("name") ?? ""),
        registration: String(data.get("registration") ?? "").trim() || null,
      });
      createVehicleForm.reset();
      showToast("Véhicule ajouté au Stock.");
      await refresh();
    } catch (error) {
      showToast(explainError(error), true);
    }
  });

  const loadForm = $("#vehicle-load-form") as HTMLFormElement;
  const loadProduct = $("#vehicle-load-product") as HTMLSelectElement;
  loadProduct.addEventListener("change", async () => {
    const view = (await service.listItemViews()).find(row => row.item.id === loadProduct.value);
    if (view) setUnitOptions($("#vehicle-load-unit") as HTMLSelectElement, view.item);
  });
  loadForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(loadForm);
    try {
      const depot = (await service.listLocations()).find(location => location.name === "Dépôt principal");
      if (!depot) throw new StockDomainError("LOCATION_NOT_FOUND", "Dépôt principal introuvable.");
      const vehicleId = String(data.get("vehicleId") ?? "");
      if (!vehicleId) throw new StockDomainError("LOCATION_NOT_FOUND", "Créez d'abord un véhicule.");
      await service.transferStock({
        productId: String(data.get("productId") ?? ""),
        quantity: Number(data.get("quantity") ?? 0),
        unit: String(data.get("unit") ?? "piece") as StockUnit,
        fromLocationId: depot.id,
        toLocationId: vehicleId,
        reason: "Chargement véhicule",
      });
      showToast("Véhicule chargé depuis le dépôt.");
      await refresh();
    } catch (error) {
      showToast(explainError(error), true);
    }
  });

  const qrForm = $("#expert-qr-form") as HTMLFormElement;
  const qrProduct = $("#expert-qr-product") as HTMLSelectElement;
  qrProduct.addEventListener("change", async () => {
    const view = (await service.listItemViews()).find(row => row.item.id === qrProduct.value);
    if (view) setUnitOptions($("#expert-qr-unit") as HTMLSelectElement, view.item);
  });
  qrForm.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(qrForm);
    try {
      const payload = expertScanService.createQrPayload({
        productId: String(data.get("productId") ?? ""),
        action: String(data.get("action") ?? "ENTRY") as "ENTRY" | "EXIT" | "TRANSFER" | "SITE_RETURN",
        quantity: Number(data.get("quantity") ?? 0),
        unit: String(data.get("unit") ?? "piece") as StockUnit,
        locationFromId: String(data.get("fromLocationId") ?? "") || null,
        locationToId: String(data.get("toLocationId") ?? "") || null,
        chantierId: String(data.get("chantierId") ?? "").trim() || null,
      });
      const output = $("#expert-qr-output") as HTMLDivElement;
      output.hidden = false;
      output.innerHTML = `<strong>Contenu du QR SpeedArti</strong><code>${escapeHtml(payload)}</code><small>Ce payload prépare seulement un brouillon au scan. Une confirmation humaine reste obligatoire.</small>`;
    } catch (error) {
      showToast(explainError(error), true);
    }
  });
}

function wireSearch(): void {
  const input=$("#search-input") as HTMLInputElement;
  input.addEventListener("input",async()=>{search=input.value;await renderStock();});
}
function wireInventory(): void {
  const select=$("#inventory-location-select") as HTMLSelectElement;
  select.addEventListener("change",()=>{void renderInventory();});
  $("#refresh-inventory-button").addEventListener("click",()=>{void renderInventory();});
}

async function main():Promise<void>{wireTabs();wireDialogs();wireForms();wireSecondaryFields();wireDemoData();wireAngelSupplier();wireSupplierSearch();wireExpert();wireSearch();wireInventory();await service.initialize();await refresh();}
main().catch(error=>{showToast(explainError(error),true);console.error(error);});
