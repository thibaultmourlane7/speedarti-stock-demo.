# Stock — Plan de migration des données existantes

## 1. Sources existantes à auditer

Dans SpeedArti actuel :
- `products.quantite_stock`
- `products.seuil_alerte_stock`
- `stocks`
- `mouvements_stock`
- `reservations_stock`
- `catalogue_items`
- `commandes_fournisseurs`

Objectif : établir pour chaque entreprise un état de départ cohérent.

## 2. Identité article

Chaque futur article Stock doit pointer vers un identifiant stable de produit/catalogue.

Ordre de résolution recommandé :
1. identifiant déjà connu ;
2. référence produit exacte ;
3. code-barres exact ;
4. code fournisseur exact ;
5. validation humaine.

La ressemblance textuelle seule n'autorise jamais une fusion automatique.

## 3. Quantité initiale

Pour chaque article historique :
- créer/résoudre l'article ;
- créer/résoudre son emplacement principal ;
- créer un mouvement initial de type `ENTRY` ou `ADJUSTMENT_INITIAL` selon la convention choisie ;
- conserver `legacy_stock_id` dans les métadonnées de migration.

La quantité initiale devient ainsi explicable par l'historique.

## 4. Mouvements historiques

Si l'historique `mouvements_stock` est fiable :
- l'importer avec son horodatage ;
- conserver sa référence historique ;
- éviter de le rejouer comme mutation après création du snapshot initial.

Deux stratégies possibles :
A. reprendre tout l'historique et recalculer ;
B. créer un snapshot initial à la date de migration et archiver l'historique antérieur.

Recommandation V1 : B, moins risquée, sauf exigence d'audit historique complet.

## 5. Réservations

Importer uniquement les réservations réellement actives.

Pour chaque réservation :
- articleId réel ;
- quantité ;
- chantier/chiffrage source ;
- expiration ;
- statut.

Si l'article ne peut pas être résolu, la réservation est mise en anomalie, pas appliquée silencieusement.

## 6. Véhicules / chantiers

- véhicule : lien vers `vehicules.id` ;
- chantier : lien vers `chantiers.id`.

Ne pas recopier les fiches métier dans Stock.

## 7. Contrôles de réconciliation

Pour chaque article :
- quantité avant ;
- quantité après ;
- réservée avant ;
- réservée après ;
- disponible avant ;
- disponible après ;
- anomalie éventuelle.

Rapport attendu :
- nombre d'articles migrés ;
- nombre d'articles à rattacher ;
- écarts de quantité ;
- réservations orphelines ;
- références dupliquées ;
- mouvements non interprétables.

## 8. Rollback

Conserver les anciennes tables/colonnes en lecture pendant la période de validation.

Le rollback doit permettre :
- retour aux anciennes lectures ;
- désactivation des nouvelles écritures ;
- restauration base si migration partielle.

Aucune suppression définitive avant validation métier et technique.
