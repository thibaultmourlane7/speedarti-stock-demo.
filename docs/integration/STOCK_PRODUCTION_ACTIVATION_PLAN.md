# Stock — Plan d'activation production SpeedArti

Date : 16/10/2026  
Destinataire : Anne-Sophie / équipe de développement / IA de développement  
Objectif : intégrer le module Stock validé sans recréer l'existant ni casser les flux SpeedArti.

## Règle absolue

Le dépôt `GSTAI-Sp/speedarti-v2` n'a pas été modifié pendant la préparation de ce dossier.

L'intégration doit être réalisée par Anne-Sophie dans un lot dédié, avec staging, migration versionnée, tests et possibilité de rollback.

## Phase 1 — choisir la source de vérité unique

Le code SpeedArti actuel comporte plusieurs représentations de quantité :
- `products.quantite_stock`
- `stocks.quantite_disponible`
- `reservations_stock`
- `mouvements_stock`

La cible doit être :
- identité produit : Catalogue / Produits ;
- quantité physique : mouvements Stock ;
- réservations : moteur Stock ;
- disponible : physique - réservé.

`products.quantite_stock` ne doit plus être une source d'écriture métier après bascule.

## Phase 2 — modèle de données cible

Le modèle fonctionnel doit couvrir au minimum :
- articles Stock ;
- emplacements ;
- mouvements immuables ;
- réservations ;
- inventaires ;
- comptages ;
- besoins d'achat ;
- chutes ;
- liens véhicule / chantier / équipe ;
- idempotence.

La structure peut réutiliser des tables existantes si elle respecte ces responsabilités. Il n'est pas obligatoire de créer exactement les noms de tables de la démo.

## Phase 3 — couche métier unique

Toutes les mutations passent par une couche unique :
`StockApplicationService -> StockRepository -> RPC/DB`.

À supprimer progressivement :
- `supabase.from('stocks').update(...)` dispersé ;
- `supabase.from('mouvements_stock').insert(...)` depuis d'autres modules ;
- décrémentation Stock liée au paiement d'une facture ;
- réception commande par correspondance textuelle du nom article.

## Phase 4 — migration des données existantes

1. Sauvegarde.
2. Inventaire des lignes `stocks`.
3. Création / résolution d'un identifiant catalogue stable.
4. Création de l'emplacement `Dépôt principal`.
5. Conversion de chaque quantité historique en mouvement initial tracé.
6. Import des réservations actives.
7. Contrôle des totaux avant/après.
8. Marquage manuel des articles non rattachables.
9. Bascule des lectures.
10. Bascule des écritures.
11. Surveillance puis retrait des anciens chemins.

Ne jamais fusionner deux articles uniquement parce que leurs noms se ressemblent.

## Phase 5 — flux prioritaires

Ordre recommandé :
1. Catalogue.
2. Stock cœur.
3. Véhicules.
4. Chantiers.
5. Commandes / réception.
6. Chiffrage.
7. Équipe & Planning.
8. Fournisseurs.
9. Notifications.
10. Pilotage.
11. Ángel.
12. Mobile / offline / QR.

## Phase 6 — tests bloquants

- entrée ;
- sortie ;
- transfert ;
- ajustement ;
- casse ;
- perte ;
- retour chantier ;
- réservation ;
- libération ;
- inventaire daté ;
- reprise inventaire ;
- correction inventaire ;
- véhicule actif/inactif ;
- réception commande idempotente ;
- deux écritures concurrentes ;
- multi-utilisateur ;
- RLS ;
- article catalogue supprimé/inactif ;
- fournisseur indisponible ;
- mode offline mobile ;
- relecture des mouvements ;
- rollback.

## Phase 7 — activation

Activation recommandée par feature flag :
1. lecture nouveau moteur ;
2. double contrôle ancien/nouveau ;
3. écriture nouveau moteur ;
4. désactivation anciennes écritures ;
5. suppression différée des anciens chemins après observation.

## Définition de "prêt production"

Le module n'est activable que si :
- aucune quantité n'a deux sources concurrentes ;
- toutes les mutations passent par le moteur Stock ;
- la migration est réconciliée ;
- les règles RLS sont testées ;
- les flux Commandes/Chiffrage/Véhicules/Chantiers fonctionnent ;
- Ángel lit le nouveau moteur ;
- les tests de concurrence et d'idempotence passent ;
- le rollback est documenté.
