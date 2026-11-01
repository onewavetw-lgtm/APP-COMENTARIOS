import test from "node:test";
import assert from "node:assert/strict";
import { requestYouTube } from "../lib/api-client";
import { advance, RequestError } from "../lib/engine";
import { analysisFile, newJob } from "../lib/model";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const setup = () =>
  newJob({
    terms: [],
    links: Array.from({ length: 30 }, (_, i) => String(i).padStart(11, "0")),
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
const comment = (id: string) => ({
  id,
  snippet: {
    topLevelComment: {
      id,
      snippet: { textDisplay: "Preciso resolver este problema." },
    },
  },
});

test("30 vídeos terminam após queda de rede e HTTP 502 HTML na segunda página do segundo vídeo", async () => {
  let job = setup();
  const ids = job.ids;
  let retries = 0,
    attempts = 0;
  const cursors: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const p = JSON.parse(init!.body as string);
    if (p.action === "videos")
      return json({
        items: ids.map((id) => ({
          id,
          snippet: { title: "Vídeo " + id },
          statistics: { commentCount: "500" },
        })),
      });
    const index = ids.indexOf(p.videoId);
    if (index === 1 && p.pageToken === "page-2") {
      cursors.push(p.pageToken);
      attempts++;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      if (attempts === 2)
        return new Response("<html>Bad gateway</html>", { status: 502 });
    }
    const count = index === 0 ? 69 : 100;
    return json({
      items: Array.from({ length: count }, (_, i) =>
        comment(`${index}-${p.pageToken || "page-1"}-${i}`),
      ),
      ...(index > 0 && !p.pageToken ? { nextPageToken: "page-2" } : {}),
    });
  };
  const signal = new AbortController().signal;
  while (job.phase !== "done")
    job = await advance(job, (p) =>
      requestYouTube(p, "FAKE_KEY", {
        signal,
        fetcher,
        wait: async () => {
          retries++;
        },
      }),
    );
  assert.equal(job.video, 30);
  assert.equal(job.rows.length, 69 + 29 * 200);
  assert.equal(
    new Set(job.rows.map((r) => r.id_comentario)).size,
    job.rows.length,
  );
  assert.deepEqual(cursors, ["page-2", "page-2", "page-2"]);
  assert.equal(retries, 2);
  assert.equal(analysisFile(job).coleta.situacao, "concluida");
});

test("falha persistente limita tentativas a quatro e preserva cursor para continuar", async () => {
  let job = setup();
  job.phase = "comments";
  job.selected = job.ids.map((id) => ({
    id,
    title: id,
    channel: "",
    views: 0,
    comments: 500,
    url: "",
  }));
  job.video = 1;
  job.token = "page-2";
  const before = JSON.stringify(job);
  let count = 0,
    quotaAttempts = 0,
    cooldown = 0;
  await assert.rejects(
    advance(job, (p) =>
      requestYouTube(p, "FAKE_KEY", {
        signal: new AbortController().signal,
        beforeAttempt: async () => {
          quotaAttempts++;
        },
        fetcher: async () => {
          count++;
          return new Response("timeout", { status: 504 });
        },
        wait: async () => {},
        onCooldown: (until) => {
          cooldown = until;
        },
      }),
    ),
    (e) => e instanceof RequestError && e.status === 504,
  );
  assert.equal(count, 4);
  assert.equal(quotaAttempts, 4);
  assert.ok(cooldown > Date.now());
  assert.equal(JSON.stringify(job), before);
  job = await advance(job, async (p) => {
    assert.equal(p.pageToken, "page-2");
    assert.equal(p.videoId, job.selected[1].id);
    return { items: [comment("recovered")] };
  });
  assert.equal(job.video, 2);
  assert.equal(job.rows.length, 1);
});

test("cota esgotada e chave recusada não gastam tentativas automáticas", async () => {
  for (const message of ["Cota da API esgotada.", "Chave recusada."]) {
    let calls = 0;
    await assert.rejects(
      requestYouTube({}, "FAKE_KEY", {
        signal: new AbortController().signal,
        fetcher: async () => {
          calls++;
          return json({ error: message }, 403);
        },
        wait: async () => {
          assert.fail("Não deve aguardar nem repetir 403");
        },
      }),
      (e) =>
        e instanceof RequestError && e.status === 403 && e.message === message,
    );
    assert.equal(calls, 1);
  }
});

test("429 longo mantém o prazo sem tentativas extras; pausa cancela retry curto", async () => {
  let calls = 0,
    cooldown = 0;
  await assert.rejects(
    requestYouTube({}, "FAKE_KEY", {
      signal: new AbortController().signal,
      fetcher: async () => {
        calls++;
        return json({ error: "Limite", retryAfter: 120 }, 429);
      },
      onCooldown: (until) => {
        cooldown = until;
      },
    }),
    (e) => e instanceof RequestError && e.status === 429,
  );
  assert.equal(calls, 1);
  assert.ok(cooldown > Date.now() + 119000);
  const controller = new AbortController();
  await assert.rejects(
    requestYouTube({}, "FAKE_KEY", {
      signal: controller.signal,
      fetcher: async () => {
        calls++;
        return json({ error: "Limite", retryAfter: 4 }, 429);
      },
      onWait: (until) => {
        if (until) controller.abort();
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 2);
});

test("tempo limite por tentativa evita requisição pendurada e pausa aborta sem repetir", async () => {
  let calls = 0;
  await assert.rejects(
    requestYouTube({}, "FAKE_KEY", {
      signal: new AbortController().signal,
      timeoutMs: 10,
      fetcher: async (_url, init) => {
        calls++;
        return new Promise((_resolve, reject) => {
          // Keep the event loop alive while the real timeout signal fires.
          const timer = setTimeout(
            () => reject(new Error("timeout ausente")),
            1000,
          );
          init!.signal!.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(init!.signal!.reason);
            },
            { once: true },
          );
        });
      },
      wait: async () => {},
    }),
    (e) => e instanceof RequestError && e.status === 502,
  );
  assert.equal(calls, 4);
  const controller = new AbortController();
  await assert.rejects(
    requestYouTube({}, "FAKE_KEY", {
      signal: controller.signal,
      fetcher: async () => {
        controller.abort();
        throw new TypeError("Abortada");
      },
      wait: async () => {
        assert.fail("Pausa não deve tentar de novo");
      },
    }),
    { name: "AbortError" },
  );
});

test("vídeo removido na fila não bloqueia os seguintes nem descarta páginas anteriores", async () => {
  let job = setup();
  job.phase = "comments";
  job.selected = job.ids.map((id) => ({
    id,
    title: id,
    channel: "",
    views: 0,
    comments: 0,
    url: "",
  }));
  job = await advance(job, async () => ({ items: [comment("preserved")] }));
  job = await advance(job, async () => {
    throw new RequestError("Vídeo removido", 410);
  });
  assert.equal(job.video, 2);
  assert.equal(job.rows.length, 1);
  assert.match(job.warnings[0], /Vídeo indisponível/);
  while (job.phase !== "done")
    job = await advance(job, async () => ({ items: [] }));
  assert.equal(job.video, 30);
});
