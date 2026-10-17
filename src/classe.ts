import { h, icon } from '@cs3d/ui/dom';
import { button, choose, toast } from '@cs3d/ui/components';
import { area } from '@cs3d/model/geometry';
import { rooms } from '@cs3d/model/rooms';
import { useProfFiles } from '@cs3d/library/profFolder';
import { verifier } from '@vitrine/lib/controle';
import {
  PARTS, PART_ICON, PART_LABEL, elevesDevines, exportCsv, noteSur20, normaliserEval, notesEleve, nouvelleEval, progression,
  type Classeur, type EvalEquipe, type PartId,
} from './model';
import { ecrireClasseur } from './storage';
import type { Equipe, Lecture } from './scan';
import { Viewer } from './viewer';
import { SiteViewer } from './site';
import { editerGrilles } from './grilles';
import { app, choisirFichiers, demander, fmtNote, quand, reduirePhoto, slug, telecharger } from './ui';
import { accueil } from './accueil';
import { arreterCamera, carteCamera } from './camera';

/* Écran d'une classe : équipes à gauche, travail de l'équipe au centre (3D, site, maquette, oral, bilan),
   grille de notation à droite. Chaque changement est gardé aussitôt dans le navigateur. */

type Onglet = PartId | 'bilan';
const ONGLETS: { id: Onglet; label: string; icon: string }[] = [
  { id: 'modele', label: 'Modélisation 3D', icon: 'view_in_ar' }, { id: 'site', label: 'Site internet', icon: 'web' },
  { id: 'maquette', label: 'Maquette carton', icon: 'photo_camera' }, { id: 'oral', label: 'Oral', icon: 'group' },
  { id: 'bilan', label: 'Bilan', icon: 'checklist' },
];

let viewer: Viewer | null = null, site: SiteViewer | null = null;
/** Photos prises dans l'outil et rangées dans le dossier de l'équipe. */
const PREFIXE_PHOTO = 'Maquette_';
/** Droit d'écrire dans le dossier de la classe (ouvert en lecture) : demandé une fois, au premier enregistrement. */
async function droitEcriture(d: FileSystemDirectoryHandle) {
  type P = FileSystemDirectoryHandle & { queryPermission?(o: object): Promise<string>; requestPermission?(o: object): Promise<string> };
  try {
    if ((await (d as P).queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
    return (await (d as P).requestPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch { return false; }
}

export async function ouvrirClasse(c: Classeur, lecture: Lecture | null) {
  viewer ??= new Viewer(); site ??= new SiteViewer();
  const fichiers = new Map<string, Equipe>((lecture?.equipes ?? []).map(e => [e.dossier, e]));
  if (lecture?.mobilier.length) useProfFiles(lecture.mobilier, 'Mobilier');
  // Une évaluation par équipe trouvée ; les équipes déjà notées restent même si leur dossier n'est pas là.
  for (const e of lecture?.equipes ?? []) c.equipes[e.dossier] ??= nouvelleEval(elevesDevines(e.projet?.doc.team.members, e.dossier));
  for (const e of Object.values(c.equipes)) normaliserEval(e);
  let timer = 0;
  const garder = () => { clearTimeout(timer); timer = window.setTimeout(() => void ecrireClasseur(c), 250); };

  const noms = () => Object.keys(c.equipes).sort((a, b) => a.localeCompare(b, 'fr'));
  let dossier = noms()[0] ?? '', onglet: Onglet = 'modele';
  const ev = () => c.equipes[dossier];

  const side = h('aside', { class: 'pf-side', 'aria-label': 'Équipes' });
  const main = h('main', { class: 'pf-main' });
  const panel = h('aside', { class: 'pn pf-panel', 'data-testid': 'grille' });
  const titre = h('div', { class: 'tb-status' });
  const top = h('header', { class: 'tb' },
    h('div', { class: 'tb-l' },
      h('button', { class: 'tb-logo pf-logo', type: 'button', title: 'Accueil', onclick: () => { viewer?.activer(false); arreterCamera(); void accueil(); } }, icon('storefront')),
      h('div', { class: 'tb-title' }, h('div', { class: 'tb-name pf-classe-nom' }, `Classe ${c.classe}`), titre)),
    h('div'),
    h('div', { class: 'tb-r' },
      button('Bilan de la classe', 'checklist', 'btn-ghost', () => bilanClasse()),
      button('Grilles', 'tune', 'btn-ghost', () => void editerGrilles(c, () => { garder(); rendre(); })),
      button('Exporter (Excel)', 'download', 'btn-ghost', () => telecharger(`notes-concept-store-${slug(c.classe)}.csv`, exportCsv(c), 'text/csv;charset=utf-8')),
      button('Sauvegarder', 'save', 'btn-primary', () => sauvegarder())));
  app().replaceChildren(h('div', { class: 'ed pf' }, top, h('div', { class: 'ed-body' }, side, main, panel)));

  function sauvegarder() {
    const d = new Date(), j = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    telecharger(`evaluation-${slug(c.classe)}-${j}.csprof`, JSON.stringify(c), 'application/json');
    toast('Sauvegarde téléchargée : range-la dans ton dossier personnel (pas dans celui des élèves).');
  }

  /* ---------- Rendu ---------- */
  function rendre() {
    titre.textContent = lecture ? `${noms().length} équipe(s) · dossier lu` : `${noms().length} équipe(s) · sans le dossier (notes seulement)`;
    rendreSide(); rendreMain(); rendrePanel();
  }

  function rendreSide() {
    side.replaceChildren(h('div', { class: 'pf-side-t' }, 'Équipes'), ...noms().map(n => {
      const e = c.equipes[n], f = fichiers.get(n);
      const faites = PARTS.filter(p => noteSur20(c.grilles[p], e.notes[p]) !== null).length;
      return h('button', { class: 'pf-team' + (n === dossier ? ' on' : ''), type: 'button', 'data-equipe': n, onclick: () => { dossier = n; rendre(); } },
        h('b', null, n),
        h('span', { class: 'pf-team-e' }, e.eleves.join(', ') || '—'),
        h('span', { class: 'pf-team-s' },
          h('span', { class: 'pf-chip' + (f?.projet ? ' ok' : '') , title: f?.projet ? 'Modélisation 3D trouvée' : 'Pas de modélisation 3D' }, icon('view_in_ar')),
          h('span', { class: 'pf-chip' + (f?.site ? ' ok' : ''), title: f?.site ? 'Site trouvé' : 'Pas de site' }, icon('web')),
          h('span', { class: 'pf-chip' + (e.photos.length ? ' ok' : ''), title: `${e.photos.length} photo(s) de la maquette` }, icon('photo_camera')),
          h('span', { class: 'pf-prog', title: 'Parties notées' }, `${faites}/4`)));
    }));
  }

  function rendreMain() {
    viewer?.activer(false);
    if (onglet !== 'maquette') arreterCamera(); // la caméra reste allumée d'une équipe à l'autre, pas hors de l'onglet
    if (!dossier) { main.replaceChildren(h('div', { class: 'pf-vide' }, 'Aucune équipe.')); return; }
    const e = ev(), f = fichiers.get(dossier);
    const tabs = h('div', { class: 'pf-tabs', role: 'tablist' }, ...ONGLETS.map(o => h('button', {
      type: 'button', role: 'tab', class: 'pf-tab' + (o.id === onglet ? ' on' : ''), 'aria-selected': String(o.id === onglet),
      onclick: () => { onglet = o.id; rendreMain(); rendrePanel(); },
    }, icon(o.icon), o.label)));
    const entete = h('div', { class: 'pf-head' },
      h('div', null, h('h1', null, dossier), h('div', { class: 'pf-eleves' }, ...e.eleves.map(x => h('span', { class: 'pf-eleve' }, x)),
        h('button', { class: 'linkbtn', type: 'button', onclick: () => void modifierEleves() }, 'Modifier les élèves'))),
      tabs);
    main.replaceChildren(entete, contenu(e, f));
  }

  function contenu(e: EvalEquipe, f: Equipe | undefined): HTMLElement {
    if (onglet === 'modele') {
      if (!f?.projet) return vide('view_in_ar', lecture ? 'Pas de modélisation 3D (.json) dans ce dossier d’équipe.' : 'Ouvre le dossier de la classe pour voir la modélisation 3D.');
      const d = f.projet.doc, nbPieces = d.floor ? rooms(d).length : 0;
      const infos = h('div', { class: 'pf-infos' },
        info('description', f.projet.nom, `enregistré ${quand(f.projet.date)}`),
        info('grid_on', d.floor ? `${Math.round(area(d.floor.points) * 10) / 10} m²`.replace('.', ',') : 'Pas de surface', `${nbPieces} pièce(s) · ${d.partitions.length} cloison(s)${d.autreNiveau ? ' · + 1 étage' : ''}`),
        info('chair', `${d.objects.length} meuble(s)`, `${d.creations.length} création(s) de l’atelier`),
        info('print', f.plans.length ? `${f.plans.length} PDF` : 'Pas de plan A3', f.plans.length ? 'dans le dossier' : 'enregistré par l’équipe', f.plans.length ? () => ouvrirFichier(f.plans[0]) : undefined));
      viewer!.afficher(d);
      requestAnimationFrame(() => viewer!.activer(onglet === 'modele'));
      return h('div', { class: 'pf-tabc' }, infos, viewer!.el);
    }
    if (onglet === 'site') {
      if (!f?.site) return vide('web', lecture ? 'Pas de site (.vitrine) dans ce dossier d’équipe.' : 'Ouvre le dossier de la classe pour voir le site.');
      void site!.afficher(f.site.projet);
      return h('div', { class: 'pf-tabc' }, h('div', { class: 'pf-infos' }, info('description', f.site.nom, `enregistré ${quand(f.site.date)}`), info('web', f.site.projet.nom, `${f.site.projet.pages.filter(p => p.active).length} page(s)`)), site!.el);
    }
    if (onglet === 'maquette') return maquette(e, f);
    if (onglet === 'oral') return oral(e);
    return bilanEquipe(e);
  }

  const info = (ic: string, t: string, s: string, onclick?: () => void) =>
    h(onclick ? 'button' : 'div', { class: 'pf-info' + (onclick ? ' clic' : ''), type: onclick ? 'button' : undefined, onclick }, icon(ic), h('span', null, h('b', null, t), h('span', null, s)));
  const vide = (ic: string, t: string) => h('div', { class: 'pf-vide' }, icon(ic), h('p', null, t));
  function ouvrirFichier(f: File) { const u = URL.createObjectURL(f); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); }

  /* ---------- Maquette carton : photos (webcam, fichiers) ---------- */
  function maquette(e: EvalEquipe, f: Equipe | undefined) {
    const ajouter = async (files: File[]) => {
      const imgs = files.filter(x => x.type.startsWith('image/'));
      if (!imgs.length) return;
      for (const x of imgs) e.photos.push({ id: Math.random().toString(36).slice(2, 10), data: await reduirePhoto(x), date: Date.now() });
      garder(); rendreMain(); rendreSide();
      toast(`${imgs.length} photo(s) ajoutée(s).`);
    };
    const racine = lecture?.racine;
    const camera = carteCamera({
      ou: racine ? `La photo est ajoutée à l’évaluation et rangée dans le dossier de l’équipe (${dossier}).` : 'La photo est ajoutée à l’évaluation (ouvre le dossier de la classe pour la ranger aussi dans le dossier de l’équipe).',
      garder: async photo => {
        // Droit d'écrire dans le dossier de la classe : demandé tout de suite (le navigateur exige un clic récent).
        const ecrire = racine ? await droitEcriture(racine) : false;
        const blob = await photo();
        e.photos.push({ id: Math.random().toString(36).slice(2, 10), data: await reduirePhoto(new File([blob], 'photo.jpg', { type: 'image/jpeg' })), date: Date.now() });
        garder(); rendrePhotos(); rendreSide();
        if (!racine) return 'Photo ajoutée à l’évaluation.';
        if (!ecrire) return 'Photo ajoutée à l’évaluation. Le navigateur n’a pas donné le droit d’écrire dans le dossier de la classe : elle n’y est pas copiée.';
        try { return `Photo ajoutée à l’évaluation et enregistrée dans le dossier ${dossier} : ${await ecrirePhoto(racine, blob)}`; }
        catch { return 'Photo ajoutée à l’évaluation, mais pas copiée dans le dossier de l’équipe (réseau ou droits du dossier).'; }
      },
    });
    const photos = h('div');
    const rendrePhotos = () => photos.replaceChildren(zonePhotos());
    const zonePhotos = () => { const zone = h('div', { class: 'pf-drop', 'data-testid': 'photos' },
      ...e.photos.map(p => h('figure', { class: 'pf-photo' },
        h('img', { src: p.data, alt: 'Photo de la maquette', onclick: () => agrandir(p.data) }),
        h('button', { class: 'pf-photo-x', type: 'button', title: 'Retirer cette photo', 'aria-label': 'Retirer cette photo', onclick: async () => {
          if ((await choose('Retirer cette photo ?', 'Elle sera effacée de l’évaluation.', [{ label: 'Annuler', value: 'non', cls: 'btn-ghost' }, { label: 'Retirer', value: 'oui', cls: 'btn-danger' }])) !== 'oui') return;
          e.photos = e.photos.filter(x => x.id !== p.id); garder(); rendreMain(); rendreSide();
        } }, icon('delete')))),
      h('button', { class: 'pf-add', type: 'button', onclick: async () => void ajouter(await choisirFichiers('image/*', true)) }, icon('add_photo_alternate'), h('b', null, 'Ajouter des photos'), h('span', null, 'ou glisse-les ici')));
    zone.addEventListener('dragover', ev => { ev.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', ev => { ev.preventDefault(); zone.classList.remove('over'); void ajouter([...(ev.dataTransfer?.files ?? [])]); });
    return zone; };
    rendrePhotos();
    const plans = f?.plans.length ? h('div', { class: 'pf-infos' }, ...f.plans.map(p => info('print', p.name, 'plan A3 de l’équipe : à comparer avec la maquette', () => ouvrirFichier(p)))) : null;
    // Photos déposées par l'équipe dans son dossier (celles prises ici sont déjà dans l'évaluation).
    const autres = (f?.images ?? []).filter(x => !x.name.startsWith(PREFIXE_PHOTO));
    const dossierImgs = autres.length ? h('div', { class: 'pf-sec' }, h('div', { class: 'p-sec-t' }, 'Photos dans le dossier de l’équipe'),
      h('div', { class: 'pf-drop' }, ...autres.map(x => { const u = URL.createObjectURL(x); return h('figure', { class: 'pf-photo', title: x.name }, h('img', { src: u, alt: x.name, onclick: () => agrandir(u) })); }))) : null;
    return h('div', { class: 'pf-tabc pf-scroll' }, plans, camera, h('div', { class: 'p-sec-t' }, 'Photos de l’évaluation'), photos, dossierImgs);
  }
  /** Le dossier de l'équipe dans celui de la classe (ou la classe elle-même si c'est le dossier d'une seule équipe). */
  async function dossierDeLEquipe(racine: FileSystemDirectoryHandle) {
    return racine.name === dossier && !(await existeSousDossier(racine, dossier)) ? racine : racine.getDirectoryHandle(dossier);
  }
  async function existeSousDossier(r: FileSystemDirectoryHandle, nom: string) { try { await r.getDirectoryHandle(nom); return true; } catch { return false; } }
  /** Range la photo en .jpg dans le dossier de l'équipe : « Maquette_Lea_Malik_2026-10-17_10h42.jpg ». */
  async function ecrirePhoto(racine: FileSystemDirectoryHandle, blob: Blob) {
    const d = await dossierDeLEquipe(racine);
    const existants = new Set<string>();
    for await (const x of (d as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> }).values()) existants.add(x.name.toLowerCase());
    const t = new Date(), z = (n: number) => String(n).padStart(2, '0');
    const base = `${PREFIXE_PHOTO}${dossier.replace(/[\\/:*?"<>|]+/g, '_')}_${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}_${z(t.getHours())}h${z(t.getMinutes())}`;
    let nom = base + '.jpg';
    for (let i = 2; existants.has(nom.toLowerCase()); i++) nom = `${base}_${i}.jpg`;
    const fh = await d.getFileHandle(nom, { create: true });
    const w = await (fh as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable();
    await w.write(blob); await w.close();
    return nom;
  }
  function agrandir(src: string) {
    const fermer = () => veil.remove();
    const veil = h('div', { class: 'modal-veil pf-zoom', onclick: fermer }, h('img', { src, alt: 'Photo agrandie' }));
    document.body.appendChild(veil);
  }

  /* ---------- Oral : une note globale pour l'équipe ---------- */
  function oral(e: EvalEquipe) {
    return h('div', { class: 'pf-tabc pf-scroll' },
      h('p', { class: 'p-help' }, 'L’oral est noté pour toute l’équipe, dans la grille à droite. Pour un élève en particulier (comportement, participation…), mets un ',
        h('b', null, 'bonus ou un malus'), ' dans l’onglet ', h('button', { class: 'linkbtn', type: 'button', onclick: () => { onglet = 'bilan'; rendreMain(); rendrePanel(); } }, 'Bilan'), '.'),
      h('div', { class: 'pf-cards' }, ...e.eleves.map(x => h('div', { class: 'pf-card' }, icon('group'), h('b', null, x)))));
  }

  /* ---------- Bilan de l'équipe : note du projet, bonus / malus de chaque élève ---------- */
  function bilanEquipe(e: EvalEquipe) {
    const ligne = (x: string) => {
      const n = notesEleve(c, e, x);
      const bonus = h('input', { type: 'number', step: '0.5', min: '-20', max: '20', value: n.bonus ? String(n.bonus) : '', placeholder: '0', 'aria-label': `Bonus ou malus de ${x}`, class: 'pf-aj' }) as HTMLInputElement;
      bonus.addEventListener('change', () => { const v = parseFloat(bonus.value.replace(',', '.')); if (Number.isFinite(v) && v !== 0) e.bonus[x] = v; else delete e.bonus[x]; garder(); rendreMain(); });
      bonus.addEventListener('keydown', ev2 => ev2.stopPropagation());
      const pas = (d: number) => h('button', { class: 'pf-pas', type: 'button', title: d > 0 ? 'Bonus : +1 point' : 'Malus : −1 point', 'aria-label': `${d > 0 ? 'Bonus' : 'Malus'} d’un point pour ${x}`,
        onclick: () => { const v = Math.round(((e.bonus[x] ?? 0) + d) * 2) / 2; if (v) e.bonus[x] = v; else delete e.bonus[x]; garder(); rendreMain(); } }, d > 0 ? '+' : '−');
      const motif = h('input', { type: 'text', value: n.motif, placeholder: 'Motif (comportement, investissement…)', 'aria-label': `Motif pour ${x}`, class: 'pf-motif', maxLength: 120 }) as HTMLInputElement;
      motif.addEventListener('input', () => { if (motif.value.trim()) e.motifs[x] = motif.value; else delete e.motifs[x]; garder(); });
      motif.addEventListener('keydown', ev2 => ev2.stopPropagation());
      const cls = n.bonus > 0 ? ' plus' : n.bonus < 0 ? ' moins' : '';
      return h('tr', null, h('th', null, x), ...PARTS.map(p => h('td', null, fmtNote(n[p]))), h('td', { class: 'pf-proj' }, fmtNote(n.projet)),
        h('td', { class: 'pf-bonus' + cls }, h('div', { class: 'pf-bonus-c' }, pas(-1), bonus, pas(1))), h('td', null, motif), h('td', { class: 'pf-fin' }, fmtNote(n.finale)));
    };
    const coefs = PARTS.map(p => `${PART_LABEL[p]} ×${c.grilles[p].coef}`).join(' · ');
    return h('div', { class: 'pf-tabc pf-scroll' },
      h('table', { class: 'pf-table', 'data-testid': 'bilan' },
        h('thead', null, h('tr', null, h('th', null, 'Élève'), ...PARTS.map(p => h('th', null, PART_LABEL[p])), h('th', null, 'Note du projet'), h('th', null, 'Bonus / malus'), h('th', null, 'Motif'), h('th', null, 'Note finale'))),
        h('tbody', null, ...e.eleves.map(ligne))),
      h('p', { class: 'p-help' }, `Note du projet : moyenne pondérée des parties notées (${coefs}), la même pour toute l’équipe. Note finale : note du projet + bonus / malus de l’élève, en points (par exemple 16 − 1 = 15 ; on peut taper 0,5), entre 0 et 20. Les coefficients se règlent dans « Grilles ».`),
      ...PARTS.filter(p => e.comm[p]).map(p => h('div', { class: 'pf-comm' }, h('b', null, PART_LABEL[p]), h('p', null, e.comm[p]!))));
  }

  /* ---------- Grille de notation (panneau de droite) ---------- */
  function rendrePanel() {
    panel.style.display = onglet === 'bilan' || !dossier ? 'none' : '';
    if (onglet === 'bilan' || !dossier) return;
    const part = onglet, e = ev(), g = c.grilles[part];
    const pts = e.notes[part];
    // Même grille redessinée (un critère vient d'être noté) : on garde la position de défilement.
    const cle = dossier + '|' + part, garde = panel.dataset.grille === cle ? panel.querySelector('.pn-b')?.scrollTop ?? 0 : 0;
    panel.dataset.grille = cle;
    const note = noteSur20(g, pts), pr = progression(g, pts);
    const auto = part === 'site' && fichiers.get(dossier)?.site ? controles(fichiers.get(dossier)!) : null;
    const comm = h('textarea', { class: 'pf-commt', rows: 3, placeholder: 'Remarques (gardées pour le bilan)', 'aria-label': 'Commentaire' }) as HTMLTextAreaElement;
    comm.value = e.comm[part] ?? '';
    comm.addEventListener('input', () => { e.comm[part] = comm.value; garder(); });
    comm.addEventListener('keydown', ev2 => ev2.stopPropagation());
    panel.replaceChildren(
      h('div', { class: 'pn-h' }, h('div', { class: 'pn-ic' }, icon(PART_ICON[part])),
        h('div', { class: 'pn-t' }, h('div', { class: 'pn-t1' }, PART_LABEL[part]), h('div', { class: 'pn-t2' }, `${pr.faits}/${pr.total} critères notés`)),
        h('div', { class: 'pf-total', 'data-testid': 'note' }, note === null ? '– / 20' : `${fmtNote(note)} / 20`)),
      h('div', { class: 'pn-b' },
        auto,
        ...g.criteres.map((cr, i) => critere(cr.t, cr.p, pts[i] ?? null, v => { pts[i] = v; garder(); rendrePanel(); rendreSide(); })),
        h('label', { class: 'tf' }, 'Commentaire', comm)));
    panel.querySelector('.pn-b')!.scrollTop = garde;
  }

  /** Un critère : points possibles en boutons (0, ¼, ½, ¾, tout) ; un second clic efface la note. */
  function critere(t: string, max: number, v: number | null, set: (x: number | null) => void) {
    const vals = [...new Set([0, max / 4, max / 2, (3 * max) / 4, max].map(x => Math.round(x * 2) / 2))];
    return h('div', { class: 'pf-crit' },
      h('div', { class: 'pf-crit-t' }, h('span', null, t), h('b', null, v === null ? `– / ${fmtNote(max)}` : `${fmtNote(v)} / ${fmtNote(max)}`)),
      h('div', { class: 'pf-crit-b', role: 'group', 'aria-label': t }, ...vals.map(x => h('button', {
        type: 'button', class: 'pf-pt' + (v === x ? ' on' : ''), 'aria-pressed': String(v === x), title: `${fmtNote(x)} point(s)`,
        onclick: () => set(v === x ? null : x),
      }, fmtNote(x)))));
  }

  /** Les 8 contrôles automatiques de Vitrine, pour aider à noter le site. */
  function controles(f: Equipe) {
    const vs = verifier(f.site!.projet);
    return h('div', { class: 'pf-auto' }, h('div', { class: 'p-sec-t' }, `Contrôles automatiques de Vitrine : ${vs.filter(x => x.ok).length}/${vs.length}`),
      ...vs.map(x => h('div', { class: 'pf-auto-l' + (x.ok ? ' ok' : ''), title: x.ok ? '' : x.detail ?? '' }, icon(x.ok ? 'check_circle' : 'warning', true), x.t)));
  }

  async function modifierEleves() {
    const e = ev();
    const v = await demander('Élèves de l’équipe', 'Les prénoms, séparés par des virgules.', e.eleves.join(', '), { ok: 'Enregistrer' });
    if (v === null) return;
    e.eleves = v.split(',').map(s => s.trim()).filter(Boolean);
    garder(); rendre();
  }

  /* ---------- Bilan de la classe ---------- */
  function bilanClasse() {
    const fermer = () => { veil.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    const lignes = noms().flatMap(n => c.equipes[n].eleves.map((x, i) => {
      const r = notesEleve(c, c.equipes[n], x);
      return h('tr', null, i === 0 ? h('th', { rowSpan: c.equipes[n].eleves.length, class: 'pf-eq' }, n) : null, h('th', null, x),
        ...PARTS.map(p => h('td', null, fmtNote(r[p]))), h('td', { class: 'pf-proj' }, fmtNote(r.projet)),
        h('td', { class: 'pf-bonus' + (r.bonus > 0 ? ' plus' : r.bonus < 0 ? ' moins' : '') }, r.bonus ? (r.bonus > 0 ? '+' : '') + fmtNote(r.bonus) : ''), h('td', { class: 'pf-motif-t' }, r.motif), h('td', { class: 'pf-fin' }, fmtNote(r.finale)));
    }));
    const veil = h('div', { class: 'modal-veil' }, h('div', { class: 'imd hp wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Bilan de la classe' },
      h('div', { class: 'imd-h' }, h('h2', null, `Bilan · classe ${c.classe}`), h('button', { class: 'btn btn-ghost btn-icon', type: 'button', title: 'Fermer', onclick: fermer }, icon('close'))),
      h('div', { class: 'hp-b' },
        h('table', { class: 'pf-table' }, h('thead', null, h('tr', null, h('th', null, 'Équipe'), h('th', null, 'Élève'), ...PARTS.map(p => h('th', null, PART_LABEL[p])), h('th', null, 'Projet'), h('th', null, 'Bonus / malus'), h('th', null, 'Motif'), h('th', null, 'Finale'))),
          h('tbody', null, ...lignes)),
        h('div', { class: 'modal-btns' }, button('Exporter (Excel)', 'download', 'btn-primary', () => telecharger(`notes-concept-store-${slug(c.classe)}.csv`, exportCsv(c), 'text/csv;charset=utf-8'))))));
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(veil);
  }

  if (!lecture) toast('Notes seulement : ouvre le dossier de la classe pour voir la 3D et les sites.');
  else if (lecture.equipes.some(e => e.erreurs.length)) toast(`Fichiers illisibles : ${lecture.equipes.flatMap(e => e.erreurs).join(', ')}`, undefined, 'warning');
  rendre();
}
