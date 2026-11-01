import { ApiError, query } from "./youtube";
import { MAX_YOUTUBE_REQUEST_BYTES } from "./request-limits";

async function readInput(request: Request) {
  if (
    Number(request.headers.get("content-length") ?? 0) >
    MAX_YOUTUBE_REQUEST_BYTES
  )
    throw new ApiError("Solicitação muito grande.", 413);
  // Check actual bytes too: Content-Length may be absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Solicitação inválida.");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_YOUTUBE_REQUEST_BYTES) {
        await reader.cancel();
        throw new ApiError("Solicitação muito grande.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new ApiError("Solicitação inválida.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ApiError("Solicitação inválida.");
  return input as Record<string, unknown>;
}

// Only the upstream transport is injectable for integration tests. Parsing,
// limits, validation and the fixed Google URL remain the production code path.
export async function handleYouTubeRequest(
  request: Request,
  upstream?: Parameters<typeof query>[2],
) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const input = await readInput(request);
    return Response.json(await query(input, request.signal, upstream), {
      headers,
    });
  } catch (error) {
    if (error instanceof ApiError)
      return Response.json(
        { error: error.message, retryAfter: error.retryAfter },
        {
          status: error.status,
          headers: {
            ...headers,
            ...(error.retryAfter
              ? { "Retry-After": String(error.retryAfter) }
              : {}),
          },
        },
      );
    return Response.json(
      { error: "Não foi possível concluir a operação." },
      { status: 500, headers },
    );
  }
}
