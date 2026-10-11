import { h, icon } from '@cs3d/ui/dom';
import { button, choose, toast } from '@cs3d/ui/components';
import { PARTS, PART_ICON, PART_LABEL, grillesParDefaut, type Classeur, type Grille, type PartId } from './model';

/* Réglage des grilles : critères (texte et points), coefficient de chaque partie dans la note finale.
   On travaille sur une copie ; « Enregistrer » l'applique. Retirer un critère retire aussi ses points déjà donnés. */

export function editerGrilles(c: Classeur, apres: () => void): Promise<void> {
  return new Promise(resolve => {
    const copie: Record<PartId, Grille> = structuredClone(c.grilles);
    // Correspondance entre la position d'un critère dans la copie et sa position d'origine (−1 = nouveau).
    const origine: Record<PartId, number[]> = Object.fromEntries(PARTS.map(p => [p, copie[p].criteres.map((_c, i) => i)])) as Record<PartId, number[]>;
    const corps = h('div', { class: 'hp-b pf-grilles' });
    const fermer = () => { veil.remove(); document.removeEventListener('keydown', onKey, true); resolve(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };

    const champ = (v: string | number, label: string, set: (x: string) => void, type = 'text', cls = '') => {
      const i = h('input', { type, value: String(v), 'aria-label': label, class: cls, step: type === 'number' ? '0.5' : undefined, min: type === 'number' ? '0' : undefined }) as HTMLInputElement;
      i.addEventListener(type === 'number' ? 'change' : 'input', () => set(i.value)); // nombres : à la sortie du champ (le total se recalcule)
      i.addEventListener('keydown', e => e.stopPropagation());
      return i;
    };
    const rendre = () => corps.replaceChildren(...PARTS.map(p => {
      const g = copie[p], total = g.criteres.reduce((s, x) => s + x.p, 0);
      return h('section', { class: 'pf-gr' },
        h('div', { class: 'pf-gr-h' }, icon(PART_ICON[p]), h('h3', null, PART_LABEL[p]),
          h('span', { class: 'pf-gr-tot' + (Math.abs(total - 20) > 1e-6 ? ' warn' : '') }, `${String(total).replace('.', ',')} points${Math.abs(total - 20) > 1e-6 ? ' (ramenés sur 20)' : ''}`),
          h('label', { class: 'pf-coef' }, 'Coefficient', champ(g.coef, `Coefficient ${PART_LABEL[p]}`, v => { g.coef = Math.max(0, parseFloat(v.replace(',', '.')) || 0); }, 'number'))),
        ...g.criteres.map((cr, i) => h('div', { class: 'pf-gr-l' },
          champ(cr.t, `Critère ${i + 1}`, v => { cr.t = v; }, 'text', 'pf-gr-t'),
          champ(cr.p, `Points du critère ${i + 1}`, v => { cr.p = Math.max(0, parseFloat(v.replace(',', '.')) || 0); rendre(); }, 'number', 'pf-gr-p'),
          h('button', { class: 'btn btn-ghost btn-icon', type: 'button', title: 'Retirer ce critère', 'aria-label': `Retirer le critère ${i + 1}`, onclick: () => {
            g.criteres.splice(i, 1); origine[p].splice(i, 1); rendre();
          } }, icon('delete')))),
        button('Ajouter un critère', 'add', 'btn-ghost', () => { g.criteres.push({ t: 'Nouveau critère', p: 2 }); origine[p].push(-1); rendre(); }));
    }));

    const veil = h('div', { class: 'modal-veil' }, h('div', { class: 'imd hp wide', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Grilles de notation' },
      h('div', { class: 'imd-h' }, h('h2', null, 'Grilles de notation'), h('button', { class: 'btn btn-ghost btn-icon', type: 'button', title: 'Fermer sans enregistrer', onclick: fermer }, icon('close'))),
      h('p', { class: 'p-help pf-gr-help' }, 'Chaque partie est notée sur 20 (si le total des points n’est pas 20, la note est ramenée sur 20). La note finale est la moyenne des parties, pondérée par les coefficients.'),
      corps,
      h('div', { class: 'imd-f' },
        button('Revenir aux grilles proposées', 'restart_alt', 'btn-ghost', async () => {
          if ((await choose('Revenir aux grilles proposées ?', 'Les critères de cette classe sont remplacés ; les points déjà donnés sont effacés.', [{ label: 'Annuler', value: 'non', cls: 'btn-ghost' }, { label: 'Revenir', value: 'oui', cls: 'btn-danger' }])) !== 'oui') return;
          c.grilles = grillesParDefaut();
          for (const e of Object.values(c.equipes)) e.notes = { modele: [], site: [], maquette: [], oral: [] };
          fermer(); apres(); toast('Grilles proposées rétablies.');
        }),
        button('Annuler', null, 'btn-ghost', fermer),
        button('Enregistrer', 'check', 'btn-primary btn-lg', () => {
          // Les points déjà donnés suivent leur critère (critères retirés : points retirés ; nouveaux : pas notés).
          for (const p of PARTS) {
            const remap = (pts: (number | null)[]) => origine[p].map(o => (o >= 0 ? pts[o] ?? null : null));
            for (const e of Object.values(c.equipes)) e.notes[p] = remap(e.notes[p]);
          }
          c.grilles = copie;
          fermer(); apres(); toast('Grilles enregistrées.');
        }))));
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(veil);
    rendre();
  });
}
