# SpeedArti Stock — Matrice maîtresse des connecteurs

Date : 16/10/2026  
Statut : préparation intégration — aucun raccordement production actif  
Règle absolue : `GSTAI-Sp/speedarti-v2` reste strictement en lecture seule pour ce travail.

## 1. Sources de vérité

| Domaine | Source de vérité | Stock peut écrire ? | Règle |
|---|---|---:|---|
| Identité produit | Catalogue / Produits SpeedArti | Non | Stock conserve uniquement l'identifiant stable |
| Quantité physique | Stock | Oui | Dérivée des mouvements |
| Quantité réservée | Stock | Oui | Distincte du physique |
| Quantité disponible | Stock | Oui | physique - réservé |
| Véhicules / engins | Paramètres / Parc matériel | Non sur l'identité | Stock lie un `vehicleId` à un emplacement |
| Équipes / salariés | Équipe & Planning / RH | Non | Stock référence une équipe existante |
| Chantiers | Chantiers / Agenda Chantier | Non | Stock référence un chantier existant |
| Disponibilité fournisseur | Supplier Connectors | Non | Ne jamais additionner au stock artisan |
| Commandes fournisseur | Commandes / Achats | Non | Stock reçoit uniquement des réceptions validées |
| Géométrie des chutes | CALPI / Agencement-Découpe | Non | Stock conserve l'objet et son statut |
| Notifications | Notifications SpeedArti | Non | Stock émet, Notifications diffuse |
| KPI | Pilotage | Non | Stock publie des indicateurs |
| IA | Ángel global | Non directement | Ángel lit et prépare ; confirmation humaine avant écriture |

## 2. Matrice de raccordement

| Module | Sens | Entrées vers Stock | Sorties depuis Stock | Statut préparation |
|---|---|---|---|---|
| Catalogue / Produits | bidirectionnel logique | articleId, unité, code-barres, référence, fournisseur | disponibilité interne, usage éventuel | PRÊT À FORMALISER EN PROD |
| Chiffrage | bidirectionnel | disponibilité demandée, réservation demandée, libération | disponibilité, brouillon de réservation | CONTRATS PRÊTS |
| Commandes / Achats | bidirectionnel | réception validée, commande liée | besoin d'achat, rupture, manque | CORRECTIF PROD OBLIGATOIRE |
| Supplier Connectors | entrant | disponibilité, prix, fraîcheur, agence | besoin / recherche fournisseur | SOCLE PROD EXISTANT |
| Véhicules / Parc matériel | entrant | vehicleId, nom, immatriculation, actif | quantités par véhicule | SOURCE PROD EXISTANTE |
| Chantiers | entrant + contexte | chantierId, statut | sorties/retours liés | SOURCE PROD EXISTANTE |
| Équipe & Planning | bidirectionnel | équipes, affectations, besoins | disponibilité, brouillon sortie | CONTRATS DÉMO TRÈS AVANCÉS |
| Notifications | sortant | — | faible, rupture, inventaire, écart | À RACCORDER |
| Pilotage | sortant | — | KPI Stock | À RACCORDER |
| Ángel | bidirectionnel contrôlé | intents / brouillons / confirmation | lecture contexte Stock | PACK PRÊT, RUNTIME PROD À RACCORDER |
| CALPI | bidirectionnel | chute créée / consommée | recherche chute compatible | CONTRAT À FORMALISER |
| Agencement & Découpe | bidirectionnel | chute / achat / transfert | disponibilité / besoins | DOCUMENTÉ, ÉVÉNEMENTS À FORMALISER |
| Plaquiste | bidirectionnel | demande disponibilité/réservation | disponibilité / besoins | MANIFESTE AVANCÉ |
| Couvreur | bidirectionnel | demande disponibilité/réservation | disponibilité / besoins | MANIFESTE AVANCÉ |
| Plombier | bidirectionnel | besoin matériel | disponibilité / appro | À FORMALISER EN MANIFESTE |
| Maçon | bidirectionnel | besoin matériel | disponibilité / appro | ADAPTATEUR EXISTANT, MANIFESTE À COMPLÉTER |
| Électricien | bidirectionnel | besoin matériel | disponibilité / appro | MANIFESTE À PRODUIRE |
| Aménagement extérieur | bidirectionnel | besoin matériel | disponibilité / appro | MANIFESTE À PRODUIRE |
| ANC | contexte seulement | chantier, documents, planning | documents / alertes | PAS DE STOCK DIRECT PAR DÉFAUT |
| IDEA Bois Terrasse | externe / fournisseur | catalogue, stock fournisseur | payload projet / besoin | ERP + PAYLOAD PRÉPARÉS |
| Mobile | client du même moteur | actions utilisateur | lecture / synchronisation | PAS DE LOGIQUE MÉTIER PARALLÈLE |

## 3. Événements cibles Stock

### Catalogue
- `catalogue.item.created`
- `catalogue.item.updated`
- `catalogue.item.disabled`

### Chiffrage
- `chiffrage.stock.availability.requested`
- `chiffrage.stock.reservation.requested`
- `chiffrage.stock.reservation.release.requested`
- `stock.availability.response`
- `stock.reservation.draft.ready`

### Commandes
- `stock.purchase_requirement.created`
- `commandes.delivery.confirmed`
- `stock.entry.recorded`

### Véhicules
- `parc_materiel.vehicle.created`
- `parc_materiel.vehicle.updated`
- `parc_materiel.vehicle.disabled`
- `stock.vehicle.updated`

### Équipe & Planning
- `team_planning.crew.snapshot`
- `team_planning.crew.updated`
- `team_planning.material.availability.requested`
- `team_planning.stock_exit.draft.requested`
- `stock.exit.draft.ready`

### Chantiers
- `chantier.created`
- `chantier.updated`
- `chantier.closed`
- `chantier.stock.exit.requested`
- `chantier.stock.return.requested`

### Inventaire
- `stock.inventory.session.created`
- `stock.inventory.session.completed`
- `stock.inventory.session.validated`
- `stock.inventory.difference.detected`

### Notifications / Pilotage
- `stock.low_level.detected`
- `stock.out_of_stock.detected`
- `stock.pilotage.kpi.updated`

### CALPI / chutes
- `material.offcut.created`
- `material.offcut.updated`
- `material.offcut.consume.requested`

## 4. Interdictions

- Aucun module ne met à jour directement une quantité Stock.
- Aucun module ne crée un véhicule, une équipe ou un chantier de secours pour satisfaire une action.
- Aucun stock fournisseur n'est fusionné avec le stock artisan.
- Aucune facture payée ne déclenche une sortie physique Stock.
- Aucune facture fournisseur reçue ne vaut réception physique.
- Aucun rapprochement catalogue/stock par simple ressemblance de nom.
- Aucun événement critique ne doit être traité deux fois : `eventId` et `idempotencyKey` obligatoires.
