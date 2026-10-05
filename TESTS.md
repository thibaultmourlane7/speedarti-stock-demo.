# Plan de tests — état Sprint C

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

## Sprint C

- transfert entre deux emplacements ;
- le transfert conserve le total entreprise ;
- quantité physique par emplacement ;
- perte et casse diminuent le stock ;
- retour chantier augmente le stock de destination ;
- inventaire compare théorique et compté ;
- écart d'inventaire génère un mouvement `ADJUSTMENT` ;
- aucun mouvement si l'écart est nul ;
- correction refusée si elle rend le stock disponible négatif face à une réservation ;
- inventaire par emplacement ;
- historique origine / destination / motif / chantier ;
- compilation navigateur de l'interface Sprint C.

Le résultat de référence est celui du dernier workflow GitHub Actions associé au commit Sprint C.
