import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/* Outil professeur : une classe d'exemple (deux équipes, la 3D et le site fabriqués par les vrais outils élèves),
   ouverte par le champ « dossier » (le sélecteur de Chrome est retiré pour le test). */

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { delete (window as any).showDirectoryPicker; });
});
test.afterEach(() => expect(errors).toEqual([]));

/** Dossier de classe : Lea-Malik (3D + site + plan A3), Ines-Tom (3D seule), dossier de l'outil (ignoré). */
async function fabriquerClasse(page: Page) {
  await page.goto('/');
  const t = await page.evaluate(() => {
    const k = (window as any).csprofTest;
    return { a: k.projet3D('Les Bâtisseurs', 'Léa, Malik'), b: k.projet3D('Les Créateurs', 'Inès, Tom'), site: k.site('Le Comptoir Vert') };
  });
  const root = mkdtempSync(join(tmpdir(), 'csprof-')), classe = join(root, 'CONCEPT STORE');
  for (const d of ['Lea-Malik', 'Ines-Tom', 'Concept-Store-3D']) mkdirSync(join(classe, d), { recursive: true });
  writeFileSync(join(classe, 'Lea-Malik', 'le-comptoir-vert.json'), t.a);
  writeFileSync(join(classe, 'Lea-Malik', 'le-comptoir-vert.vitrine'), t.site);
  writeFileSync(join(classe, 'Lea-Malik', 'Plan-A3-Lea-Malik.pdf'), '%PDF-1.4\n%%EOF\n');
  writeFileSync(join(classe, 'Ines-Tom', 'boutique.json'), t.b);
  writeFileSync(join(classe, 'Concept-Store-3D', 'modele-boutique.json'), JSON.stringify({ ...JSON.parse(t.a), isTemplate: true }));
  return classe;
}
async function ouvrir(page: Page, classe: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('ouvrir-dossier').click();
  await (await chooser).setFiles(classe);
  const dlg = page.getByRole('dialog', { name: 'Quelle classe ?' });
  await expect(dlg).toContainText('2 équipe(s) trouvée(s)');
  await dlg.getByRole('textbox').fill('4B');
  await dlg.getByRole('button', { name: 'Ouvrir' }).click();
  await expect(page.locator('.pf-classe-nom')).toHaveText('Classe 4B');
}
const crit = (page: Page, i: number) => page.getByTestId('grille').locator('.pf-crit').nth(i);

test('ouvrir la classe : équipes, 3D, site, plan A3', async ({ page }) => {
  await ouvrir(page, await fabriquerClasse(page));
  const teams = page.locator('.pf-team');
  await expect(teams).toHaveCount(2); // le dossier de l'outil (projet modèle) n'est pas une équipe
  await expect(teams.nth(0)).toContainText('Ines-Tom');
  await expect(teams.nth(1)).toContainText('Léa, Malik'); // élèves lus dans le cartouche
  await teams.nth(1).click();
  await expect(page.locator('.pf-infos')).toContainText('70 m²');
  await expect(page.locator('.pf-infos')).toContainText('1 PDF');
  await expect(page.locator('.vw canvas')).toBeVisible();
  // Site : fabriqué avec le code de Vitrine, affiché dans le cadre
  await page.getByRole('tab', { name: 'Site internet' }).click();
  await expect(page.locator('.site-tab').first()).toBeVisible();
  await expect(page.frameLocator('.site-frame').locator('body')).toContainText('Le Comptoir Vert');
  await expect(page.getByTestId('grille')).toContainText('Contrôles automatiques de Vitrine');
  // Équipe sans site : message clair
  await teams.nth(0).click();
  await expect(page.locator('.pf-vide')).toContainText('Pas de site (.vitrine)');
});

test('noter les quatre parties, bilan, export, notes gardées', async ({ page }) => {
  await ouvrir(page, await fabriquerClasse(page));
  await page.locator('.pf-team', { hasText: 'Lea-Malik' }).click();
  // 3D : tous les critères au maximum → 20
  const n3d = await page.getByTestId('grille').locator('.pf-crit').count();
  for (let i = 0; i < n3d; i++) await crit(page, i).locator('.pf-pt').last().click();
  await expect(page.getByTestId('note')).toHaveText('20 / 20');
  // Un second clic efface la note du critère
  await crit(page, 0).locator('.pf-pt').last().click();
  await expect(page.getByTestId('note')).toHaveText('17 / 20'); // 17 points sur 20
  // Maquette : un seul critère noté (5/5) → les autres comptent 0 : 5/20
  await page.getByRole('tab', { name: 'Maquette carton' }).click();
  await crit(page, 0).locator('.pf-pt').last().click();
  await expect(page.getByTestId('note')).toHaveText('5 / 20');
  // Photo de la maquette
  const ch = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Ajouter des photos/ }).click();
  await (await ch).setFiles(resolve('tests/affiche.jpg'));
  await expect(page.getByTestId('photos').locator('img')).toHaveCount(1);
  // Oral : Léa 20, Malik 10
  await page.getByRole('tab', { name: 'Oral' }).click();
  const noterOral = async (frac: 'last' | 'middle') => {
    const n = await page.getByTestId('grille').locator('.pf-crit').count();
    for (let i = 0; i < n; i++) { const b = crit(page, i).locator('.pf-pt'); await (frac === 'last' ? b.last() : b.nth(2)).click(); }
  };
  await noterOral('last');
  await expect(page.getByTestId('grille')).toContainText('Oral · Léa');
  await page.locator('.pf-card', { hasText: 'Malik' }).click();
  await noterOral('middle');
  await expect(page.getByTestId('note')).toHaveText('10 / 20');
  // Bilan : moyenne des parties notées (3D 17, maquette 5, oral) — le site n'est pas noté
  await page.getByRole('tab', { name: 'Bilan' }).click();
  const bilan = page.getByTestId('bilan');
  await expect(bilan.locator('tr', { hasText: 'Léa' })).toContainText('14'); // (17 + 5 + 20) / 3
  await expect(bilan.locator('tr', { hasText: 'Malik' })).toContainText('10,7'); // (17 + 5 + 10) / 3
  // Ajustement individuel
  await bilan.getByLabel('Ajustement de Malik').fill('1'); await bilan.getByLabel('Ajustement de Malik').press('Tab');
  await expect(page.getByTestId('bilan').locator('tr', { hasText: 'Malik' }).locator('.pf-fin')).toHaveText('11,7');
  // Export CSV (Excel)
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter (Excel)' }).click();
  const csv = readFileSync(await (await dl).path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xFEFF);
  expect(csv).toContain('Classe;Équipe;Élève;Modélisation 3D /20;Site internet /20;Maquette carton /20;Oral /20;Ajustement;Note finale /20');
  expect(csv).toContain('4B;Lea-Malik;Malik;17;;5;10;1;11,7');
  // Les notes restent sur l'ordinateur : retour à l'accueil, « Voir les notes »
  await page.locator('.tb-logo').click();
  await page.getByRole('button', { name: 'Voir les notes' }).click();
  await page.locator('.pf-team', { hasText: 'Lea-Malik' }).click();
  await page.getByRole('tab', { name: 'Bilan' }).click();
  await expect(page.getByTestId('bilan').locator('tr', { hasText: 'Malik' }).locator('.pf-fin')).toHaveText('11,7');
  await page.getByRole('tab', { name: 'Maquette carton' }).click();
  await expect(page.getByTestId('photos').locator('img')).toHaveCount(1);
});

test('grilles : coefficient, critère retiré, sauvegarde et import', async ({ page }) => {
  await ouvrir(page, await fabriquerClasse(page));
  await page.locator('.pf-team', { hasText: 'Ines-Tom' }).click();
  // 3D : critère 1 (3 pts) et critère 2 (3 pts) au maximum → 6/20 = 6
  await crit(page, 0).locator('.pf-pt').last().click();
  await crit(page, 1).locator('.pf-pt').last().click();
  await expect(page.getByTestId('note')).toHaveText('6 / 20');
  // Retirer le premier critère : il reste 3 pts sur 17 → 3,5 ; coefficient 3D à 2
  await page.getByRole('button', { name: 'Grilles' }).click();
  const g = page.getByRole('dialog', { name: 'Grilles de notation' });
  await g.getByRole('button', { name: 'Retirer le critère 1' }).first().click();
  await g.getByLabel('Coefficient Modélisation 3D').fill('2'); await g.getByLabel('Coefficient Modélisation 3D').press('Tab');
  await g.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByTestId('note')).toHaveText('3,5 / 20');
  // Sauvegarde (.csprof), puis import sur un « autre ordinateur » (base vidée)
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sauvegarder' }).click();
  const fichier = await (await dl).path();
  const data = JSON.parse(readFileSync(fichier, 'utf8'));
  expect(data.grilles.modele.coef).toBe(2);
  expect(data.equipes['Ines-Tom'].notes.modele.slice(0, 1)).toEqual([3]);
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('concept-store-prof'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }));
  await page.reload();
  const ch = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Importer une sauvegarde/ }).click();
  await (await ch).setFiles(fichier);
  await expect(page.locator('.pf-classe')).toContainText('4B');
});
