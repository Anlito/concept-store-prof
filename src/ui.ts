import { h } from '@cs3d/ui/dom';
import { button } from '@cs3d/ui/components';

/* Petits éléments d'interface propres à l'outil professeur (le reste vient de Concept Store 3D). */

export const app = () => document.getElementById('app')!;

/** Fenêtre avec un champ texte. Résout le texte saisi, ou null (Annuler, Échap). */
export function demander(titre: string, texte: string, valeur = '', opts: { placeholder?: string; suggestions?: string[]; ok?: string } = {}): Promise<string | null> {
  return new Promise(resolve => {
    const liste = 'sugg-' + Math.random().toString(36).slice(2);
    const input = h('input', { value: valeur, placeholder: opts.placeholder ?? '', 'aria-label': titre, list: opts.suggestions?.length ? liste : undefined, maxLength: 40 }) as HTMLInputElement;
    const fin = (v: string | null) => { veil.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const valider = () => { const v = input.value.trim(); if (v) fin(v); else input.focus(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fin(null); } if (e.key === 'Enter') { e.preventDefault(); valider(); } };
    const veil = h('div', { class: 'modal-veil' },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
        h('h2', null, titre), h('p', null, texte),
        h('label', { class: 'tf' }, input),
        opts.suggestions?.length ? h('datalist', { id: liste }, ...opts.suggestions.map(s => h('option', { value: s }))) : null,
        h('div', { class: 'modal-btns' }, button('Annuler', null, 'btn-ghost', () => fin(null)), button(opts.ok ?? 'Valider', 'check', 'btn-primary', valider))));
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(veil);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

/** Télécharge un fichier (sauvegarde, export). */
export function telecharger(nom: string, contenu: string | Blob, type = 'application/octet-stream') {
  const url = URL.createObjectURL(typeof contenu === 'string' ? new Blob([contenu], { type }) : contenu);
  const a = h('a', { href: url, download: nom }); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Choisit des fichiers (sans dossier). */
export function choisirFichiers(accept: string, multiple = false): Promise<File[]> {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } }) as HTMLInputElement;
    input.addEventListener('change', () => { resolve([...(input.files ?? [])]); input.remove(); });
    document.body.appendChild(input); input.click();
  });
}

/** Photo réduite à 1600 px (JPEG) : un classeur avec des dizaines de photos reste léger. */
export async function reduirePhoto(f: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const im = new Image(); im.src = url; await im.decode();
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export const fmtNote = (x: number | null) => (x === null ? '–' : String(x).replace('.', ','));
export const quand = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
