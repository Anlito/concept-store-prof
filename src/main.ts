import '@cs3d/ui/base.css';
import '@cs3d/app/app.css';
import './prof.css';
import { accueil } from './accueil';
import { sampleProject } from '@cs3d/model/project';
import { nouveauProjet } from '@vitrine/model';

/* Concept Store · Professeur : ouvre le dossier d'une classe, montre la 3D et le site de chaque équipe,
   et garde les notes (3D, site, maquette carton, oral) et les photos des maquettes sur l'ordinateur du professeur. */
(async () => {
  try { await Promise.all([600, 700, 800].map(w => document.fonts.load(`${w} 16px Nunito`))); } catch { /* police de secours */ }
  accueil();
})();

/* Pour les tests automatisés : fabriquer de vrais fichiers d'équipe avec le code des deux outils élèves. */
(window as unknown as { csprofTest: unknown }).csprofTest = {
  projet3D: (equipe: string, membres: string) => { const p = sampleProject(); p.team = { name: equipe, members: membres, klass: '4B' }; return JSON.stringify({ ...p, savedAt: new Date().toISOString() }); },
  site: (nom: string) => JSON.stringify(nouveauProjet(nom)),
};
