import { h, icon } from '@cs3d/ui/dom';
import { button, choose, toast } from '@cs3d/ui/components';
import { estClasseur, nouveauClasseur, type Classeur } from './model';
import { dossierMemorise, ecrireClasseur, listeClasseurs, lireClasseur, memoriserDossier, supprimerClasseur } from './storage';
import { fichiersDeLaListe, fichiersDuDossier, lireClasse, type Lecture } from './scan';
import { app, choisirFichiers, demander, quand } from './ui';
import { ouvrirClasse } from './classe';

/* Accueil : ouvrir le dossier d'une classe, reprendre une classe déjà évaluée, importer une sauvegarde. */

type PickerWindow = Window & { showDirectoryPicker?: (o?: object) => Promise<FileSystemDirectoryHandle> };
type Permis = FileSystemDirectoryHandle & { queryPermission?(o: object): Promise<string>; requestPermission?(o: object): Promise<string> };

export async function accueil() {
  const liste = h('div', { class: 'pf-classes' });
  app().replaceChildren(h('div', { class: 'home pf-home' },
    h('header', { class: 'home-h' },
      h('div', { class: 'home-brand' }, h('div', { class: 'home-logo pf-logo' }, icon('storefront')), 'Concept Store · Professeur'),
      h('span', { class: 'pf-ver' }, 'version ' + __APP_VERSION__)),
    h('main', { class: 'home-m' },
      h('h1', null, 'Évaluer une classe'),
      h('p', { class: 'pf-lead' }, 'Ouvre le dossier où les équipes rangent leur travail (par exemple ', h('b', null, '4B › COMMUN › TECHNOLOGIE › CONCEPT STORE'),
        ') : l’outil retrouve, dans chaque dossier d’équipe, la modélisation 3D et le site internet.'),
      h('div', { class: 'home-cards' },
        h('button', { class: 'hc primary', type: 'button', 'data-testid': 'ouvrir-dossier', onclick: () => void ouvrirDossier() },
          h('span', { class: 'hc-ic' }, icon('folder_open')), h('span', { class: 'hc-t' }, h('b', null, 'Ouvrir le dossier d’une classe'), h('span', null, 'Les dossiers des équipes'))),
        h('button', { class: 'hc', type: 'button', onclick: () => void importer() },
          h('span', { class: 'hc-ic' }, icon('upload_file')), h('span', { class: 'hc-t' }, h('b', null, 'Importer une sauvegarde'), h('span', null, 'Fichier .csprof (notes et photos)')))),
      liste,
      h('p', { class: 'home-foot' }, h('span', null, 'Les notes et les photos restent sur cet ordinateur, dans le navigateur. Rien n’est envoyé sur Internet : pense à ',
        h('b', null, 'Sauvegarder'), ' l’évaluation (fichier .csprof) dans ton dossier personnel, pas dans celui des élèves.')))));
  const cs = await listeClasseurs();
  if (cs.length) liste.replaceChildren(h('h2', null, 'Classes déjà évaluées'), ...cs.map(c => h('div', { class: 'pf-classe' },
    h('div', { class: 'pf-classe-t' }, h('b', null, c.classe), h('span', null, `${Object.keys(c.equipes).length} équipe(s) · modifié ${quand(c.maj)}`)),
    button('Rouvrir le dossier', 'folder_open', 'btn-primary', () => void rouvrir(c)),
    button('Voir les notes', 'checklist', 'btn-secondary', () => void ouvrirClasse(c, null)),
    h('button', { class: 'btn btn-ghost btn-icon', type: 'button', title: 'Supprimer de cet ordinateur', 'aria-label': `Supprimer ${c.classe}`, onclick: () => void supprimer(c) }, icon('delete')))));
}

/** Dossier choisi (Chrome / Edge : sélecteur de dossier ; sinon champ « dossier »). */
async function ouvrirDossier(classeConnue?: string) {
  const w = window as PickerWindow;
  let lecture: Lecture, nom: string, handle: FileSystemDirectoryHandle | null = null;
  if (typeof w.showDirectoryPicker === 'function') {
    try { handle = await w.showDirectoryPicker({ id: 'csprof-classe', mode: 'read' }); } catch { return; }
    nom = handle.name;
    toast('Lecture des dossiers des équipes…');
    lecture = await lireClasse(await fichiersDuDossier(handle), nom);
    lecture.racine = handle;
  } else {
    const files = await new Promise<File[]>(resolve => {
      const input = h('input', { type: 'file', webkitdirectory: true, multiple: true, style: { display: 'none' }, 'data-testid': 'dossier-input' }) as HTMLInputElement;
      input.addEventListener('change', () => { resolve([...(input.files ?? [])]); input.remove(); });
      document.body.appendChild(input); input.click();
    });
    if (!files.length) return;
    nom = (files[0].webkitRelativePath || '').split('/')[0] || 'Classe';
    lecture = await lireClasse(fichiersDeLaListe(files), nom);
  }
  if (!lecture.equipes.length) {
    toast('Aucun projet d’équipe dans ce dossier : choisis le dossier qui contient les dossiers des équipes.', undefined, 'warning');
    return;
  }
  const deja = (await listeClasseurs()).map(c => c.classe);
  const classe = classeConnue ?? await demander('Quelle classe ?', `${lecture.equipes.length} équipe(s) trouvée(s) dans « ${nom} ». Les notes seront rangées sous ce nom de classe.`, '', { placeholder: '4B', suggestions: deja, ok: 'Ouvrir' });
  if (!classe) return;
  const c = (await lireClasseur(classe)) ?? nouveauClasseur(classe);
  if (handle) void memoriserDossier(classe, handle);
  await ecrireClasseur(c);
  await ouvrirClasse(c, lecture);
}

/** Rouvre le dossier mémorisé d'une classe (le navigateur redemande l'autorisation de lecture). */
async function rouvrir(c: Classeur) {
  const h0 = (await dossierMemorise(c.classe)) as Permis | undefined;
  if (h0?.requestPermission) {
    try {
      if ((await h0.queryPermission?.({ mode: 'read' })) !== 'granted' && (await h0.requestPermission({ mode: 'read' })) !== 'granted') throw new Error('refus');
      toast('Lecture des dossiers des équipes…');
      const lecture = await lireClasse(await fichiersDuDossier(h0), h0.name);
      lecture.racine = h0;
      await ouvrirClasse(c, lecture);
      return;
    } catch { /* dossier déplacé, ou autorisation refusée : on le redemande */ }
  }
  await ouvrirDossier(c.classe);
}

async function importer() {
  const [f] = await choisirFichiers('.csprof,application/json');
  if (!f) return;
  try {
    const c = JSON.parse(await f.text());
    if (!estClasseur(c)) throw new Error();
    const existe = await lireClasseur(c.classe);
    if (existe) {
      const r = await choose('Cette classe existe déjà', `« ${c.classe} » a déjà des notes sur cet ordinateur (modifiées ${quand(existe.maj)}). La sauvegarde date du ${quand(c.maj)}.`,
        [{ label: 'Annuler', value: 'non', cls: 'btn-ghost' }, { label: 'Remplacer par la sauvegarde', value: 'oui', cls: 'btn-danger' }]);
      if (r !== 'oui') return;
    }
    await ecrireClasseur(c);
    toast(`Classe « ${c.classe} » importée.`);
    void accueil();
  } catch { toast('Ce fichier n’est pas une sauvegarde de l’outil professeur.', undefined, 'warning'); }
}

async function supprimer(c: Classeur) {
  const r = await choose(`Supprimer « ${c.classe} » ?`, 'Les notes et les photos de cette classe seront effacées de cet ordinateur. Les fichiers des élèves ne sont pas touchés.',
    [{ label: 'Annuler', value: 'non', cls: 'btn-ghost' }, { label: 'Supprimer', value: 'oui', cls: 'btn-danger' }]);
  if (r !== 'oui') return;
  await supprimerClasseur(c.classe);
  void accueil();
}

declare const __APP_VERSION__: string;
