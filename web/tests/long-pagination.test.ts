import test from "node:test";
import assert from "node:assert/strict";
import { Response as UpstreamResponse } from "undici";
import { validate, query, ApiError } from "../lib/youtube";
import { handleYouTubeRequest } from "../lib/youtube-route";
import {
  MAX_PAGE_TOKEN_LENGTH,
  MAX_YOUTUBE_REQUEST_BYTES,
} from "../lib/request-limits";
import { advance } from "../lib/engine";
import { requestYouTube } from "../lib/api-client";
import { newJob, analysisFile } from "../lib/model";

const base = {
  key: "FAKE_KEY_FOR_TEST",
  action: "comments",
  videoId: "ewxIrwo6uTY",
};
const opaqueToken = (size: number) =>
  "Cg0QARgBIg%2B-_+/=".repeat(Math.ceil(size / 18)).slice(0, size);
const unusedUpstream = (async () => {
  assert.fail("Requisição inválida não deve consultar o YouTube");
}) as Parameters<typeof query>[2];

test("códigos opacos maiores que 1024 caracteres passam intactos pela validação e URL", () => {
  for (const size of [1024, 1025, 4096, 12000, MAX_PAGE_TOKEN_LENGTH]) {
    const token = opaqueToken(size);
    const { params } = validate({ ...base, pageToken: token });
    assert.equal(params.get("pageToken"), token);
    assert.equal(
      new URLSearchParams(params.toString()).get("pageToken"),
      token,
    );
  }
  for (const pageToken of [
    {},
    [],
    1,
    false,
    opaqueToken(MAX_PAGE_TOKEN_LENGTH + 1),
  ]) {
    assert.throws(
      () => validate({ ...base, pageToken }),
      (e) => e instanceof ApiError && e.status === 400,
    );
  }
  assert.equal(
    validate({ ...base, pageToken: "" }).params.has("pageToken"),
    false,
  );
});

test("cliente, rota HTTP e validação reais concluem 30 vídeos com páginas longas, retomando os 169 registros", async () => {
  const ids = Array.from({ length: 30 }, (_, i) => String(i).padStart(11, "0"));
  let job = newJob({
    terms: [],
    links: ids,
    onlyLinks: true,
    pages: 1,
    videos: 30,
    perVideo: 200,
    maxText: 300,
    days: 0,
    minimum: 1,
    letters: 1,
    order: "relevance",
    painOnly: false,
    keywords: [],
  });
  let requests = 0,
    resumed = false,
    longPages = 0;
  const upstream = (async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(url.searchParams.get("key"), base.key);
    requests++;
    let data;
    if (url.pathname.endsWith("/videos")) {
      data = {
        items: ids.map((id) => ({
          id,
          snippet: { title: "Vídeo " + id },
          statistics: { commentCount: "500" },
        })),
      };
    } else {
      assert.ok(url.pathname.endsWith("/commentThreads"));
      const index = ids.indexOf(url.searchParams.get("videoId")!);
      const token = url.searchParams.get("pageToken");
      // The second video's token exceeds the former 8 KB HTTP envelope as well.
      const expected = opaqueToken(index === 1 ? 12000 : 2048);
      if (token) {
        assert.equal(token, expected);
        longPages++;
      }
      data = {
        items: Array.from({ length: index === 0 ? 69 : 100 }, (_, i) => ({
          id: `thread-${index}-${token ? 2 : 1}-${i}`,
          snippet: {
            topLevelComment: {
              id: `c-${index}-${token ? 2 : 1}-${i}`,
              snippet: {
                textDisplay: "Minha geladeira não funciona, preciso de ajuda.",
              },
            },
          },
        })),
        ...(index > 0 && !token ? { nextPageToken: expected } : {}),
      };
    }
    return new UpstreamResponse(JSON.stringify(data), {
      headers: { "content-type": "application/json" },
    });
  }) as Parameters<typeof query>[2];
  const fetcher: typeof fetch = async (_url, init) =>
    handleYouTubeRequest(
      new Request("https://lowwave.example/api/youtube", init),
      upstream,
    );
  while (job.phase !== "done") {
    job = await advance(job, (params) =>
      requestYouTube(params, base.key, {
        signal: new AbortController().signal,
        fetcher,
        wait: async () => {
          assert.fail("Paginação válida não deve causar retries");
        },
      }),
    );
    if (job.rows.length === 169 && job.video === 1) {
      // The persisted state reported by the user must resume without resetting it.
      job = JSON.parse(JSON.stringify(job));
      assert.equal(job.token.length, 12000);
      resumed = true;
    }
  }
  assert.equal(resumed, true);
  assert.equal(job.video, 30);
  assert.equal(job.rows.length, 5869);
  assert.equal(new Set(job.rows.map((r) => r.id_comentario)).size, 5869);
  assert.equal(longPages, 29);
  assert.equal(requests, 60);
  assert.equal(analysisFile(job).coleta.situacao, "concluida");
});

test("limite do corpo continua aplicado em bytes, com ou sem Content-Length", async () => {
  const cases = [
    new Request("https://lowwave.example/api/youtube", {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(MAX_YOUTUBE_REQUEST_BYTES + 1) },
    }),
    new Request("https://lowwave.example/api/youtube", {
      method: "POST",
      body: JSON.stringify({ extra: "x".repeat(MAX_YOUTUBE_REQUEST_BYTES) }),
    }),
    new Request("https://lowwave.example/api/youtube", {
      method: "POST",
      body: JSON.stringify({
        extra: "á".repeat(MAX_YOUTUBE_REQUEST_BYTES / 2),
      }),
      headers: { "content-length": "2" },
    }),
  ];
  for (const request of cases) {
    const response = await handleYouTubeRequest(request, unusedUpstream);
    assert.equal(response.status, 413);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const invalidToken = await handleYouTubeRequest(
    new Request("https://lowwave.example/api/youtube", {
      method: "POST",
      body: JSON.stringify({
        ...base,
        pageToken: opaqueToken(MAX_PAGE_TOKEN_LENGTH + 1),
      }),
    }),
    unusedUpstream,
  );
  assert.equal(invalidToken.status, 400);
  const invalidJson = await handleYouTubeRequest(
    new Request("https://lowwave.example/api/youtube", {
      method: "POST",
      body: "[",
    }),
    unusedUpstream,
  );
  assert.equal(invalidJson.status, 400);
});
