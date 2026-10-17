import { test, expect } from '@playwright/test';

/* Maquette carton : photo prise avec la webcam (fausse caméra de Chrome), ajoutée à l'évaluation et rangée en .jpg
   dans le dossier de l'équipe. Le dossier de la classe est un vrai dossier du navigateur (stockage privé),
   rendu par un faux sélecteur de dossier. */

test.use({
  launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

let errors: string[];
test.beforeEach(({ page }) => { errors = []; page.on('pageerror', e => errors.push(e.message)); });
test.afterEach(() => expect(errors).toEqual([]));

test('photographier la maquette à la webcam : évaluation et dossier de l’équipe', async ({ page }) => {
  await page.goto('/');
  // Dossier de la classe : CONCEPT STORE › Lea_Malik › boutique.json
  await page.evaluate(async () => {
    const k = (window as any).csprofTest;
    const opfs = await navigator.storage.getDirectory();
    const classe = await opfs.getDirectoryHandle('CONCEPT STORE', { create: true });
    const eq = await classe.getDirectoryHandle('Lea_Malik', { create: true });
    const w = await (await eq.getFileHandle('boutique.json', { create: true })).createWritable();
    await w.write(k.projet3D('Les Bâtisseurs', 'Léa, Malik')); await w.close();
    (window as any).showDirectoryPicker = async () => classe;
  });
  await page.getByTestId('ouvrir-dossier').click();
  const dlg = page.getByRole('dialog', { name: 'Quelle classe ?' });
  await dlg.getByRole('textbox').fill('4B');
  await dlg.getByRole('button', { name: 'Ouvrir' }).click();
  await page.getByRole('tab', { name: 'Maquette carton' }).click();

  const cam = page.getByTestId('camera');
  await expect(cam).toContainText('rangée dans le dossier de l’équipe (Lea_Malik)');
  await cam.getByRole('button', { name: 'Allumer la caméra' }).click();
  await expect.poll(() => page.locator('.cam-video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await cam.getByRole('button', { name: 'Prendre la photo' }).click();
  await expect(page.locator('.cam-apercu')).toBeVisible();
  // Tourner d'un quart de tour : l'image passe en portrait
  const { width, height } = await page.locator('.cam-apercu').evaluate((c: HTMLCanvasElement) => ({ width: c.width, height: c.height }));
  await cam.getByRole('button', { name: 'Tourner' }).click();
  expect(await page.locator('.cam-apercu').evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([height, width]);
  await cam.getByRole('button', { name: 'Ajouter la photo' }).click();
  await expect(cam).toContainText('Photo ajoutée à l’évaluation et enregistrée dans le dossier Lea_Malik : Maquette_Lea_Malik_');
  await expect(page.getByTestId('photos').locator('img')).toHaveCount(1);
  await expect(page.locator('.pf-team.on .pf-chip.ok')).toHaveCount(2); // 3D + photo de la maquette
  // La caméra reste allumée, prête pour la photo suivante
  await expect(cam.getByRole('button', { name: 'Prendre la photo' })).toBeVisible();
  // Le fichier est dans le dossier de l'équipe
  const noms = await page.evaluate(async () => {
    const eq = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('CONCEPT STORE')).getDirectoryHandle('Lea_Malik');
    const out: { nom: string; taille: number }[] = [];
    for await (const [nom, h] of (eq as any).entries()) if (h.kind === 'file') out.push({ nom, taille: (await h.getFile()).size });
    return out;
  });
  const photo = noms.find(n => n.nom.startsWith('Maquette_Lea_Malik_') && n.nom.endsWith('.jpg'));
  expect(photo?.taille).toBeGreaterThan(1000);
  // Autre onglet : la caméra s'éteint
  await page.getByRole('tab', { name: 'Oral' }).click();
  await page.getByRole('tab', { name: 'Maquette carton' }).click();
  await expect(page.getByTestId('camera').getByRole('button', { name: 'Allumer la caméra' })).toBeVisible();
});
