import { fetch as networkFetch, EnvHttpProxyAgent } from "undici";
export type Action = "search" | "videos" | "comments";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
const string = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max ? v : "";
export function validate(input: Record<string, unknown>) {
  const key = string(input.key, 200).trim();
  if (key.length < 10) throw new ApiError("Informe sua chave do YouTube.");
  const action = input.action as Action;
  if (!["search", "videos", "comments"].includes(action))
    throw new ApiError("Operação inválida.");
  const params = new URLSearchParams({ key });
  if (action === "search") {
    const q = string(input.q, 250).trim();
    if (!q) throw new ApiError("Busca inválida (máximo de 250 caracteres).");
    const days = Number(input.days ?? 0);
    if (!Number.isInteger(days) || days < 0 || days > 5475)
      throw new ApiError("Período inválido.");
    params.set("part", "snippet");
    params.set("type", "video");
    params.set("maxResults", "50");
    params.set("q", q);
    params.set("regionCode", "BR");
    params.set("relevanceLanguage", "pt");
    params.set(
      "order",
      input.order === "viewCount" ? "viewCount" : "relevance",
    );
    if (days)
      params.set(
        "publishedAfter",
        new Date(Date.now() - days * 86400000).toISOString(),
      );
  } else if (action === "videos") {
    const ids = string(input.ids, 650).split(",");
    if (
      !ids.length ||
      ids.length > 50 ||
      ids.some((id) => !/^[-\w]{11}$/.test(id))
    )
      throw new ApiError("IDs de vídeos inválidos.");
    params.set("part", "snippet,statistics");
    params.set("id", ids.join(","));
  } else {
    const id = string(input.videoId, 11);
    if (!/^[-\w]{11}$/.test(id)) throw new ApiError("Vídeo inválido.");
    params.set("part", "snippet");
    params.set("videoId", id);
    params.set("maxResults", "100");
    params.set("order", "relevance");
    params.set("textFormat", "plainText");
  }
  if (action !== "videos" && input.pageToken) {
    const token = string(input.pageToken, 1024);
    if (!token) throw new ApiError("Página inválida.");
    params.set("pageToken", token);
  }
  return { action, params };
}
export function retrySeconds(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - now) / 1000))
    : 0;
}
export async function query(
  input: Record<string, unknown>,
  signal?: AbortSignal,
  fetcher = networkFetch,
) {
  const { action, params } = validate(input);
  const resource = action === "comments" ? "commentThreads" : action;
  // No arbitrary URL or shared API key: each request uses only the visitor's key.
  const dispatcher =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY
      ? new EnvHttpProxyAgent()
      : undefined;
  try {
    const response = await fetcher(
      `https://www.googleapis.com/youtube/v3/${resource}?${params}`,
      {
        dispatcher,
        signal: AbortSignal.any([
          AbortSignal.timeout(18000),
          ...(signal ? [signal] : []),
        ]),
      },
    );
    const data = (await response.json().catch(() => null)) as {
      error?: { errors?: { reason?: string }[] };
      items?: unknown[];
    } | null;
    const reasons = data?.error?.errors?.map((e) => e.reason) ?? [];
    if (
      response.status === 429 ||
      reasons.some(
        (r) => r === "rateLimitExceeded" || r === "userRateLimitExceeded",
      )
    )
      throw new ApiError(
        "Limite temporário. O progresso foi mantido; aguarde antes de continuar.",
        429,
        retrySeconds(response.headers.get("retry-after")) || 30,
      );
    if (
      reasons.some((r) => r === "quotaExceeded" || r === "dailyLimitExceeded")
    )
      throw new ApiError(
        "Cota da API esgotada. Confira o projeto no Google Cloud antes de continuar.",
        403,
      );
    if (reasons.includes("commentsDisabled"))
      throw new ApiError("Comentários desativados neste vídeo.", 409);
    if (response.status !== 200)
      throw new ApiError(
        "A API recusou a solicitação. Confira a chave, as permissões e a ativação da YouTube Data API.",
        response.status >= 500 ? 502 : 403,
      );
    if (!data || !Array.isArray(data.items))
      throw new ApiError("Resposta inválida da API.", 502);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Não foi possível concluir a conexão. Seu progresso foi mantido.",
      502,
    );
  } finally {
    await dispatcher?.close();
  }
}
