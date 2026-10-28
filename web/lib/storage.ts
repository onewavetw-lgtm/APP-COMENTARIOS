import type { Job } from "./model";
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("lowwave-web", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("research");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("Não foi possível abrir o progresso local."));
  });
}
export async function saveJob(job: Job | null) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("research", "readwrite");
      const store = tx.objectStore("research");
      if (job) store.put(job, "current");
      else store.delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error(
            "Não foi possível salvar o progresso. Exporte o parcial antes de fechar a página.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function loadJob() {
  const db = await database();
  try {
    return await new Promise<Job | null>((resolve, reject) => {
      const req = db
        .transaction("research")
        .objectStore("research")
        .get("current");
      req.onsuccess = () => {
        const j = req.result;
        if (
          j &&
          (!j.settings || !Array.isArray(j.rows) || !Array.isArray(j.ids))
        )
          reject(new Error("Progresso salvo inválido."));
        else resolve(j ?? null);
      };
      req.onerror = () =>
        reject(new Error("Não foi possível carregar o progresso."));
    });
  } finally {
    db.close();
  }
}
