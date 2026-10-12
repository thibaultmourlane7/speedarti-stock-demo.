import { StockDomainError } from "../core/errors";
import { ChantierSnapshotPayload, CrewSnapshotPayload } from "./contracts";

export class StockReferenceDirectory {
  private crews = new Map<string, CrewSnapshotPayload>();
  private chantiers = new Map<string, ChantierSnapshotPayload>();

  applyCrewSnapshot(payload: CrewSnapshotPayload): void {
    if (!payload.crewId?.trim() || !payload.name?.trim()) {
      throw new StockDomainError("VALIDATION_REQUIRED", "crewId et nom d'équipe sont obligatoires.");
    }
    this.crews.set(payload.crewId, structuredClone(payload));
  }

  applyChantierSnapshot(payload: ChantierSnapshotPayload): void {
    if (!payload.chantierId?.trim() || !payload.name?.trim()) {
      throw new StockDomainError("VALIDATION_REQUIRED", "chantierId et nom de chantier sont obligatoires.");
    }
    this.chantiers.set(payload.chantierId, structuredClone(payload));
  }

  listCrews(): CrewSnapshotPayload[] {
    return [...this.crews.values()].filter(item => item.active).map(item => structuredClone(item));
  }

  listChantiers(): ChantierSnapshotPayload[] {
    return [...this.chantiers.values()].filter(item => item.active).map(item => structuredClone(item));
  }

  requireCrew(crewId: string): CrewSnapshotPayload {
    const item = this.crews.get(crewId);
    if (!item || !item.active) {
      throw new StockDomainError("VALIDATION_REQUIRED", "Équipe introuvable dans Équipe & Planning.", { crewId });
    }
    return structuredClone(item);
  }

  requireChantier(chantierId: string): ChantierSnapshotPayload {
    const item = this.chantiers.get(chantierId);
    if (!item || !item.active) {
      throw new StockDomainError("VALIDATION_REQUIRED", "Chantier introuvable dans Agenda / Chantier.", { chantierId });
    }
    return structuredClone(item);
  }
}
