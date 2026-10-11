import { estClasseur, type Classeur } from './model';

/* Stockage dans le navigateur du professeur (IndexedDB) : les classeurs d'évaluation, et le dossier de chaque classe
   (pour le rouvrir sans le rechercher). Rien n'est envoyé sur Internet. */

const DB = 'concept-store-prof', VERSION = 1;
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  dbp ??= new Promise((ok, ko) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('classeurs')) d.createObjectStore('classeurs', { keyPath: 'classe' });
      if (!d.objectStoreNames.contains('dossiers')) d.createObjectStore('dossiers');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return dbp;
}
async function tx<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((ok, ko) => { const r = f(d.transaction(store, mode).objectStore(store)); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}

export const listeClasseurs = async () => ((await tx<Classeur[]>('classeurs', 'readonly', s => s.getAll())) ?? []).filter(estClasseur).sort((a, b) => b.maj - a.maj);
export const lireClasseur = (classe: string) => tx<Classeur | undefined>('classeurs', 'readonly', s => s.get(classe));
export const ecrireClasseur = (c: Classeur) => tx('classeurs', 'readwrite', s => s.put({ ...c, maj: Date.now() }));
export const supprimerClasseur = (classe: string) => tx('classeurs', 'readwrite', s => s.delete(classe));

/** Dossier de la classe (poignée Chrome / Edge), pour le rouvrir à la séance suivante. */
export const memoriserDossier = (classe: string, h: FileSystemDirectoryHandle) => tx('dossiers', 'readwrite', s => s.put(h, classe));
export const dossierMemorise = (classe: string) => tx<FileSystemDirectoryHandle | undefined>('dossiers', 'readonly', s => s.get(classe));
