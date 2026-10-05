# Intégration future SpeedArti

> **RÈGLE ABSOLUE : le code réel GSTAI / SpeedArti est strictement en lecture seule pour ce projet. Cette démo ne doit jamais modifier directement SpeedArti. L'intégration production sera réalisée ultérieurement par Anne-Sophie.**

## Ce projet n'est pas une branche de production

Il s'agit d'un dépôt autonome destiné à valider :

- moteur métier ;
- contrats ;
- tests ;
- documentation ;
- UX future.

## Interdictions

Aucun agent travaillant sur ce dépôt n'est autorisé à :

- modifier le dépôt réel SpeedArti ;
- créer une branche dans le dépôt réel SpeedArti ;
- créer une PR vers le dépôt réel ;
- pousser un commit dans le dépôt réel ;
- exécuter une migration Supabase production ;
- modifier un workflow GSTAI ;
- placer une clé production dans la démo.

## Adaptateurs

La démo doit utiliser :

```text
adapters/mock/
```

Les futurs raccordements seront placés dans :

```text
adapters/speedarti/
```

uniquement lors du travail d'intégration piloté par Anne-Sophie.

## Points à vérifier lorsque le vrai dépôt d'Anne-Sophie sera accessible

1. identité exacte des tables/entités Catalogue ;
2. structure Produit ;
3. éventuelle quantité Stock existante dans Produit ;
4. structure Stock déjà présente ;
5. source de vérité finale ;
6. identifiants `company_id`, `user_id`, `chantier_id`, `product_id` ;
7. RLS existantes ;
8. services Chiffrage ;
9. services Commandes/Achats ;
10. Comptabilité opérationnelle ;
11. Centre de notifications ;
12. outils Ángel existants.

Si un contrat diffère, adapter **l'adaptateur**, pas le moteur métier sans justification.

## Supabase future

Prévoir au raccordement :

- `company_id` obligatoire ;
- RLS stricte ;
- migrations versionnées ;
- audit ;
- permissions serveur ;
- idempotence ;
- validation serveur des mouvements ;
- aucune confiance dans le seul frontend.
