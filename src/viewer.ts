import { h, icon } from '@cs3d/ui/dom';
import { segmented, toggle } from '@cs3d/ui/components';
import { Store } from '@cs3d/model/store';
import { newProject } from '@cs3d/model/project';
import type { Project } from '@cs3d/model/types';
import { UIStore, defaultUI, type Ctx } from '@cs3d/app/state';
import { emptyFileState } from '@cs3d/app/files';
import { View3D } from '@cs3d/view3d/view3d';
import { Plan2D } from '@cs3d/view2d/plan';
import { setCreations } from '@cs3d/library/library';

/* Visite de la boutique d'une équipe avec la vue 3D et le plan de Concept Store 3D.
   Lecture seule : le projet est chargé en mémoire, rien n'est jamais réécrit dans le fichier de l'équipe. */

export class Viewer {
  readonly el: HTMLElement;
  private ctx: Ctx;
  private view3d: View3D;
  private plan: Plan2D;
  private actif = false;

  constructor() {
    const store = new Store(newProject());
    const ui = new UIStore({ ...defaultUI(), view: '3d', tool: 'revetement', shadows: 'low' });
    this.ctx = { store, ui, file: emptyFileState(), home() {}, exportPlan() {}, openAtelier() {}, showImage: id => this.view3d.lookAtImage(id) };
    this.view3d = new View3D(this.ctx);
    this.plan = new Plan2D(this.ctx);
    const vue = segmented<'3d' | '2d'>([{ value: '3d', label: '3D', icon: 'view_in_ar' }, { value: '2d', label: 'Plan', icon: 'grid_on' }], () => ui.s.view, v => ui.set({ view: v }));
    const cut = toggle('Murs abaissés', 'vertical_align_bottom', () => ui.s.cutaway, v => ui.set({ cutaway: v }));
    const facade = h('button', { class: 'tg', type: 'button', title: 'La boutique vue de la rue', onclick: () => { ui.set({ view: '3d', sel: null }); this.view3d.facade(); } }, icon('storefront'), 'Façade');
    const recentrer = h('button', { class: 'tg', type: 'button', title: 'Toute la boutique dans l’écran', onclick: () => (ui.s.view === '3d' ? this.view3d.frame() : this.plan.fit()) }, icon('center_focus_strong'), 'Recentrer');
    const barre = h('div', { class: 'fbar vw-bar' }, vue.el, cut.el, facade, recentrer);
    const vp = h('div', { class: 'vp vw-vp' }, this.view3d.el, this.plan.el);
    this.el = h('div', { class: 'vw' }, barre, vp);
    const refresh = () => {
      vue.refresh(); cut.refresh();
      const d3 = ui.s.view === '3d';
      this.view3d.el.style.display = d3 ? '' : 'none'; this.plan.el.style.display = d3 ? 'none' : '';
      this.view3d.setActive(d3 && this.actif); this.plan.setActive(!d3 && this.actif);
      cut.el.style.display = facade.style.display = d3 ? '' : 'none';
    };
    ui.subscribe(refresh);
    this.refresh = refresh;
    refresh();
  }
  private refresh: () => void;

  /** À appeler quand l'onglet 3D est affiché ou caché (la vue ne calcule rien quand elle est cachée). */
  activer(on: boolean) { this.actif = on; this.refresh(); }

  /** Charge le projet d'une équipe (ses créations de l'atelier comprises) et recadre la vue. */
  afficher(doc: Project) {
    setCreations(doc.creations ?? [], []);
    this.ctx.ui.set({ sel: null, view: '3d' });
    this.ctx.store.load(structuredClone(doc), 0);
    requestAnimationFrame(() => { this.view3d.frame(); this.plan.fit(); });
  }
}
