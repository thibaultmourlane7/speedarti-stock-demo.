# Sprint G.2 — Inventaire daté, véhicules connectés et destinations

Statut : développé dans la démo autonome. Le vrai SpeedArti / GSTAI est resté en lecture seule absolue.

## Origine

Retours de Guillaume :

- supprimer l'onglet Inventaire permanent et lancer un inventaire ponctuel depuis Mon stock ;
- éviter le doublon entre chargement véhicule et préparation QR ;
- utiliser les véhicules déjà gérés dans les Paramètres / Parc matériel SpeedArti ;
- rendre explicite la destination d'une sortie de matériel.

## Inventaire

L'onglet permanent Inventaire est supprimé.

Depuis **Mon stock**, l'utilisateur lance **Créer mon inventaire**.

Une session conserve :

- id ;
- emplacement ;
- nom de l'emplacement ;
- date/heure de création ;
- utilisateur ;
- snapshot théorique de chaque article ;
- comptage physique ;
- statut `OPEN / COMPLETED / VALIDATED`.

### Séparation stricte

```text
Créer l'inventaire
→ snapshot théorique figé

Compter
→ sauvegarde du comptage uniquement

Terminer mon inventaire
→ état COMPLETED
→ aucune mutation Stock

Appliquer les corrections
→ ADJUSTMENT
→ état VALIDATED
```

Quitter puis rouvrir la démo permet de reprendre une session ouverte grâce à la persistance localStorage.

## Véhicules

La source de vérité de l'identité véhicule est :

**Parc matériel / Paramètres SpeedArti**

Stock conserve :

- le `vehicleId` externe ;
- l'emplacement Stock associé ;
- les quantités par article ;
- les mouvements.

Stock ne devient pas propriétaire du nom, de l'immatriculation ou de l'état actif.

Événements préparés :

- `parc_materiel.vehicle.created`
- `parc_materiel.vehicle.updated`
- `parc_materiel.vehicle.disabled`

Une désactivation empêche de sélectionner le véhicule sans supprimer l'historique.

## Chargement véhicule

Le clic **Charger** est la validation humaine.

Il crée immédiatement un seul mouvement :

```text
TRANSFER
Dépôt principal → véhicule
```

Il n'existe pas de seconde validation ni de second moteur.

## QR / code-barres

La section de création manuelle d'un deuxième parcours QR est supprimée.

Le scan reste disponible comme raccourci :

```text
scan
→ identification / contexte
→ action standard Entrée, Sortie ou Transfert
→ même moteur Stock
```

## Destination d'une sortie

Une sortie classique demande maintenant une destination explicite :

- chantier ;
- équipe ;
- consommé / autre sortie.

Les équipes viennent du contrat Équipe & Planning.

Les chantiers viennent du contrat Agenda / Chantier.

Une référence inconnue est refusée.

Véhicule reste un transfert physique, pas une sortie.

Casse et perte gardent respectivement les mouvements `BREAKAGE` et `LOSS`.

## Connecteurs audités

### SpeedArti production

Le dépôt réel `GSTAI-Sp/speedarti-v2` a uniquement été consulté en lecture. Aucun fichier, branche ou paramètre n'a été modifié.

### Équipe & Planning

La démo existante indiquait déjà :

```text
vehiclesEquipment = Parc matériel
```

comme source de vérité.

Le contrat de démonstration a été complété pour expliciter :

- `parc_materiel`
- `stock_vehicle_context`

Aucune connexion production n'a été activée.

### Matrice G.2

| Source / cible | Rôle |
|---|---|
| Parc matériel / Paramètres | identité véhicule |
| Équipe & Planning | équipes, besoins matériels |
| Agenda / Chantier | chantiers, interventions |
| Catalogue | identité produit |
| Stock | quantités, emplacements, mouvements, inventaires |
| Commandes / Achats | réapprovisionnement |
| Notifications | diffusion alertes |
| Ángel | lecture et brouillons validés |
| Pilotage | KPI lecture |

## Ángel

Le pack existant passe à **stock@1.2.0**.

Aucune base parallèle n'a été créée.

Ajouts :

- source de vérité véhicules ;
- source de vérité équipes ;
- source de vérité chantiers ;
- inventaire daté ;
- QR utilisant le même moteur ;
- règles de destination ;
- intentions véhicule et inventaire.

## Toujours hors périmètre

- écriture dans SpeedArti production ;
- migrations Supabase production ;
- vrai connecteur Parc matériel ;
- vrai connecteur Équipe & Planning ;
- vrai connecteur Agenda / Chantier ;
- Vision / OCR du Sprint H.
