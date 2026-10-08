# Correctif G.1 — Retour utilisateur Stock

Origine : retour manuel utilisateur reçu le 8 octobre 2026.

## Corrections livrées

### 1. Autocomplétion de la désignation

Le champ Désignation propose désormais des noms d'articles courants au fur et à mesure de la saisie.

Exemple :

```text
CHE
→ Chevron
```

Les noms déjà présents dans le stock rejoignent également les suggestions.

Aucune suggestion n'est imposée automatiquement.

### 2. Section / dimensions séparée

Nouveau champ facultatif :

```text
Section / dimensions
Ex. 70 × 80 mm
```

La section est enregistrée séparément de la désignation et apparaît dans la fiche Stock.

### 3. Alerte stock minimum

Le libellé ambigu `Seuil minimum` est remplacé dans l'interface par :

```text
Alerte stock minimum
```

Une aide précise qu'une alerte apparaît lorsque le stock disponible atteint ou passe sous cette quantité.

### 4. Conversion bidirectionnelle

Le conditionnement ne fonctionne plus uniquement dans le sens unité → mesure.

Cas Guillaume :

```text
Unité de stock : ml
Quantité initiale : 2 ml
Longueur d'un chevron : 4 m

Résultat :
2 ml = 0,5 pièce
```

La même logique est prévue pour les surfaces et volumes :

```text
6,25 m² / 3,125 m² par panneau = 2 panneaux
```

La quantité de stock principale reste l'unique source de vérité.

### 5. Aperçu immédiat

Le formulaire affiche l'équivalence calculée avant validation.

Exemple :

```text
Équivalence calculée
2 ml = 0,5 pièce
```

### 6. Erreurs visibles dans le formulaire

Les données obligatoires manquantes ou invalides sont maintenant :

- surlignées en rouge ;
- accompagnées d'un message sous le champ ;
- résumées en haut de la fenêtre.

Les erreurs du formulaire Article ne reposent plus uniquement sur le toast général pouvant être masqué derrière la boîte de dialogue.

## Non-modifié

- moteur de mouvements ;
- réservations ;
- inventaire ;
- Stock fournisseur ;
- Stock Expert QR/véhicules ;
- aucun code SpeedArti/GSTAI production.
