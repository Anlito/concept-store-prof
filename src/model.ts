import { GRILLE as GRILLE_SITE } from '@vitrine/data/constantes';

/* Évaluation d'une classe : grilles de critères, notes des équipes, oral de chaque élève, photos de la maquette.
   Tout reste sur l'ordinateur du professeur (navigateur) ; un fichier « .csprof » sert de sauvegarde. */

export type PartId = 'modele' | 'site' | 'maquette' | 'oral';
export const PARTS: PartId[] = ['modele', 'site', 'maquette', 'oral'];
export const PART_LABEL: Record<PartId, string> = { modele: 'Modélisation 3D', site: 'Site internet', maquette: 'Maquette carton', oral: 'Oral' };
export const PART_ICON: Record<PartId, string> = { modele: 'view_in_ar', site: 'web', maquette: 'photo_camera', oral: 'group' };

export interface Critere { t: string; p: number }
export interface Grille { coef: number; criteres: Critere[] }

/** Grilles proposées au départ (modifiables dans l'outil). Celle du site reprend celle de Vitrine. */
export function grillesParDefaut(): Record<PartId, Grille> {
  return {
    modele: { coef: 1, criteres: [
      { t: 'Surface conforme au plan et aux 10 × 7 m', p: 3 },
      { t: 'Pièces et circulation cohérentes (cloisons, réserve, accès)', p: 3 },
      { t: 'Ouvertures : porte d’entrée, vitrines, fenêtres', p: 2 },
      { t: 'Aménagement adapté au concept du magasin', p: 4 },
      { t: 'Mobilier créé dans l’Atelier', p: 3 },
      { t: 'Décoration cohérente : murs, sol, façade, vitrine', p: 3 },
      { t: 'Cohérence avec la maquette carton', p: 2 },
    ] },
    site: { coef: 1, criteres: GRILLE_SITE.map(c => ({ t: c.t, p: c.p })) },
    maquette: { coef: 1, criteres: [
      { t: 'Respect du plan A3 et de l’échelle', p: 5 },
      { t: 'Qualité de fabrication : découpes, collages, angles', p: 5 },
      { t: 'Cloisons et ouvertures conformes', p: 3 },
      { t: 'Aménagement et mobilier', p: 4 },
      { t: 'Cohérence avec la modélisation 3D', p: 3 },
    ] },
    oral: { coef: 1, criteres: [
      { t: 'Présentation du concept du magasin', p: 4 },
      { t: 'Explication des choix (3D, maquette, site)', p: 5 },
      { t: 'Vocabulaire technique', p: 3 },
      { t: 'Expression : clarté, voix, posture', p: 4 },
      { t: 'Réponses aux questions', p: 4 },
    ] },
  };
}

/** Points donnés à chaque critère (null = pas encore noté). */
export type Points = (number | null)[];
export interface Photo { id: string; data: string; date: number }
export interface EvalEquipe {
  /** Élèves de l'équipe (lus dans le cartouche ou le nom du dossier, modifiables). */
  eleves: string[];
  notes: { modele: Points; site: Points; maquette: Points };
  /** Oral : une grille par élève. */
  oral: Record<string, Points>;
  /** Ajustement individuel de la note finale (points, positif ou négatif). */
  ajust: Record<string, number>;
  comm: Partial<Record<PartId, string>>;
  photos: Photo[];
}
export interface Classeur {
  format: 'concept-store-prof';
  version: 1;
  classe: string;
  grilles: Record<PartId, Grille>;
  /** Par dossier d'équipe. */
  equipes: Record<string, EvalEquipe>;
  maj: number;
}

export const nouveauClasseur = (classe: string): Classeur => ({ format: 'concept-store-prof', version: 1, classe, grilles: grillesParDefaut(), equipes: {}, maj: Date.now() });
export const nouvelleEval = (eleves: string[]): EvalEquipe => ({ eleves, notes: { modele: [], site: [], maquette: [] }, oral: {}, ajust: {}, comm: {}, photos: [] });

export function estClasseur(x: unknown): x is Classeur {
  const c = x as Classeur;
  return !!c && c.format === 'concept-store-prof' && typeof c.classe === 'string' && !!c.grilles && !!c.equipes;
}

/* ---------- Calcul des notes ---------- */
const arrondi = (x: number) => Math.round(x * 10) / 10;
/** Note sur 20 d'une grille, ou null si aucun critère n'est noté. Les critères non notés comptent 0 dès qu'un autre l'est. */
export function noteSur20(g: Grille, pts: Points | undefined): number | null {
  if (!pts || !pts.some(x => x !== null && x !== undefined)) return null;
  const max = g.criteres.reduce((s, c) => s + c.p, 0);
  if (!max) return null;
  const sum = g.criteres.reduce((s, _c, i) => s + (pts[i] ?? 0), 0);
  return arrondi((sum / max) * 20);
}
/** Nombre de critères notés / total. */
export const progression = (g: Grille, pts: Points | undefined) => ({ faits: g.criteres.filter((_c, i) => pts?.[i] != null).length, total: g.criteres.length });

export interface NotesEleve { modele: number | null; site: number | null; maquette: number | null; oral: number | null; ajust: number; finale: number | null }
/** Notes d'un élève : trois notes d'équipe, son oral, son ajustement, et la note finale pondérée. */
export function notesEleve(c: Classeur, e: EvalEquipe, eleve: string): NotesEleve {
  const n: Record<PartId, number | null> = {
    modele: noteSur20(c.grilles.modele, e.notes.modele),
    site: noteSur20(c.grilles.site, e.notes.site),
    maquette: noteSur20(c.grilles.maquette, e.notes.maquette),
    oral: noteSur20(c.grilles.oral, e.oral[eleve]),
  };
  let s = 0, k = 0;
  for (const p of PARTS) { const v = n[p]; if (v !== null) { s += v * c.grilles[p].coef; k += c.grilles[p].coef; } }
  const ajust = e.ajust[eleve] ?? 0;
  const finale = k ? arrondi(Math.max(0, Math.min(20, s / k + ajust))) : null;
  return { modele: n.modele, site: n.site, maquette: n.maquette, oral: n.oral, ajust, finale };
}

/* ---------- Export pour Excel / Pronote ---------- */
const fr = (x: number | null) => (x === null ? '' : String(x).replace('.', ','));
const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
/** CSV (séparateur « ; », virgule décimale, UTF-8 avec BOM) : une ligne par élève. */
export function exportCsv(c: Classeur): string {
  const rows = [['Classe', 'Équipe', 'Élève', ...PARTS.map(p => `${PART_LABEL[p]} /20`), 'Ajustement', 'Note finale /20']];
  for (const [dossier, e] of Object.entries(c.equipes).sort(([a], [b]) => a.localeCompare(b, 'fr'))) {
    for (const el of e.eleves) {
      const n = notesEleve(c, e, el);
      rows.push([c.classe, dossier, el, fr(n.modele), fr(n.site), fr(n.maquette), fr(n.oral), n.ajust ? fr(n.ajust) : '', fr(n.finale)]);
    }
  }
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Élèves devinés : prénoms du cartouche (« Léa, Malik ») sinon nom du dossier (« Lea-Malik »). */
export function elevesDevines(membres: string | undefined, dossier: string): string[] {
  const src = membres?.trim() ? membres : dossier;
  const sep = membres?.trim() ? /\s*(?:,|;|\bet\b|&|\/)\s*/i : /[-_ ]+/;
  return src.split(sep).map(s => s.trim()).filter(Boolean).map(s => s[0].toUpperCase() + s.slice(1));
}
