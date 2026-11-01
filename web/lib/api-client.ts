import { RequestError, type YouTubeData } from "./engine";
import { waitUntil } from "./presentation";

type Options = {
  signal: AbortSignal;
  beforeAttempt?: () => Promise<unknown>;
  onWait?: (deadline: number, message: string) => void;
  onCooldown?: (deadline: number) => void;
  fetcher?: typeof fetch;
  wait?: typeof waitUntil;
  timeoutMs?: number;
};

// Retrying the same page is safe: the engine only advances its cursor after success.
// Authentication, quota and permanent errors must never be retried automatically.
export async function requestYouTube(
  params: Record<string, unknown>,
  key: string,
  options: Options,
): Promise<YouTubeData> {
  const { signal, beforeAttempt, onWait, onCooldown } = options;
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? waitUntil;
  for (let attempt = 0; attempt < 4; attempt++) {
    signal.throwIfAborted();
    await beforeAttempt?.();
    signal.throwIfAborted();
    let error: RequestError;
    try {
      const response = await fetcher("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, key: key.trim() }),
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(options.timeoutMs ?? 25000),
        ]),
        cache: "no-store",
      });
      // Vercel/gateway errors may return HTML rather than our JSON error envelope.
      const data = await response.json().catch(() => null);
      const retryAfter = Number(
        data?.retryAfter ?? response.headers.get("retry-after") ?? 0,
      );
      if (response.ok && data && Array.isArray(data.items)) return data;
      error = new RequestError(
        typeof data?.error === "string"
          ? data.error
          : response.ok
            ? "O servidor retornou uma resposta inválida."
            : `O servidor não concluiu a consulta (HTTP ${response.status}).`,
        response.ok ? 502 : response.status,
        Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0,
      );
    } catch {
      signal.throwIfAborted();
      error = new RequestError(
        "A conexão caiu ou demorou para responder.",
        502,
      );
    }
    signal.throwIfAborted();
    const temporary = [408, 429, 500, 502, 503, 504].includes(error.status);
    const delay = Math.max(
      error.retryAfter || (error.status === 429 ? 30 : 0),
      2 ** (attempt + 1),
    );
    // Respect long Retry-After values, but let the user choose when to resume.
    if (!temporary || attempt === 3 || delay > 60) {
      if (temporary) onCooldown?.(Date.now() + delay * 1000);
      throw error;
    }
    const deadline = Date.now() + delay * 1000;
    onWait?.(
      deadline,
      `${error.message} Tentativa ${attempt + 2} de 4 será automática; o progresso está salvo.`,
    );
    try {
      await wait(deadline, signal);
    } finally {
      if (signal.aborted && deadline > Date.now()) onCooldown?.(deadline);
      onWait?.(0, "");
    }
  }
  throw new Error("Não foi possível concluir a consulta.");
}
