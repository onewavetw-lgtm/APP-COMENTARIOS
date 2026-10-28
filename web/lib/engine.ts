import { Job, Video, RecordRow, selectVideos } from "./model";
export type YouTubeData = { items: YTItem[]; nextPageToken?: string };
type YTItem = {
  id: string | { videoId: string };
  snippet: {
    title?: string;
    channelTitle?: string;
    topLevelComment?: {
      id: string;
      snippet: {
        textDisplay: string;
        likeCount?: number;
        authorDisplayName?: string;
        authorChannelId?: { value?: string };
        publishedAt?: string;
      };
    };
  };
  statistics?: { viewCount?: string; commentCount?: string };
};
export type Api = (params: Record<string, unknown>) => Promise<YouTubeData>;
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export async function advance(job: Job, api: Api): Promise<Job> {
  const next = structuredClone(job);
  const s = next.settings;
  if (next.phase === "search") {
    const data = await api({
      action: "search",
      q: s.terms[next.term],
      order: s.order,
      days: s.days,
      pageToken: next.token,
    });
    for (const item of data.items) {
      const id = typeof item.id === "object" ? item.id.videoId : item.id;
      if (!next.buckets[next.term].includes(id))
        next.buckets[next.term].push(id);
    }
    if (data.nextPageToken && data.nextPageToken === next.token)
      throw new Error(
        "A API repetiu a página. Exporte o parcial antes de iniciar outra pesquisa.",
      );
    if (data.nextPageToken && next.page + 1 < s.pages) {
      next.token = data.nextPageToken;
      next.page++;
    } else {
      next.term++;
      next.page = 0;
      next.token = "";
      if (next.term >= s.terms.length) {
        next.ids = [
          ...new Set([
            ...s.links,
            ...Array.from(
              { length: Math.max(0, ...next.buckets.map((b) => b.length)) },
              (_, i) => next.buckets.flatMap((b) => (b[i] ? [b[i]] : [])),
            ).flat(),
          ]),
        ];
        next.phase = "details";
      }
    }
  } else if (next.phase === "details") {
    const ids = next.ids.slice(next.details, next.details + 50);
    if (ids.length) {
      const data = await api({ action: "videos", ids: ids.join(",") });
      for (const item of data.items) {
        const id = item.id as string;
        next.candidates.push({
          id,
          title: item.snippet.title ?? "",
          channel: item.snippet.channelTitle ?? "",
          views: Number(item.statistics?.viewCount ?? 0),
          comments: Number(item.statistics?.commentCount ?? 0),
          url: `https://www.youtube.com/watch?v=${id}`,
        });
      }
      next.details += ids.length;
    }
    if (next.details >= next.ids.length) {
      next.selected = selectVideos(next);
      next.phase = next.selected.length ? "comments" : "done";
      for (const id of s.links)
        if (!next.selected.some((v) => v.id === id))
          next.warnings.push(`Vídeo indicado indisponível: ${id}`);
    }
  } else if (next.phase === "comments") {
    const video: Video = next.selected[next.video];
    let data: YouTubeData;
    try {
      data = await api({
        action: "comments",
        videoId: video.id,
        pageToken: next.token,
      });
    } catch (error) {
      if (error instanceof RequestError && error.status === 409) {
        next.warnings.push(`Comentários desativados: ${video.title}`);
        next.video++;
        next.token = "";
        if (next.video >= next.selected.length) next.phase = "done";
        return next;
      }
      throw error;
    }
    const existing = next.rows.filter((r) => r.id_video === video.id).length;
    for (const item of data.items.slice(0, s.perVideo - existing)) {
      const comment = item.snippet.topLevelComment;
      if (!comment) continue;
      if (comment.id && next.rows.some((r) => r.id_comentario === comment.id))
        continue;
      const r = comment.snippet;
      const row: RecordRow = {
        coleta_id: next.id,
        coletado_em_utc: next.created,
        buscas: s.terms.join(", "),
        id_video: video.id,
        video: video.title,
        canal_video: video.channel,
        url_video: video.url,
        origem: s.links.includes(video.id)
          ? "Link informado"
          : "Busca automática",
        id_comentario: comment.id ?? "",
        id_canal_autor: r.authorChannelId?.value ?? "",
        autor: r.authorDisplayName ?? "",
        publicado_em: r.publishedAt ?? "",
        curtidas: r.likeCount ?? 0,
        comentario: r.textDisplay,
        incluido_no_txt: false,
      };
      next.rows.push(row);
    }
    if (data.nextPageToken && data.nextPageToken === next.token)
      throw new Error(
        "A API repetiu a página. Exporte o parcial antes de iniciar outra pesquisa.",
      );
    if (data.nextPageToken && existing + data.items.length < s.perVideo)
      next.token = data.nextPageToken;
    else {
      next.video++;
      next.token = "";
      if (next.video >= next.selected.length) next.phase = "done";
    }
  }
  return next;
}
