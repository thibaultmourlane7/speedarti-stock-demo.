# Sprint C — Transferts, inventaire et ajustements

Statut : développé dans le dépôt de démonstration, sans raccordement production.

## Périmètre livré

- transfert de stock entre emplacements ;
- conservation du stock total entreprise lors d'un transfert ;
- vue des quantités physiques par emplacement ;
- inventaire manuel par emplacement ;
- affichage du stock théorique ;
- saisie du stock compté ;
- calcul de l'écart ;
- correction via un vrai mouvement `ADJUSTMENT` ;
- aucun écrasement silencieux de quantité ;
- blocage d'un ajustement qui rendrait le stock physique ou disponible négatif ;
- mouvements `LOSS`, `BREAKAGE` et `SITE_RETURN` ;
- historique enrichi avec origine, destination, motif et chantier ;
- interface mobile/tablette/ordinateur mise à jour ;
- persistance locale conservée derrière `StockRepository` ;
- aucun accès à Supabase production ou au vrai SpeedArti.

## Règles métier

### Transfert

Un transfert :

```text
Dépôt principal : -5
Camion 1 : +5
Total entreprise : inchangé
```

Le départ et l'arrivée doivent être différents.

### Inventaire

Le comptage n'écrase jamais directement la quantité.

```text
théorique : 10
compté : 7
écart : -3
→ mouvement ADJUSTMENT -3
```

Si l'écart est nul, aucun mouvement n'est créé.

Si une correction négative ferait passer le disponible sous une réservation existante, la correction est refusée explicitement.

### Perte / casse

Les mouvements `LOSS` et `BREAKAGE` diminuent le stock à l'emplacement choisi et restent visibles dans l'historique.

### Retour chantier

`SITE_RETURN` ajoute la quantité à l'emplacement de destination en conservant la référence chantier si elle est fournie.

## Hors Sprint C

- réservations visibles et pilotables dans l'interface ;
- demandes de matériel depuis Équipe & Planning ;
- besoin de réapprovisionnement / brouillon de commande ;
- raccordement réel Catalogue / Chiffrage / Chantier ;
- stock fournisseur ;
- caméra / OCR / vision ;
- intégration production SpeedArti.

Ces éléments sont réservés aux lots suivants.

## Déploiement

GitHub Pages utilise désormais **GitHub Actions** comme source. Le workflow du dépôt compile la démo, exécute les tests et publie explicitement `browser-dist` avec le site.
