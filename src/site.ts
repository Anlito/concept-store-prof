import { h, icon } from '@cs3d/ui/dom';
import { fabriquerSite } from '@vitrine/lib/export';
import { fichiersPages, pagesActives, type Projet } from '@vitrine/model';

/* Site d'une équipe, fabriqué avec le code de Vitrine (exactement ce que donne « Exporter mon site »)
   et affiché page par page dans un cadre. Les liens du menu changent de page dans le cadre. */

const TYPES: Record<string, string> = { css: 'text/css', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
const decode = (u: Uint8Array) => new TextDecoder().decode(u);

export class SiteViewer {
  readonly el: HTMLElement;
  private frame: HTMLIFrameElement;
  private nav: HTMLElement;
  private urls: string[] = [];
  private pages: Record<string, string> = {}; // fichier → HTML réécrit
  private ordre: { id: string; nom: string; fichier: string }[] = [];
  private courant = '';
  private jeton = 0;

  constructor() {
    this.frame = h('iframe', { class: 'site-frame', title: 'Site de l’équipe', sandbox: 'allow-same-origin' }) as HTMLIFrameElement;
    this.nav = h('div', { class: 'site-nav', role: 'tablist', 'aria-label': 'Pages du site' });
    this.el = h('div', { class: 'site-view' }, this.nav, h('div', { class: 'site-box' }, this.frame));
    this.frame.addEventListener('load', () => {
      // Les liens entre pages restent dans le cadre.
      this.frame.contentDocument?.addEventListener('click', e => {
        const a = (e.target as Element).closest('a'); if (!a) return;
        const f = (a.getAttribute('href') ?? '').split('#')[0];
        e.preventDefault();
        if (this.pages[f]) this.montrer(f);
      });
    });
  }

  async afficher(p: Projet) {
    const j = ++this.jeton;
    this.vider();
    this.nav.replaceChildren(h('span', { class: 'site-wait' }, icon('progress_activity'), 'Fabrication du site…'));
    const fichiers = await fabriquerSite(p);
    if (j !== this.jeton) return; // une autre équipe a été choisie entre-temps
    const blob: Record<string, string> = {};
    for (const [chemin, octets] of Object.entries(fichiers)) {
      if (chemin.endsWith('.html') || chemin === 'style.css') continue;
      const ext = chemin.split('.').pop()!.toLowerCase();
      blob[chemin] = URL.createObjectURL(new Blob([octets as BlobPart], { type: TYPES[ext] ?? 'application/octet-stream' }));
    }
    // Feuille de style : polices et images remplacées par leurs adresses locales.
    let css = decode(fichiers['style.css'] ?? new Uint8Array());
    css = css.replace(/url\("?([^")]+)"?\)/g, (m, u) => (blob[u] ? `url("${blob[u]}")` : m));
    const cssUrl = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
    this.urls = [...Object.values(blob), cssUrl];
    const fp = fichiersPages(p);
    this.ordre = pagesActives(p).map(pg => ({ id: pg.id, nom: pg.nom, fichier: fp[pg.id] }));
    this.pages = {};
    for (const { fichier } of this.ordre) {
      const html = decode(fichiers[fichier] ?? new Uint8Array())
        .replace('href="style.css"', `href="${cssUrl}"`)
        .replace(/(src|href)="([^"]+)"/g, (m, attr, u) => (blob[u] ? `${attr}="${blob[u]}"` : m));
      this.pages[fichier] = html;
    }
    this.montrer(this.ordre[0]?.fichier ?? '');
  }

  private montrer(fichier: string) {
    this.courant = fichier;
    this.frame.srcdoc = this.pages[fichier] ?? '<p style="font-family:sans-serif;padding:2em">Page vide.</p>';
    this.nav.replaceChildren(...this.ordre.map(pg => h('button', {
      type: 'button', role: 'tab', class: 'site-tab' + (pg.fichier === this.courant ? ' on' : ''), 'aria-selected': String(pg.fichier === this.courant),
      onclick: () => this.montrer(pg.fichier),
    }, pg.nom)));
  }

  vider() {
    this.urls.forEach(u => URL.revokeObjectURL(u)); this.urls = [];
    this.pages = {}; this.ordre = [];
    this.frame.srcdoc = '';
  }
}
