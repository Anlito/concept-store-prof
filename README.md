# Concept Store · Professeur

<!-- suivi-maintenance:debut -->
## État du projet et améliorations documentées — 21 octobre 2026

- La version locale reprend la dernière version de la branche principale publiée sur GitHub.
- Le suivi existant couvre la modélisation 3D, le site vitrine, la maquette carton et l’oral ; il comprend les photos de la maquette à la webcam, les coefficients et l’export CSV.
- Aucune fonction de l’application n’a été modifiée pendant cette intervention de synchronisation et de documentation. Les modes d’utilisation et de notation décrits ci-dessous sont conservés.

### Référence locale et maintenance

Dossier de travail de référence : **Documents/ConceptStoreProf**. Dépôt : [Anlito/concept-store-prof](https://github.com/Anlito/concept-store-prof). La branche principale est **main**. Les copies temporaires d’un chat ou les worktrees servent au travail intermédiaire ; elles ne remplacent pas ce dossier.

À chaque intervention :

1. Vérifier les modifications locales et la version publiée avant de commencer ; sauvegarder le travail non enregistré.
2. Décrire dans ce README les améliorations, les vérifications, les limites et les opérations restantes.
3. Publier les changements autorisés, puis synchroniser le dossier local de référence avec le même commit.
4. Contrôler le commit local, le commit distant et les fichiers restants avant d’annoncer que le projet est à jour. Signaler explicitement tout décalage ou travail conservé hors publication.

Cette règle permet de reprendre le projet dans un autre outil local sans perdre les dernières améliorations. Une publication du site ne met pas automatiquement à jour les dossiers du PC.

<!-- suivi-maintenance:fin -->

Outil de l'enseignant pour le projet **« Concept Store »** (technologie, cycle 4) : il ouvre le dossier d'une classe
et montre, pour chaque équipe, la **modélisation 3D** (Concept Store 3D) et le **site internet** (Vitrine),
avec une **notation par grilles de critères** :

- **modélisation 3D**, **site internet**, **maquette carton** et **oral** : notes d'équipe, par grilles de critères ;
- **photos de la maquette carton** ajoutées par le professeur ;
- note du projet pondérée (coefficients réglables), puis **bonus / malus individuel avec son motif** (comportement, investissement…) ;
- **export CSV** (Excel, Pronote) : une ligne par élève, motif compris.

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
