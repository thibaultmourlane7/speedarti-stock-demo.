import { IntegrationEnvelope, SpeedArtiModule } from "./contracts";
import { StockDomainError } from "../core/errors";

export interface ConnectorStatus {
  ready: boolean;
  mode: "mock" | "contracts_only_no_live_connection" | "live";
  reason?: string;
}

export interface StockConnector {
  readonly module: SpeedArtiModule;
  getStatus(): ConnectorStatus;
  send(envelope: IntegrationEnvelope): Promise<unknown>;
}

export class StockConnectorRegistry {
  private readonly connectors = new Map<SpeedArtiModule, StockConnector>();

  register(connector: StockConnector): void {
    this.connectors.set(connector.module, connector);
  }

  status(module: SpeedArtiModule): ConnectorStatus {
    return this.connectors.get(module)?.getStatus() ?? {
      ready: false,
      mode: "contracts_only_no_live_connection",
      reason: "Connecteur non enregistré.",
    };
  }

  async send(module: SpeedArtiModule, envelope: IntegrationEnvelope): Promise<unknown> {
    const connector = this.connectors.get(module);
    if (!connector || !connector.getStatus().ready) {
      throw new StockDomainError("CONNECTOR_UNAVAILABLE", `Connecteur ${module} indisponible.`, {
        module,
        status: connector?.getStatus() ?? null,
      });
    }
    return connector.send(envelope);
  }

  list(): Array<{ module: SpeedArtiModule; status: ConnectorStatus }> {
    return [...this.connectors.entries()].map(([module, connector]) => ({
      module,
      status: connector.getStatus(),
    }));
  }
}
