# Plan de tests Sprint A

## Moteur

- entrée de stock ;
- sortie ;
- refus de sortie supérieure au disponible ;
- transfert entre deux emplacements ;
- conservation du total entreprise lors du transfert ;
- réservation ;
- séparation physique/réservé/disponible ;
- unité incompatible refusée ;
- idempotence d'un événement source.

## Connecteurs

- enveloppe `schemaVersion: 1.0` ;
- champs obligatoires compatibles avec Équipe & Planning ;
- aucun connecteur production prêt au Sprint A ;
- un connecteur désactivé doit retourner une erreur explicite.

## Ángel

- pack global présent ;
- source de vérité présente ;
- validation humaine présente ;
- `80x70` → 80/70 mm ;
- `8x7` ne devient jamais 80/70 mm ;
- synonymes = recherche, pas correspondance automatique.

## Chutes

Sprint A définit le contrat.

Les tests géométriques de compatibilité restent dans les moteurs CALPI/Agencement, qui sont propriétaires du calcul exact.

Le Stock conserve et transmet cette géométrie sans la simplifier.

## Commande

```bash
npm run check
```
