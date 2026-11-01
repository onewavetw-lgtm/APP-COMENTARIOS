import { handleYouTubeRequest } from "@/lib/youtube-route";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  return handleYouTubeRequest(request);
}
