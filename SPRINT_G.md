# Sprint G — Stock Expert : QR / codes-barres et véhicules

Statut : développé dans la démo autonome. Aucun raccordement production.

## QR et codes-barres

Le Stock Expert accepte deux familles de codes.

### Code-barres produit

Un code-barres classique permet uniquement d'identifier un article.

Le scan seul ne crée **aucun mouvement**.

Après identification, l'utilisateur choisit explicitement :

- Entrée ;
- Sortie ;
- Transfert.

### QR SpeedArti

Format métier :

```text
speedarti://stock/v1
?action=TRANSFER
&product=<id>
&quantity=5
&unit=piece
&from=<location_id>
&to=<location_id>
&chantier=<chantier_id>
```

Actions supportées :

- `ENTRY`
- `EXIT`
- `TRANSFER`
- `SITE_RETURN`

Un QR peut donc préparer :

- une entrée ;
- une sortie ;
- un transfert ;
- une sortie chantier via `EXIT + chantier` ;
- un retour chantier.

## Validation humaine obligatoire

Un scan crée toujours un **brouillon**.

```text
scan
→ analyse
→ affichage article / quantité / emplacement / chantier
→ validation humaine
→ mouvement Stock
```

Sans validation humaine explicite, aucune écriture n'est autorisée.

Cette règle est appliquée dans `StockExpertScanService.confirm(...)`.

## Caméra

La démo tente d'utiliser l'API navigateur `BarcodeDetector` lorsqu'elle est disponible.

Formats demandés :

- QR Code ;
- EAN-13 ;
- EAN-8 ;
- Code 128.

Si le navigateur ne supporte pas cette API, un lecteur code-barres USB/Bluetooth ou une saisie/copie du code reste utilisable.

Aucune reconnaissance IA n'est utilisée dans ce sprint.

## Code-barres article

Un code-barres actif est unique dans l'entreprise.

Deux articles actifs ne peuvent pas partager le même code.

Une référence inconnue provoque une erreur explicite : aucun article n'est inventé.

## Stock avancé par véhicule

Chaque véhicule reste un **StockLocation** de type `vehicule`.

Il possède :

- nom ;
- immatriculation facultative via `vehicleId` dans la démo ;
- stock physique par article ;
- stock réservé ;
- stock disponible ;
- nombre de références chargées.

## Actions véhicule

La démo fournit :

- création d'un véhicule ;
- chargement depuis le Dépôt principal ;
- retour véhicule → dépôt ;
- sortie chantier depuis le véhicule ;
- vue du contenu véhicule ;
- conservation des réservations par véhicule.

Un chargement ou retour est un vrai `TRANSFER`.

Une sortie chantier depuis véhicule est un vrai `EXIT` avec emplacement véhicule.

## Source de vérité

Le Stock véhicule n'est pas une copie.

Il utilise les mêmes mouvements immuables que les autres emplacements.

```text
Dépôt : -5
Camion : +5
Stock total entreprise : inchangé
```

## Hors Sprint G

- reconnaissance produit par image ;
- OCR d'étiquette ;
- estimation de quantité par vision ;
- inventaire photo ;
- analyses Expert ;
- intégration production ;
- génération graphique d'étiquettes QR imprimables.

Ces éléments restent pour les lots Stock Expert suivants.
