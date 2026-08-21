# Dashboard de suivi — Déploiement AP-HP

Prototype de suivi du déploiement (module "Hospitalisation Complète") sur les
hôpitaux AP-HP de Paris / Île-de-France.

## Ouvrir le projet dans VS Code

1. Dézippe le dossier, ouvre-le dans VS Code (`Fichier > Ouvrir le dossier...`).
2. Installe l'extension **Live Server** (par Ritwick Dey) si tu ne l'as pas déjà.
3. Clic droit sur `index.html` → **Open with Live Server**.
   (Ou simplement double-clique sur `index.html` pour l'ouvrir dans un navigateur —
   ça fonctionne aussi, sans serveur.)

Aucune installation Node/npm n'est nécessaire : le projet est en HTML/CSS/JS pur,
la carte utilise Leaflet chargé depuis un CDN.

## Structure du projet

```
aphp-dashboard/
├── index.html          → structure de la page
├── style.css            → mise en forme
├── app.js                → logique (carte, sélection, filtres)
├── data.js               → données générées (NE PAS éditer à la main)
└── generate_data.py      → script pour régénérer data.js depuis un nouvel export Excel
```

## Mettre à jour les données

Quand tu as un nouvel export Excel (même structure que `Dep_APHP.xlsx`) :

```bash
python generate_data.py chemin/vers/nouvel_export.xlsx
```

Ça régénère `data.js`. Recharge la page dans le navigateur, c'est à jour.

Si le script signale des **hôpitaux sans coordonnées connues**, c'est qu'un nouvel
établissement apparaît dans l'export : ajoute ses coordonnées GPS dans le
dictionnaire `COORDS` en haut de `generate_data.py`.

## Ce qui est encore en attente / à décider

- **Interprétation du statut "Non concerné"** dans le calcul du taux de
  déploiement : actuellement compté comme "reste à déployer"
  (`taux = Déployé / (Déployé + Non concerné)`). Une bannière d'avertissement
  dans la fiche détail le rappelle. Si l'équipe projet tranche autrement, il
  faudra ajuster la formule dans `generate_data.py` (fonction `main`).
- **Coordonnées des hôpitaux** : positions approximatives basées sur les
  adresses connues. À vérifier avec la base officielle FINESS/Atlasanté
  (data.gouv.fr) si une précision certifiée est nécessaire.
- **Historique dans le temps** : le dashboard n'affiche qu'un instantané à
  date. Si plusieurs exports doivent être comparés dans le temps, il faudra
  ajouter une notion de date à chaque jeu de données et une vue d'évolution.
- **8 sites exclus du périmètre** (hors Paris/IDF ou non-géographiques) :
  Hôpital Maritime de Berck, Hôpital Marin d'Hendaye, sites San Salvadour,
  Administration générale, AGEPS, HAD.

## Prochaines étapes possibles

- Vue "à surveiller" : liste globale des UF non-déployées, tous hôpitaux confondus.
- Export CSV/PDF de la fiche détail d'un hôpital.
- Filtrage de la carte par GH.
- Historisation si plusieurs exports deviennent disponibles.
