# Handoff Anne-Sophie — Mise en activité du module Stock SpeedArti

Date : 16/10/2026

## Résumé

Le module Stock a été développé et testé dans :
`thibaultmourlane7/speedarti-stock-demo.`

Le vrai dépôt SpeedArti :
`GSTAI-Sp/speedarti-v2`
a été audité uniquement en lecture.

Objectif de l'intégration : reprendre le moteur métier et les contrats préparés, les adapter au schéma réel SpeedArti, puis migrer l'ancien Stock sans créer de seconde logique parallèle.

## Ce qu'il faut absolument réutiliser

Dans la démo Stock :
- domaine Stock ;
- moteur de mouvements ;
- réservations ;
- emplacements ;
- inventaire G.2 ;
- conditionnements ;
- fournisseurs séparés ;
- QR comme raccourci ;
- contrats d'intégration ;
- pack Ángel ;
- tests.

Ne pas recopier l'UI de démonstration telle quelle si la production possède déjà ses composants.

## Ce qu'il faut absolument conserver côté SpeedArti

- Auth existante ;
- RLS Supabase ;
- Catalogue existant ;
- Chantiers existants ;
- `vehicules` existant ;
- Équipe & Planning / RH existants ;
- Commandes fournisseur existantes ;
- Supplier Connectors existants ;
- Notifications existantes ;
- Ángel global existant ;
- EventBus existant à étendre ;
- déploiement / QA / changelog suivant les règles du dépôt.

## Écarts production identifiés

### 1. Plusieurs sources de quantité
Le code utilise encore :
- `products.quantite_stock`
- `stocks.quantite_disponible`
- `reservations_stock`
- `mouvements_stock`

À unifier avant activation.

### 2. Mouvements trop simples
Le modèle historique est surtout entrée/sortie.

La cible nécessite :
- ENTRY
- EXIT
- TRANSFER
- ADJUSTMENT
- LOSS
- BREAKAGE
- SITE_RETURN

avec origine/destination.

### 3. Réception commande
`ReceptionCommandeDialog.tsx` écrit aujourd'hui directement dans `stocks` / `mouvements_stock` et rapproche par nom.

À remplacer par un appel au moteur Stock avec productId réel et idempotence.

### 4. Facture payée
Une ancienne logique du workflow Stock associe paiement facture et décrémentation.

À supprimer : paiement ≠ mouvement physique.

### 5. Ángel
L'ancien `src/features/angel/api/index.ts` lit encore le stock via produits.

À remplacer par les outils du nouveau moteur.

### 6. EventBus
Le bus doit être enrichi avec les événements Stock / inventaire / véhicules / commandes / planning / fournisseur.

## Ordre de travail recommandé

### Lot A
- schéma cible ;
- migration ;
- StockApplicationService ;
- repository / RPC ;
- tests unitaires.

### Lot B
- Catalogue ;
- véhicules ;
- chantiers ;
- commandes.

### Lot C
- Chiffrage ;
- Équipe & Planning ;
- CALPI / Agencement.

### Lot D
- fournisseurs ;
- notifications ;
- Pilotage.

### Lot E
- Ángel ;
- mobile ;
- QR ;
- offline.

## Connecteurs modules GitHub à prendre en compte

### Équipe & Planning
Repo :
`thibaultmourlane7/-speedarti-equipe-planning-demo.`

Déjà préparé :
- Stock ;
- Parc matériel ;
- Chiffrage ;
- météo ;
- cartographie ;
- documents ;
- notifications ;
- Ángel ;
- client ;
- RH ;
- Temps & Présence.

### Plaquiste / Couvreur / Plombier / Maçon / Électricien / Aménagement
Repo :
`thibaultmourlane7/-speedarti-plaquiste-demo-v2`

Ne jamais faire écrire directement ces modules dans Stock.

Ils doivent consommer un contrat central disponibilité / réservation / besoin d'achat.

### ANC
Repo :
`thibaultmourlane7/speedarti-anc-demo`

Pas de raccordement Stock direct nécessaire par défaut. Utilise surtout Client / Chantier / Agenda / Documents / Notifications / Ángel.

### CALPI
Repo :
`thibaultmourlane7/speedarti-calepinage-demo`

Le moteur reste propriétaire de la géométrie exacte des chutes.

### Agencement & Découpe
Repo :
`thibaultmourlane7/speedarti-agencement-decoupe-demo`

Prévoit :
- chiffrage ;
- devis client ;
- demandes de devis fournisseurs ;
- commandes ;
- chutes ;
- Stock.

### IDEA Bois Terrasse
Repo :
`thibaultmourlane7/idea-bois-configurateur-terrasse`

Possède :
- payload SpeedArti ;
- interface ERP ;
- pack Ángel.

Ne pas confondre configurateur terrasse et fournisseur IDEA Bois.

## Tests d'acceptation avant activation

1. Migration sans écart.
2. Entrée commande une seule fois.
3. Réservation distincte du physique.
4. Deux sorties concurrentes impossibles au-delà du disponible.
5. Transfert dépôt -> véhicule cohérent.
6. Véhicule désactivé non sélectionnable.
7. Inventaire sans correction automatique.
8. Ajustement inventaire tracé.
9. Équipe inconnue refusée.
10. Chantier inconnu refusé.
11. Stock fournisseur jamais ajouté au stock artisan.
12. Ángel lit les trois quantités physique/réservée/disponible.
13. QR et interface utilisent le même moteur.
14. Mobile offline ne crée aucun doublon.
15. RLS multi-utilisateur vérifiée.
16. Rollback testé.

## Interdictions d'intégration

- ne pas recréer Catalogue ;
- ne pas recréer Véhicules ;
- ne pas recréer Chantiers ;
- ne pas recréer Équipe & Planning ;
- ne pas créer une IA Stock locale ;
- ne pas conserver plusieurs quantités sources de vérité ;
- ne pas faire de rapprochement par nom ;
- ne pas corriger un inventaire automatiquement ;
- ne pas déclencher une sortie au paiement d'une facture ;
- ne pas compter une facture fournisseur comme réception physique.

## Documents associés

- `CONNECTOR_MASTER_MATRIX_2026-10-16.md`
- `STOCK_PRODUCTION_ACTIVATION_PLAN.md`
- `STOCK_DATA_MIGRATION_PLAN.md`
- `STOCK_EVENTS_CONTRACT_V1.md`
- `ANGEL_KNOWLEDGE_MASTER_REGISTRY.md`

Ces documents constituent le dossier de préparation avant développement dans SpeedArti production.
