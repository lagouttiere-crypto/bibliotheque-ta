# Bibliothèque numérique — ATI France
*Architecture complète — État au 10 juin 2026*

tags: #infrastructure #bibliothèque #documentation

---

## Vue d'ensemble

Site statique (GitHub Pages) alimenté par un pipeline automatisé Google-centrique.
Aucun serveur applicatif. Toute la logique tourne soit dans Google Apps Script
(côté admin), soit dans le navigateur du membre (côté public).

```
index.html          ← chef d'orchestre, noyau dur
├── fulltext.js     ← recherche fulltext + recherche avancée
├── notes.js        ← notes personnelles, citations, tags
├── graph.js        ← graphe D3 des connexions par tags
├── groupes.js      ← groupes de lecture, notes collectives
└── ateliers.js     ← onglet Ateliers (Matthieu uniquement)
```

---

## Les 6 composants

### 1. Stockage des fichiers

Deux destinations selon le type :

**Scaleway Object Storage** (bucket `bibliotheque-ati`, région `fr-par`) :
PDFs uniquement. URLs au format
`https://bibliotheque-ati.s3.fr-par.scw.cloud/bibliotheque/[dossier]/[fichier]`.
CORS configuré via AWS CLI pour autoriser GitHub Pages.
Upload depuis `admin.html` via AWS Signature V4 dans Apps Script.
Filenames sanitisés côté client avant envoi (caractères spéciaux remplacés par `_`).

**Google Drive** :
MP3, EPUBs, DOCXs et autres formats non-PDF. Chaque fichier partagé en
"Toute personne avec le lien peut consulter". L'URL individuelle
(`drive.google.com/file/d/ID/view`) est renseignée dans le Google Sheet.

> Routage dans `admin.html` : PDF → Scaleway, MP3/EPUB/DOCX → Drive,
> liens externes (YouTube, pads) → Sheet directement sans upload.

---

### 2. Google Sheet "catalogue"

Source de vérité de toutes les métadonnées.
**Sheet ID** : `1bZ7XmfcullqADzXTFR7LwY7z9UubWDeTdta1ENJY-C8`

| Onglet | Contenu |
|---|---|
| `catalogue` | Un doc par ligne : id, title, author, year, type, lang, themes, driveUrl, description, duree, physique, videoPassword, featuredOrder… |
| `annotations` | Commentaires des membres (prénom + texte + docId) |
| `tags` | Tags membres collaboratifs (prénom + tag + docId) |
| `emprunts` | Emprunts physiques (docId + prénom + date + retour) |
| `reading_list` | Liste de lecture par membre |
| `read_logs` | Historique de lectures |
| `notes` | Notes personnelles par utilisateur |
| `notes_tags` | Tags extraits des notes (#hashtags) |
| `notes_groupe` | Notes partagées au sein d'un groupe |
| `groupes` | Groupes de lecture (avec mot de passe optionnel) |
| `fulltext` | Index fulltext (fallback si `fulltext.json` indisponible) |
| `favorites` | Ratings ☘ (1 à 3) par membre et par document |
| `membres` | *Planifié* — système de rôles dynamiques |

> **Note Sheet locale FR** : les IDs séparés par virgule sont interprétés comme
> décimaux. Préfixer les cellules avec `'` (ex. `'75,76` dans la colonne `docs`
> des groupes).

---

### 3. Google Apps Script

**URL de déploiement** :
`https://script.google.com/macros/s/AKfycbw3KqB-9zc06Mhc7TBvIJp9sFgmgpZbKOsxSH-Rhl2WqFvptZB7SplAkq0YEV4_nrmlw/exec`

> Tout changement `doGet`/`doPost` nécessite un **nouveau déploiement explicite**
> (pas seulement une sauvegarde).

**Code.gs** :
- Lit le Sheet catalogue et génère `docs.json`
- Pousse `docs.json` sur GitHub via l'API GitHub
- Génère et publie `fulltext.json` sur GitHub via `publierFulltext()`
  (déclenchée à chaque indexation de page 1)
- Token GitHub stocké dans `PropertiesService` (sécurisé, jamais en clair)
- Trigger automatique toutes les 10 min + flag `CATALOGUE_MODIFIE`
- Gère les requêtes `doGet`/`doPost` des membres :
  annotations, tags, emprunts, notes, groupes, fulltext
- Fulltext : requêtes POST avec `Content-Type: text/plain;charset=utf-8`
  pour éviter le preflight CORS
- Réindexation : ignore les docs déjà indexés (seuil < 3 pages)
- Gère l'upload de fichiers vers Drive (partage automatique)
- Gère l'upload vers Scaleway via AWS Signature V4 (`uploaderFichierScaleway`)
  - Clé HMAC : octets intermédiaires passés via `Utilities.newBlob(msg).getBytes()`
  - Valeurs négatives converties avec `e < 0 ? e + 256 : e` en hex

**admin.html** (interface d'administration) :
- Formulaire d'ajout de document avec upload fichier
- Indexation fulltext automatique post-upload pour les PDFs Scaleway
- Gestion emprunts : prêt et retour avec autocomplete
- Mise à jour manuelle possible ("Mettre à jour la bibliothèque")

---

### 4. GitHub Pages

**Repo** : `lagouttiere-crypto/bibliotheque-ta`

Fichiers principaux :

| Fichier | Rôle |
|---|---|
| `index.html` | Application principale |
| `docs.json` | Catalogue des documents (généré par Apps Script) |
| `fulltext.json` | Index fulltext statique (généré par Apps Script) |
| `viewer/viewer.html` | Viewer PDF.js 3.11.174 |

`docs.json` et `fulltext.json` sont régénérés à chaque modification du Sheet
et poussés sur GitHub automatiquement. GitHub Pages redéploie en ~1 min.

> `docs.json` est dans `.gitignore` pour éviter les conflits.
> Restauration si supprimé accidentellement : `git add -f docs.json`

---

### 5. Viewer PDF.js

PDF.js 3.11.174 intégré dans `viewer/viewer.html` via iframe.

- Navigation vers page cible : `#page=N` dans l'URL
- Transmission du terme de recherche : `postMessage({ type: 'find', query })`
  depuis `index.html` après l'événement `load` avec `{ once: true }`
- Bouton "Plein écran ↗" conditionnel pour les PDFs Scaleway
  (les fichiers Drive conservent "Ouvrir dans Drive ↗")
- Restriction d'origine commentée dans `viewer.js` ligne 1646

> **Nettoyage en attente** : la fonction `loadPdfJs()` (~200 lignes) est
> devenue inutile depuis l'intégration iframe. À supprimer lors d'une prochaine
> session de nettoyage.

> **Veille active — surlignage persistant PDF.js** :
> - https://github.com/mozilla/pdf.js/discussions/18962 (sérialisation annotations)
> - https://github.com/mozilla/pdf.js/issues/19369 (highlightSelection)
>
> Problème connu : `annotationStorage.serialize()` fonctionne mais
> `deserialize()` ne réaffiche pas les annotations. Fonctionnalité reportée
> jusqu'à résolution upstream.

---

### 6. Navigateur du membre (index.html côté client)

**Authentification** : mot de passe partagé `_BibliothequeAlexander2026`
vérifié côté client JS. Prénom libre, stocké dans `localStorage` (`ta_user`).

**Navigation** :
- Filtres sidebar repliable : type, langue, génération, thème, tags membres
- Recherche fulltext : Fuse.js v7.0.0 (`threshold: 0.35`) sur `titre`/`auteur`,
  index `fulltext.json` avec fallback Sheet automatique
- Terme de recherche avancée stocké dans `window._advQ`
  (le champ `adv-q` devient inaccessible quand le panneau se referme)
- Ordre éditorial curated via `featuredIds`

**Fiche document** (panneau détail) :
- Lecteur vidéo inline (YouTube embed ou Drive iframe)
- Lecteur audio Drive (iframe 80px)
- Viewer PDF intégré via iframe (PDFs Scaleway)
- Statut d'emprunt physique en temps réel
- Tags membres et annotations collaboratives

**Mon Espace** (panneau avec onglets) :
- **Textes** — liste de lecture et historique
- **Notes & Carte** — notes personnelles avec recherche (`filterMyNotes()`),
  citations (lignes `>` en markdown, `renderMyCitations()`),
  graphe D3.js des connexions par tags
- **Groupes** — groupes de lecture avec protection optionnelle par mot de passe,
  documents à accès restreint par groupe

Ratings ☘ (1 à 3) par document, stockés dans l'onglet `favorites`.

**Fonctionnalités avancées** : réservées à `'Matthieu'` et `'JulietteF'`.
Vision à long terme : système de rôles dynamiques chargé au login depuis
l'onglet `membres`, vérification par `userRights.includes('feature')`.

---

## Architecture des modules ES

Tous chargés dynamiquement dans `showApp()` via `import('./module.js')`.

> **Point critique Safari** : `notes.js` doit être chargé avec `.then()` pour
> garantir que ses fonctions sont disponibles sur `window` avant d'être appelées.
> Chrome est plus permissif sur le timing, Safari non.

```js
import('./fulltext.js');
import('./graph.js');
import('./notes.js').then(() => {
  window.loadLocalNotes?.();
  window.loadNotesFromSheet?.();
  window.loadNotesTags?.();
});
import('./groupes.js').then(m => { m.loadGroupes(); });
```

### `fulltext.js`
- `loadFulltextIndex()` — charge `fulltext.json`, fallback Sheet
- `openFulltextSearch()` / `closeFulltextSearch()`
- `toggleAdvancedSearch()`
- `lancerRechercheAvancee()`
- `searchFulltext()` — Fuse.js v7.0.0
- `indexerTousLesDocsScaleway()` — indexation PDF via PDF.js

### `notes.js`
- `onNoteInput()` / `saveNote()` — debounce 1s, localStorage + Sheet
- `loadLocalNotes()` / `loadNotesFromSheet()` / `loadNotesTags()`
- `filterMyNotes()` — recherche dans les notes (Matthieu uniquement)
- `deleteNote(docId)`
- `renderMyCitations()` — extrait les lignes `>` en markdown
- `renderNotesPanel()`

### `graph.js`
- `renderNotesGraph(targetContainerId)` — génère le HTML du conteneur SVG
- `_initNotesGraph(graphId)` — initialise D3, charge D3 dynamiquement si absent
- `_initGraph(svg, nodes, edges, W, H)` — simulation de forces D3
- `openGraphModal()` / `closeGraphModal(e)`

> **Point d'attention** : au clic sur un nœud, fermer la modale ET Mon Espace
> avant d'ouvrir le reader :
> ```js
> window.closeGraphModal?.(); window.closeMySpace?.(); window.openReader?.(id);
> ```

### `groupes.js`
- Initialise `window.groupesState = []` dès le chargement du module
- `loadGroupes()` / `renderMySpaceGroupes()`
- `openGroupPanel()` / `closeGroupPanel()`
- `createGroupe()` / `joinGroupe()` / `leaveGroupe()`
- `toggleGroupAccordion()` / `toggleAccordionDocNotes()`
- `addGroupNote()` / `addGroupNoteAccordion()`
- `deleteDocFromCatalogue()` — bloqué pour les docs Drive
- Listener autocomplete dropdown intégré dans le module

---

## État partagé via `window`

```js
window.docs              // tableau des documents
window.currentUser       // prénom de l'utilisateur connecté
window.SHEET_URL         // URL Apps Script
window.groupesState      // tableau des groupes ([] initialisé par groupes.js)
window.notesTagsState    // { docId: [tags] } pour le graphe D3
window._currentReaderId  // id du doc ouvert dans le reader
window._pdfSearchTerm    // terme à transmettre au viewer PDF
window._pdfTargetPage    // page cible au chargement
window._advQ             // terme recherche avancée (survit à la fermeture du panneau)
window._advAuthor        // auteur recherche avancée
window._advType          // type recherche avancée
```

---

## Flux de travail — ajouter un document

1. Ouvrir `admin.html`
2. Remplir le formulaire : métadonnées + upload du fichier
   - PDF → Scaleway, URL récupérée automatiquement
   - MP3 / EPUB / DOCX → Drive, partage automatique, URL récupérée
   - Lien externe (YouTube, pad…) → saisir l'URL directement, pas d'upload
3. Pour les PDFs Scaleway : indexation fulltext automatique post-upload
4. Apps Script enregistre dans le Sheet et pousse `docs.json` + `fulltext.json`
5. GitHub Pages redéploie (~1 min)

> Exception gros fichiers : upload manuel préalable via rclone ou Drive,
> puis copier l'URL dans le formulaire `admin.html`.

## Flux de travail — gérer un emprunt

1. Membre demande un livre physique
2. Admin ouvre `admin.html` → section "Emprunts" → cherche le doc →
   enregistre le prêt (prénom + date)
3. Statut affiché en temps réel sur la fiche du livre
4. Au retour → admin enregistre le retour dans `admin.html`

---

## Design

Palette London Review of Books :

```css
--cream: #F2F1EE
--ink: #222222
--ink-light: #6B6760
--ink-faint: #B8B4AC
--accent: #7BAEC1      /* bleu canard */
--accent-light: #EEF5F9
--border: #D8D3C9
--editorial: #B75D4A   /* terracotta */
```

Polices : Cormorant Garamond (titres) + DM Sans (corps).
Hero : bloc bleu canard avec photo David Gorman (N&B circulaire, hébergée sur
Scaleway dans `bibliotheque/images/`).
Sidebar repliable : grid `220px 1fr` → `32px 1fr`.

---

## Règles de travail

- **Ne jamais reconstruire `index.html` de zéro** — modifications chirurgicales uniquement
- **Toujours demander le code avant de proposer** — le code réel peut avoir évolué
- **Safari** : tester en fenêtre privée ; les modules ES doivent être chargés
  avec `.then()` avant d'appeler leurs fonctions exposées sur `window`
- **Apps Script** : tout changement `doGet`/`doPost` nécessite un nouveau déploiement
- **Google Sheets FR** : préfixer les cellules d'IDs avec `'` pour éviter
  l'interprétation décimale
- **localStorage** : clés au format `ta_${type}_${currentUser}` ;
  risque de double encodage JSON — protéger avec `try { raw = JSON.parse(raw) } catch(e) {}`
- **`window._advQ`** : stocker le terme de recherche avancée dans cette variable
  globale car le champ `adv-q` devient inaccessible quand le panneau se referme
- **Quand bloqué sur une techno peu documentée** (signatures AWS4, comportements
  Safari, nouvelles versions de bibliothèques) : reconnaître la limite et demander
  un exemple concret récent qui fonctionne, plutôt que d'itérer sur des
  connaissances potentiellement obsolètes

---

## Références techniques

| Élément | Valeur |
|---|---|
| Sheet ID | `1bZ7XmfcullqADzXTFR7LwY7z9UubWDeTdta1ENJY-C8` |
| Apps Script URL | `https://script.google.com/macros/s/AKfycbw3.../exec` |
| Bucket Scaleway | `bibliotheque-ati` / région `fr-par` |
| Endpoint Scaleway | `s3.fr-par.scw.cloud` |
| Repo GitHub | `lagouttiere-crypto/bibliotheque-ta` |
| Mot de passe | `_BibliothequeAlexander2026` |
| PDF.js | 3.11.174 |
| Fuse.js | v7.0.0 |
| D3.js | 7.8.5 |

**rclone** : remote `scaleway`
```bash
rclone copy [fichier] scaleway:bibliotheque-ati/bibliotheque/[dossier]/ --progress
```

**AWS CLI** :
```bash
aws --endpoint-url https://s3.fr-par.scw.cloud s3 cp fichier.pdf s3://bibliotheque-ati/bibliotheque/[dossier]/
```

**git** : alias `git pushr` = `git pull --rebase && git push`
