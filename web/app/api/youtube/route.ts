import { ApiError, query } from "@/lib/youtube";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8192)
      return Response.json(
        { error: "Solicitação muito grande." },
        { status: 413, headers },
      );
    const text = await request.text();
    if (text.length > 8192)
      return Response.json(
        { error: "Solicitação muito grande." },
        { status: 413, headers },
      );
    let input;
    try {
      input = JSON.parse(text);
    } catch {
      throw new ApiError("Solicitação inválida.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new ApiError("Solicitação inválida.");
    return Response.json(await query(input, request.signal), { headers });
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
