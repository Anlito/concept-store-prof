# Concept Store · Professeur

Outil de l'enseignant pour le projet **« Concept Store »** (technologie, cycle 4) : il ouvre le dossier d'une classe
et montre, pour chaque équipe, la **modélisation 3D** (Concept Store 3D) et le **site internet** (Vitrine),
avec une **notation par grilles de critères** :

- **Modélisation 3D**, **site internet**, **maquette carton** : notes d'équipe ;
- **oral** : une note par élève ;
- **photos de la maquette carton** ajoutées par le professeur ;
- note finale pondérée (coefficients réglables), ajustement individuel, **export CSV** (Excel, Pronote).

**En ligne :** https://anlito.github.io/concept-store-prof/ (Chrome ou Edge). Outil réservé au professeur.

## Utilisation

1. **Ouvrir le dossier d'une classe** : celui qui contient un dossier par équipe
   (par exemple `4B › COMMUN › TECHNOLOGIE › CONCEPT STORE`). Dans chaque dossier d'équipe, l'outil retrouve
   le projet 3D (`.json`), le site (`.vitrine`), le plan A3 (PDF). Les projets modèles du professeur sont ignorés.
2. Pour chaque équipe : visiter la 3D (et le plan), feuilleter le site, ajouter les photos de la maquette,
   noter chaque partie critère par critère.
3. **Sauvegarder** l'évaluation (fichier `.csprof`, photos comprises) dans son dossier personnel,
   **jamais dans le dossier des élèves**. **Exporter (Excel)** donne une ligne par élève.

Les notes et les photos restent dans le navigateur de l'ordinateur du professeur : rien n'est envoyé sur Internet.
Les fichiers des élèves sont seulement lus, jamais modifiés.

## Développement

L'outil réutilise le code des deux outils élèves, lu à la construction (pas de copie) :
[Concept Store 3D](https://github.com/Anlito/concept-store-3d) (vue 3D, plan, modèle) et
[Vitrine](https://github.com/Anlito/creation-site-vitrine) (fabrication du site, contrôles automatiques, grille du site).
En local, ils sont attendus à côté de ce dossier (`../ConceptStore3D`, `../ConceptStoreSite`) ;
sinon, indiquer leur emplacement avec `CS3D_DIR` et `VITRINE_DIR`.

```
npm install
npm run build   # dist/
npm test        # tests Playwright : une classe d'exemple fabriquée avec les vrais outils élèves
npm run dev
```

| Fichier | Rôle |
|---|---|
| `src/model.ts` | grilles proposées, classeur d'évaluation, calcul des notes, export CSV |
| `src/scan.ts` | lecture du dossier de la classe (équipes, projets, sites, plans, mobilier du professeur) |
| `src/viewer.ts`, `src/site.ts` | 3D et plan (Concept Store 3D), site page par page (Vitrine) |
| `src/classe.ts`, `src/accueil.ts`, `src/grilles.ts` | écrans |
| `src/storage.ts` | stockage local (IndexedDB) |

## Licence

MIT (voir `LICENSE`).
