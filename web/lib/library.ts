import type { Job } from "./model";
import { analysisFile } from "./model";
export type Comment = Record<string, unknown> & { comentario: string };
export type Source = Record<string, unknown> & { comentarios: Comment[] };
export const statuses = [
  "Coletando",
  "Coletada",
  "Analisada",
  "Enviada ao mentor",
  "Arquivada",
] as const;
export type Research = {
  id: string;
  fingerprint: string;
  name: string;
  added: string;
  status: (typeof statuses)[number];
  source: Source;
  notes: string;
  evidence: Record<string, { note: string; favorite: boolean }>;
  report: string;
};
export function validateSource(value: unknown): Source {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("JSON inválido. Escolha uma exportação do LowWave.");
  const data = value as Record<string, unknown>;
  if (
    data.formato !== "lowwave-analise-v1" ||
    !Array.isArray(data.comentarios) ||
    data.comentarios.length > 100000 ||
    !data.comentarios.every(
      (r) =>
        r &&
        typeof r === "object" &&
        !Array.isArray(r) &&
        typeof r.comentario === "string",
    )
  )
    throw new Error(
      "O arquivo não é uma exportação compatível do LowWave. Nenhum dado foi importado.",
    );
  return data as Source;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonical((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function fingerprint(source: Source) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(source)),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function importedResearch(
  value: unknown,
  name: string,
): Promise<Research> {
  const source = validateSource(value);
  const hash = await fingerprint(source);
  return {
    id: "import:" + hash,
    fingerprint: hash,
    name: name.trim() || "Pesquisa importada",
    added: new Date().toISOString(),
    status: "Coletada",
    source,
    notes: "",
    evidence: {},
    report: "",
  };
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("lowwave-library", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("items", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("Não foi possível abrir a biblioteca neste navegador."));
  });
}
export async function listResearch(): Promise<Research[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("items").objectStore("items").getAll();
      r.onsuccess = () =>
        resolve(
          (r.result as Research[]).sort((a, b) =>
            b.added.localeCompare(a.added),
          ),
        );
      r.onerror = () => reject(new Error("Falha ao ler a biblioteca."));
    });
  } finally {
    db.close();
  }
}
// Read/modify/write in one transaction: updating collection never replaces user annotations.
export async function storeResearch(
  items: Research[],
  mode: "merge" | "metadata" | "snapshot" = "merge",
) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite"),
        store = tx.objectStore("items");
      for (const item of items) {
        const req = store.get(item.id);
        req.onsuccess = () => {
          const old = req.result as Research | undefined;
          if (!old) store.put(item);
          else if (mode === "metadata")
            store.put({
              ...old,
              name: item.name,
              status: item.status,
              notes: item.notes,
              evidence: item.evidence,
              report: item.report,
            });
          else if (mode === "snapshot")
            store.put({
              ...old,
              source: item.source,
              fingerprint: item.fingerprint,
              status: old.status === "Coletando" ? item.status : old.status,
            });
        };
      }
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "Não foi possível salvar. Baixe um backup antes de fechar.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function archiveJob(job: Job) {
  if (!job.rows.length) return;
  const item = await importedResearch(
    analysisFile(job),
    job.settings.terms.join(" · ") || "Vídeos por link",
  );
  item.id = "job:" + job.id;
  item.added = job.created;
  item.status = job.phase === "done" ? "Coletada" : "Coletando";
  await storeResearch([item], "snapshot");
  localStorage.setItem("lowwave-library-migrated:" + job.id, "1");
}
export async function archiveLegacyJob(job: Job) {
  if (!localStorage.getItem("lowwave-library-migrated:" + job.id))
    await archiveJob(job);
}
export async function deleteResearch(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("items", "readwrite");
      tx.objectStore("items").delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(new Error("Não foi possível excluir a pesquisa."));
    });
  } finally {
    db.close();
  }
}
export async function readBackup(value: unknown): Promise<Research[]> {
  const b = value as { formato?: string; pesquisas?: unknown[] };
  if (
    !b ||
    b.formato !== "lowwave-biblioteca-v1" ||
    !Array.isArray(b.pesquisas)
  )
    throw new Error("Backup inválido.");
  const items: Research[] = [];
  for (const v of b.pesquisas) {
    const r = v as Research;
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^(job:|import:)/.test(r.id) ||
      typeof r.name !== "string" ||
      typeof r.added !== "string" ||
      !statuses.includes(r.status) ||
      typeof r.notes !== "string" ||
      typeof r.report !== "string" ||
      !r.evidence ||
      typeof r.evidence !== "object" ||
      Array.isArray(r.evidence) ||
      !Object.entries(r.evidence).every(
        ([k, e]) =>
          /^\d+$/.test(k) &&
          e &&
          typeof e.note === "string" &&
          typeof e.favorite === "boolean",
      )
    )
      throw new Error("O backup contém uma pesquisa inválida.");
    validateSource(r.source);
    if ((await fingerprint(r.source)) !== r.fingerprint)
      throw new Error("A conferência dos dados originais do backup falhou.");
    items.push(r);
  }
  if (new Set(items.map((r) => r.id)).size !== items.length)
    throw new Error("O backup contém códigos de pesquisa repetidos.");
  return items;
}
export function sourceLink(row: Comment) {
  if (typeof row.id_video === "string" && /^[-\w]{11}$/.test(row.id_video))
    return "https://www.youtube.com/watch?v=" + row.id_video;
  try {
    const url = new URL(String(row.url_video));
    if (
      url.protocol === "https:" &&
      ["www.youtube.com", "youtube.com", "youtu.be"].includes(url.hostname)
    )
      return url.href;
  } catch {}
  return null;
}
export function phrases(rows: Comment[]) {
  const groups = new Map<
    string,
    { phrase: string; count: number; videos: Set<string>; examples: number[] }
  >();
  const stop = new Set(
    "a o as os de da do das dos e em um uma para por com no na nos nas que eu é se meu minha seu sua muito mais".split(
      " ",
    ),
  );
  rows.forEach((row, index) => {
    const words =
      row.comentario.toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]+/gu) ?? [];
    const seen = new Set<string>();
    for (let n = 2; n <= 4; n++)
      for (let i = 0; i <= words.length - n; i++) {
        const part = words.slice(i, i + n);
        if (part.every((w) => stop.has(w))) continue;
        const phrase = part.join(" ");
        if (seen.has(phrase)) continue;
        seen.add(phrase);
        const g = groups.get(phrase) ?? {
          phrase,
          count: 0,
          videos: new Set<string>(),
          examples: [],
        };
        g.count++;
        if (row.id_video) g.videos.add(String(row.id_video));
        if (g.examples.length < 5) g.examples.push(index);
        groups.set(phrase, g);
      }
  });
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.phrase.length - a.phrase.length)
    .slice(0, 40)
    .map((g) => ({ ...g, videos: g.videos.size }));
}
