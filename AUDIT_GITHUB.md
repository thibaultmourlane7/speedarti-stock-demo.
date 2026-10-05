# Audit GitHub — Sprint A

Date de cadrage : 2026-10-05.

## Règle

Cet audit est **lecture seule**.

Aucun dépôt SpeedArti existant n'a été modifié.

## Dépôts analysés

### `-speedarti-equipe-planning-demo.`

Éléments observés :

- connecteurs SpeedArti simulés ;
- Stock déclaré comme source de vérité pour la disponibilité ;
- `team_planning.material.availability.requested` ;
- `team_planning.stock_exit.draft.requested` ;
- `stock.availability.response` ;
- enveloppe versionnée et idempotente ;
- demandes de sortie soumises à validation ;
- règle globale de connaissances Ángel ;
- règle « pas de second Stock ».

**Décision Stock :** conserver les noms d'événements et la forme d'enveloppe.

### `speedarti-agencement-decoupe-demo`

Éléments observés :

- intégration future Chiffrage ;
- demandes de devis fournisseurs ;
- commandes fournisseurs ;
- future conservation des chutes ;
- lien matière/référence/décor/épaisseur/dimensions/fil/origine/emplacement.

**Décision Stock :** modèle `StockOffcut` et connecteur bidirectionnel.

### `speedarti-calepinage-demo`

Éléments observés :

- stock virtuel de chutes ;
- géométrie 2D exacte ;
- `cells`, `contours`, `areaMm2` ;
- filiation des chutes ;
- `available/used/lost` ;
- rectangle englobant insuffisant pour les formes complexes.

**Décision Stock :** ne jamais perdre la géométrie exacte.

### `-speedarti-plaquiste-demo-v2`

Éléments observés :

- plusieurs chiffrages métiers ;
- Stock réel volontairement simulé/non connecté ;
- intégration future par adaptateur ;
- règles de traçabilité.

**Décision Stock :** contrat générique Chiffrage ↔ Stock, sans code métier spécifique par profession dans le moteur central.

### `idea-bois-configurateur-terrasse`

Éléments observés :

- payload SpeedArti structuré ;
- besoins matière ;
- intégration ERP prévue : catalogue, prix, disponibilité par dépôt, conditionnement, devis, commande.

**Décision Stock :** distinguer strictement disponibilité fournisseur et stock artisan.

### `speedarti-anc-demo`

Éléments observés :

- architecture GSTAI lecture seule ;
- base Ángel structurée ;
- pas de besoin Stock direct actuel.

**Décision Stock :** aucun connecteur direct forcé.

### `angele-ai-fr`

Ancien dépôt simple, non retenu comme source de vérité de l'architecture Ángel actuelle.

### `GSTAI-Sp/speedarti-pilotage`

Consulté uniquement pour identifier l'organisation et confirmer les règles de lecture seule. Ce dépôt n'est pas utilisé comme code cœur du Stock.

## Limite connue

Le dépôt réel du code SpeedArti détenu par Anne-Sophie n'est pas accessible dans la connexion actuelle.

Conséquence :

- aucune structure production n'est inventée ;
- aucun adaptateur production n'est développé ;
- les contrats restent isolés ;
- le moteur pourra être raccordé lorsque le dépôt réel sera consultable par Anne-Sophie.

## À refaire avant intégration production

Une nouvelle passe d'audit sera obligatoire sur :

1. le dépôt réel SpeedArti d'Anne-Sophie ;
2. tout nouveau dépôt GitHub SpeedArti apparu entre Sprint A et l'intégration.
