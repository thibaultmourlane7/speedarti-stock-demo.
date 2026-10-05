# Plan de tests — état Sprint B

Commande :

```bash
npm run check
```

## Contrats Sprint A

- enveloppe compatible Équipe & Planning ;
- garde-fou Ángel `8x7` ;
- pack Ángel et validation humaine ;
- permissions côté métier ;
- connecteurs production désactivés.

## Moteur Stock

- entrée puis sortie ;
- stock négatif interdit ;
- transfert conserve le total entreprise ;
- réservation distincte du stock physique ;
- idempotence ;
- unité incompatible refusée ;
- libération de réservation ;
- ajustement négatif impossible s'il crée un stock négatif ;
- seuil faible et rupture.

## Sprint B applicatif

- `Dépôt principal` créé une seule fois ;
- création d'article avec quantité initiale = mouvement `ENTRY` ;
- entrée et sortie passent par le moteur métier ;
- sortie supérieure au disponible refusée ;
- recherche partielle insensible à la casse et aux accents.

Résultat local au lancement du Sprint B : **19 tests réussis sur 19**.
