import { IntegrationEnvelope, SpeedArtiModule } from "../../integrations/contracts";
import { ConnectorStatus, StockConnector } from "../../integrations/connector-registry";

/**
 * Adaptateur de démo : conserve le contrat mais ne contacte aucun service réel.
 */
export class ContractsOnlyConnector implements StockConnector {
  constructor(public readonly module: SpeedArtiModule) {}

  getStatus(): ConnectorStatus {
    return {
      ready: false,
      mode: "contracts_only_no_live_connection",
      reason: "Sprint A : aucun raccordement production autorisé.",
    };
  }

  async send(_envelope: IntegrationEnvelope): Promise<never> {
    throw new Error("Connexion production désactivée dans la démo Sprint A.");
  }
}
