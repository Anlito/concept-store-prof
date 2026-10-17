import type { Project } from '@cs3d/model/types';
import { sanitizeProject } from '@cs3d/model/project';
import { estProjet, normaliserProjet, type Projet as Vitrine } from '@vitrine/model';

/* Lecture du dossier de la classe (« 4X › COMMUN › TECHNOLOGIE › CONCEPT STORE ») : un sous-dossier par équipe,
   qui contient le projet 3D (.json), le site (.vitrine), le plan A3 (PDF) et des photos du rendu.
   Deux façons de l'ouvrir : le sélecteur de dossier de Chrome / Edge (mémorisable), ou un <input webkitdirectory>. */

export interface Fichier { chemin: string[]; file: File }
export interface Equipe {
  dossier: string;
  projet?: { nom: string; date: number; doc: Project };
  site?: { nom: string; date: number; projet: Vitrine };
  plans: File[];
  images: File[];
  /** Fichiers illisibles (projet abîmé, autre format…) : signalés au professeur. */
  erreurs: string[];
}
export interface Lecture {
  equipes: Equipe[]; mobilier: { path: string; bytes: number; data: ArrayBuffer }[];
  /** Dossier de la classe ouvert avec le sélecteur de Chrome / Edge : on peut y ranger les photos des maquettes. */
  racine?: FileSystemDirectoryHandle;
}

type Dir = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };
const UTILES = /\.(json|vitrine|pdf|png|jpe?g|webp|glb)$/i;

/** Tous les fichiers utiles du dossier (3 niveaux au plus). */
export async function fichiersDuDossier(dir: FileSystemDirectoryHandle, chemin: string[] = [], prof = 0): Promise<Fichier[]> {
  const out: Fichier[] = [];
  for await (const e of (dir as Dir).values()) {
    if (e.kind === 'file' && UTILES.test(e.name)) out.push({ chemin: [...chemin, e.name], file: await (e as FileSystemFileHandle).getFile() });
    else if (e.kind === 'directory' && prof < 3 && !e.name.startsWith('.')) out.push(...await fichiersDuDossier(e as FileSystemDirectoryHandle, [...chemin, e.name], prof + 1));
  }
  return out;
}
/** Fichiers d'un <input webkitdirectory> : le premier segment est le dossier choisi, on le retire. */
export const fichiersDeLaListe = (list: FileList | File[]): Fichier[] =>
  [...list].filter(f => UTILES.test(f.name)).map(f => ({ chemin: (f.webkitRelativePath || f.name).split('/').slice(1), file: f }));

export async function lireClasse(fichiers: Fichier[], nomDossier: string): Promise<Lecture> {
  const mobilier: Lecture['mobilier'] = [];
  const parEquipe = new Map<string, Fichier[]>();
  for (const f of fichiers) {
    const i = f.chemin.findIndex(s => s.toLowerCase() === 'mobilier');
    if (i >= 0 && /\.glb$/i.test(f.file.name)) { // modèles du professeur (dossier « Mobilier » de l'outil)
      mobilier.push({ path: f.chemin.slice(i + 1).join('/'), bytes: f.file.size, data: await f.file.arrayBuffer() });
      continue;
    }
    // Fichier posé directement dans le dossier choisi : c'est le dossier d'une seule équipe.
    const eq = f.chemin.length === 1 ? nomDossier : f.chemin[0];
    (parEquipe.get(eq) ?? parEquipe.set(eq, []).get(eq)!).push(f);
  }
  const equipes: Equipe[] = [];
  for (const [dossier, fs] of parEquipe) {
    const e: Equipe = { dossier, plans: [], images: [], erreurs: [] };
    const recents = [...fs].sort((a, b) => b.file.lastModified - a.file.lastModified);
    for (const f of recents) {
      const n = f.file.name;
      if (/\.vitrine$/i.test(n)) {
        if (e.site) continue;
        try { const x = JSON.parse(await f.file.text()); if (estProjet(x)) e.site = { nom: n, date: f.file.lastModified, projet: normaliserProjet(x) }; else e.erreurs.push(n); }
        catch { e.erreurs.push(n); }
      } else if (/\.json$/i.test(n)) {
        if (e.projet) continue;
        try {
          const x = JSON.parse(await f.file.text());
          if (x?.format !== 'concept-store-3d' || x.isTemplate) continue; // autre fichier, ou projet modèle du professeur
          e.projet = { nom: n, date: f.file.lastModified, doc: sanitizeProject(x) };
        } catch { e.erreurs.push(n); }
      } else if (/\.pdf$/i.test(n)) e.plans.push(f.file);
      else if (/\.(png|jpe?g|webp)$/i.test(n)) e.images.push(f.file);
    }
    if (e.projet || e.site) equipes.push(e); // un dossier sans projet n'est pas une équipe (dossier de l'outil, photos…)
  }
  equipes.sort((a, b) => a.dossier.localeCompare(b.dossier, 'fr'));
  return { equipes, mobilier };
}
