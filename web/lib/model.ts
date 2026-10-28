import template from "./analysis-template.json";
import { DEFAULT_PROMPT } from "./defaults";
export type Video = {
  id: string;
  title: string;
  channel: string;
  views: number;
  comments: number;
  url: string;
};
export type RecordRow = {
  id_video: string;
  video: string;
  canal_video: string;
  url_video: string;
  origem: string;
  id_comentario: string;
  id_canal_autor: string;
  autor: string;
  publicado_em: string;
  curtidas: number;
  comentario: string;
  incluido_no_txt: boolean;
  coleta_id: string;
  coletado_em_utc: string;
  buscas: string;
};
export type Settings = {
  terms: string[];
  links: string[];
  onlyLinks: boolean;
  pages: number;
  videos: number;
  perVideo: number;
  maxText: number;
  days: number;
  minimum: number;
  letters: number;
  order: string;
  painOnly: boolean;
  keywords: string[];
  prompt?: string;
  includePrompt?: boolean;
};
export type Job = {
  id: string;
  created: string;
  settings: Settings;
  phase: "search" | "details" | "comments" | "done";
  term: number;
  page: number;
  token: string;
  ids: string[];
  buckets: string[][];
  details: number;
  candidates: Video[];
  selected: Video[];
  video: number;
  rows: RecordRow[];
  warnings: string[];
};
export function parseLinks(text: string) {
  const ids = [];
  for (const line of text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)) {
    let id = line;
    if (!/^[-\w]{11}$/.test(id)) {
      let url: URL;
      try {
        url = new URL(line);
      } catch {
        throw new Error("Cole links completos do YouTube, um por linha.");
      }
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("Link inválido.");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["youtu.be", "www.youtu.be"].includes(url.hostname)) id = parts[0];
      else if (
        [
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "music.youtube.com",
        ].includes(url.hostname)
      )
        id =
          url.searchParams.get("v") ??
          (["shorts", "live", "embed"].includes(parts[0]) ? parts[1] : "");
      else throw new Error("Use links do YouTube.");
    }
    if (!/^[-\w]{11}$/.test(id ?? ""))
      throw new Error("Um dos links não identifica um vídeo.");
    ids.push(id);
  }
  const unique = [...new Set(ids)];
  if (unique.length > 50) throw new Error("Use no máximo 50 links.");
  return unique;
}
export function newJob(settings: Settings): Job {
  return {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    settings,
    phase: settings.onlyLinks ? "details" : "search",
    term: 0,
    page: 0,
    token: "",
    ids: [...settings.links],
    buckets: settings.terms.map(() => []),
    details: 0,
    candidates: [],
    selected: [],
    video: 0,
    rows: [],
    warnings: [],
  };
}
export function selectVideos(job: Job) {
  const fixed = job.candidates.filter((v) => job.settings.links.includes(v.id));
  let rest = job.candidates.filter(
    (v) =>
      !job.settings.links.includes(v.id) && v.comments >= job.settings.minimum,
  );
  if (job.settings.order === "viewCount")
    rest = rest.sort((a, b) => b.views - a.views);
  else {
    // Search rounds are interleaved by rank across terms before details are fetched.
    const order = new Map(job.ids.map((id, i) => [id, i]));
    rest.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  return [
    ...fixed,
    ...rest.slice(0, Math.max(0, job.settings.videos - fixed.length)),
  ];
}
const normalize = (text: string) =>
  text.toLocaleLowerCase().replace(/[^\p{L}\p{N}_]/gu, "");
export function filteredRows(job: Job) {
  const seen = new Set<string>();
  const selected: RecordRow[] = [];
  const per = Math.floor(
    job.settings.maxText / Math.max(1, job.selected.length),
  );
  const extra = job.settings.maxText % Math.max(1, job.selected.length);
  job.selected.forEach((video, index) => {
    const candidates = job.rows
      .filter((r) => r.id_video === video.id)
      .filter((r) => {
        const text = r.comentario;
        const letters = text.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0;
        if (
          letters < job.settings.letters ||
          /https?:\/\/|www\.|whatsapp|telegram|chama no zap|inscreva-se|sorteio/i.test(
            text,
          )
        )
          return false;
        if (
          letters < 45 &&
          /^(top+|show|parab[eé]ns|muito bom|[oó]timo v[ií]deo|excelente|obrigad[oa]|valeu|boa|gostei|amei|perfeito|sensacional|nota 10)\b/i.test(
            text,
          ) &&
          !text.includes("?")
        )
          return false;
        return (
          !job.settings.painOnly ||
          job.settings.keywords.some((k) => text.toLowerCase().includes(k))
        );
      })
      .sort((a, b) => score(b) - score(a));
    let added = 0;
    for (const row of candidates) {
      const key = normalize(row.comentario);
      if (seen.has(key)) continue;
      if (added >= per + (index < extra ? 1 : 0)) break;
      seen.add(key);
      selected.push(row);
      added++;
    }
  });
  function score(row: RecordRow) {
    return (
      row.curtidas +
      (row.comentario.includes("?") ? 5 : 0) +
      (job.settings.painOnly &&
      job.settings.keywords.some((k) =>
        row.comentario.toLowerCase().includes(k),
      )
        ? 10
        : 0)
    );
  }
  return selected;
}
export function researchPrompt(job: Job) {
  return (job.settings.prompt ?? DEFAULT_PROMPT).replaceAll(
    "{assunto}",
    job.settings.terms.join(", ") || "Vídeos informados por link",
  );
}
export function textFile(job: Job) {
  const header =
    job.settings.includePrompt !== false ? researchPrompt(job) + "\n\n" : "";
  return (
    header +
    filteredRows(job)
      .map(
        (r) =>
          `=== ${r.video} ===\n- (${r.curtidas} likes) ${r.comentario.replace(/\s+/g, " ")}`,
      )
      .join("\n\n")
  );
}
export function analysisFile(job: Job) {
  const selected = new Set(filteredRows(job));
  return {
    ...template,
    coleta: {
      situacao: job.phase === "done" ? "concluida" : "parcial",
      videos_previstos: job.selected.length,
      videos_finalizados: job.video,
      avisos: job.warnings,
    },
    orientacao_da_pesquisa: researchPrompt(job),
    total_registros: job.rows.length,
    comentarios: job.rows.map((row) => ({
      ...row,
      incluido_no_txt: selected.has(row),
    })),
  };
}
export function csvFile(job: Job) {
  const rows = analysisFile(job).comentarios;
  if (!rows.length) return "\uFEFF";
  const fields = Object.keys(rows[0]) as (keyof RecordRow)[];
  const escape = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]|^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      fields.join(","),
      ...rows.map((r) => fields.map((k) => escape(r[k])).join(",")),
    ].join("\r\n")
  );
}
