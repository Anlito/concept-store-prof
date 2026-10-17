import { h } from '@cs3d/ui/dom';
import { button } from '@cs3d/ui/components';

/* Photo de la maquette en carton avec la webcam (ou un visualiseur de documents), reprise de l'outil professeur du
   distributeur de céréales. La caméra reste allumée d'une équipe à l'autre (on photographie les maquettes à la suite)
   et s'éteint quand on quitte l'onglet « Maquette carton ». La photo prise est tournée si besoin, puis confiée à
   `garder` (ajout à l'évaluation, copie dans le dossier de l'équipe). */

const CLE_CAMERA = 'csprof-camera';
const etat: { flux: MediaStream | null; cameraId: string; capture: HTMLCanvasElement | null; rotation: number } = {
  flux: null, cameraId: (() => { try { return localStorage.getItem(CLE_CAMERA) ?? ''; } catch { return ''; } })(), capture: null, rotation: 0,
};
/** Carte affichée (redessinée à chaque rendu de l'onglet) : la caméra lui est rebranchée. */
let courante: { afficher(): void; cameras(c: MediaDeviceInfo[]): void } | null = null;
let cameras: MediaDeviceInfo[] = [];

export const cameraDisponible = () => !!navigator.mediaDevices?.getUserMedia;
export function arreterCamera() {
  etat.flux?.getTracks().forEach(p => p.stop());
  etat.flux = null; etat.capture = null; courante = null;
}

/** Photo finale : tournée d'un quart de tour si besoin, réduite à 3000 px au plus. */
function imageFinale(): HTMLCanvasElement {
  const src = etat.capture!, quart = etat.rotation % 180 !== 0;
  const k = Math.min(1, 3000 / Math.max(src.width, src.height));
  const l = Math.round(src.width * k), ht = Math.round(src.height * k);
  const c = document.createElement('canvas');
  c.width = quart ? ht : l; c.height = quart ? l : ht;
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2); g.rotate((etat.rotation * Math.PI) / 180);
  g.drawImage(src, -l / 2, -ht / 2, l, ht);
  return c;
}

/**
 * Carte « Photographier la maquette ». `garder` reçoit de quoi fabriquer la photo (JPEG ; à appeler après avoir
 * demandé les droits d'écriture, qui exigent un clic récent) et renvoie un message de réussite,
 * ou lève une erreur ; `ou` dit où la photo ira (affiché sous l'image).
 */
export function carteCamera(o: { garder: (photo: () => Promise<Blob>) => Promise<string>; ou: string }): HTMLElement {
  const video = h('video', { class: 'cam-video', autoplay: true, playsInline: true, muted: true }) as HTMLVideoElement;
  const apercu = h('canvas', { class: 'cam-apercu' }) as HTMLCanvasElement;
  const eteinte = h('p', { class: 'cam-vide' }, cameraDisponible() ? 'Caméra éteinte' : 'Ce navigateur ne donne pas accès à la caméra : ajoute des photos ci-dessous.');
  const msg = h('p', { class: 'cam-msg', role: 'status' });
  const choix = h('select', { 'aria-label': 'Caméra' }) as HTMLSelectElement;
  const choixL = h('label', { class: 'cam-choix' }, 'Caméra', choix);
  const allumerB = button('Allumer la caméra', 'photo_camera', 'btn-primary', () => void allumer());
  const prendreB = button('Prendre la photo', 'photo_camera', 'btn-primary cam-prendre', () => prendre());
  const garderB = button('Ajouter la photo', 'check', 'btn-primary', () => void garder());
  const direct = h('div', { class: 'cam-actions' }, allumerB, prendreB, choixL);
  const capture = h('div', { class: 'cam-actions' },
    button('Tourner', 'rotate_right', 'btn-secondary', () => { etat.rotation = (etat.rotation + 90) % 360; afficher(); }),
    button('Reprendre', 'refresh', 'btn-ghost', () => { etat.capture = null; afficher(); }),
    garderB);
  const el = h('section', { class: 'cam', 'data-testid': 'camera' },
    h('div', { class: 'cam-ecran' }, video, apercu, eteinte),
    h('div', { class: 'cam-bas' }, direct, capture, h('p', { class: 'p-help' }, o.ou, ' Astuce : maquette bien éclairée, sur un fond uni, qui remplit le cadre.')),
    msg);
  courante = { afficher, cameras: majChoix };
  choix.addEventListener('change', () => void allumer(choix.value));

  const message = (t: string, sorte = '') => { msg.textContent = t; msg.className = 'cam-msg' + (sorte ? ' ' + sorte : ''); };
  function afficher() {
    const cap = !!etat.capture;
    video.hidden = cap || !etat.flux; apercu.hidden = !cap; eteinte.hidden = cap || !!etat.flux;
    direct.hidden = cap; capture.hidden = !cap;
    allumerB.hidden = !!etat.flux || !cameraDisponible(); prendreB.hidden = !etat.flux;
    if (etat.flux && video.srcObject !== etat.flux) video.srcObject = etat.flux;
    if (cap) { const f = imageFinale(); apercu.width = f.width; apercu.height = f.height; apercu.getContext('2d')!.drawImage(f, 0, 0); }
  }
  async function allumer(id = etat.cameraId): Promise<void> {
    etat.flux?.getTracks().forEach(p => p.stop()); etat.flux = null;
    message('');
    const v = { width: { ideal: 3840 }, height: { ideal: 2160 } };
    try {
      etat.flux = await navigator.mediaDevices.getUserMedia({ audio: false, video: id ? { ...v, deviceId: { exact: id } } : v });
    } catch (e) {
      const n = (e as DOMException)?.name;
      if (id && n === 'OverconstrainedError') return allumer(''); // caméra mémorisée débranchée : celle par défaut
      message(n === 'NotAllowedError' ? 'L’accès à la caméra a été refusé (icône de caméra dans la barre d’adresse pour l’autoriser).'
        : n === 'NotFoundError' ? 'Aucune caméra trouvée : branche la webcam, puis réessaie.'
        : 'La caméra n’a pas pu démarrer (déjà utilisée par un autre logiciel ?).', 'erreur');
      afficher();
      return;
    }
    if (!courante) { arreterCamera(); return; } // onglet quitté pendant le démarrage
    etat.cameraId = etat.flux.getVideoTracks()[0]?.getSettings().deviceId ?? '';
    try { localStorage.setItem(CLE_CAMERA, etat.cameraId); } catch { /* rien */ }
    courante.afficher();
    // Les noms des caméras ne sont connus qu'une fois l'accès donné.
    cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    courante?.cameras(cameras);
  }
  function majChoix(cams: MediaDeviceInfo[]) {
    choixL.hidden = cams.length < 2;
    choix.replaceChildren(...cams.map((c, i) => h('option', { value: c.deviceId, selected: c.deviceId === etat.cameraId }, c.label || 'Caméra ' + (i + 1))));
  }
  function prendre() {
    if (!video.videoWidth) { message('La caméra démarre… réessaie dans une seconde.'); return; }
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d')!.drawImage(video, 0, 0);
    etat.capture = c; etat.rotation = 0; message(''); afficher();
  }
  async function garder() {
    garderB.disabled = true;
    try {
      const texte = await o.garder(() => new Promise<Blob>((ok, ko) => imageFinale().toBlob(b => (b ? ok(b) : ko(new Error('image'))), 'image/jpeg', 0.9)));
      etat.capture = null; afficher(); message(texte, 'juste');
    } catch (e) {
      message((e as Error)?.message || 'La photo n’a pas pu être gardée.', 'erreur');
    } finally { garderB.disabled = false; }
  }
  afficher(); majChoix(cameras);
  return el;
}
