import test from "node:test";
import { Response } from "undici";
import assert from "node:assert/strict";
import {
  newJob,
  parseLinks,
  analysisFile,
  filteredRows,
  textFile,
  Settings,
} from "../lib/model";
import { advance, RequestError, YouTubeData } from "../lib/engine";
import { query, validate, ApiError, retrySeconds } from "../lib/youtube";
const settings: Settings = {
  terms: ["motobomba"],
  links: [],
  onlyLinks: false,
  pages: 1,
  videos: 5,
  perVideo: 200,
  days: 0,
  order: "relevance",
  minimum: 1,
  letters: 20,
  maxText: 300,
  painOnly: false,
  keywords: [],
};
const id = "abcdefghijk",
  other = "12345678901";
const video = (i = id) => ({
  id: i,
  snippet: { title: "Demonstração de motobomba", channelTitle: "Canal" },
  statistics: { viewCount: "100", commentCount: "2" },
});
const comment = (i: string) => ({
  id: "thread" + i,
  snippet: {
    topLevelComment: {
      id: i,
      snippet: {
        textDisplay: "Minha motobomba não consegue puxar água. O que fazer?",
        likeCount: 2,
        authorChannelId: { value: "canal" },
        authorDisplayName: "Autor",
      },
    },
  },
});
test("valida destinos fixos, parâmetros e não acrescenta período por padrão", () => {
  const { params } = validate({
    key: "CHAVE_FICTICIA",
    action: "search",
    q: "motobomba",
  });
  assert.equal(params.get("q"), "motobomba");
  assert.equal(params.has("publishedAfter"), false);
  assert.throws(() =>
    validate({
      key: "CHAVE_FICTICIA",
      action: "videos",
      ids: "https://exemplo.invalid",
    }),
  );
  assert.throws(() => validate({ key: "CHAVE_FICTICIA", action: "proxy" }));
});
test("links de Shorts/watch e rejeição de domínio falso", () => {
  assert.deepEqual(
    parseLinks(`https://youtu.be/${id}\nhttps://www.youtube.com/shorts/${id}`),
    [id],
  );
  assert.throws(() =>
    parseLinks(`https://youtube.com.exemplo.invalid/watch?v=${id}`),
  );
});
test("workflow completo e JSON compatível sem chave", async () => {
  let job = newJob(settings);
  job = await advance(job, async () => ({
    items: [{ id: { videoId: id }, snippet: {} }],
  }));
  assert.equal(job.phase, "details");
  job = await advance(job, async () => ({ items: [video()] }));
  assert.equal(job.phase, "comments");
  job = await advance(job, async () => ({
    items: [comment("c1"), comment("c1"), comment("c2")],
  }));
  assert.equal(job.phase, "done");
  assert.equal(job.rows.length, 2);
  const file = analysisFile(job);
  assert.equal(file.total_registros, 2);
  assert.equal(file.formato, "lowwave-analise-v1");
  assert.equal(file.comentarios.filter((r) => r.incluido_no_txt).length, 1);
  assert.ok(file.instrucoes.length > 0);
  assert.ok(!JSON.stringify(job).includes("CHAVE_FICTICIA"));
});
test("429 mantém cursor e registros para retomar sem reiniciar", async () => {
  let job = newJob({ ...settings, links: [id], onlyLinks: true });
  job = await advance(job, async () => ({ items: [video()] }));
  job = await advance(job, async () => ({
    items: [comment("c1")],
    nextPageToken: "segunda",
  }));
  const before = JSON.stringify(job);
  await assert.rejects(
    advance(job, async () => {
      throw new RequestError("limite", 429, 120);
    }),
  );
  assert.equal(JSON.stringify(job), before);
  assert.equal(job.token, "segunda");
  job = await advance(job, async (p) => {
    assert.equal(p.pageToken, "segunda");
    return { items: [comment("c2")] };
  });
  assert.equal(job.phase, "done");
  assert.equal(job.rows.length, 2);
});
test("links ignoram corte de data e mínimo, com prioridade e sem duplicação", async () => {
  let job = newJob({
    ...settings,
    links: [id],
    onlyLinks: true,
    minimum: 100,
    videos: 1,
  });
  job = await advance(job, async () => ({ items: [video()] }));
  assert.equal(job.selected[0].id, id);
});
test("termos alternam posições e removem vídeos repetidos", async () => {
  let job = newJob({ ...settings, terms: ["um", "dois"] });
  job = await advance(job, async () => ({
    items: [
      { id: { videoId: id }, snippet: {} },
      { id: { videoId: "zyxwvutsrqp" }, snippet: {} },
    ],
  }));
  job = await advance(job, async () => ({
    items: [
      { id: { videoId: other }, snippet: {} },
      { id: { videoId: id }, snippet: {} },
    ],
  }));
  assert.deepEqual(job.ids, [id, other, "zyxwvutsrqp"]);
});
test("comentários desativados são avisados e não bloqueiam demais vídeos", async () => {
  let job = newJob({ ...settings, links: [id, other], onlyLinks: true });
  job = await advance(job, async () => ({ items: [video(id), video(other)] }));
  job = await advance(job, async () => {
    throw new RequestError("desativados", 409);
  });
  assert.equal(job.video, 1);
  assert.equal(job.warnings.length, 1);
  assert.equal(job.phase, "comments");
});
test("HTTP 429 é repassado sem expor corpo ou chave e sem dormir no servidor", async () => {
  const fake = (async () =>
    new Response(JSON.stringify({ error: { message: "CHAVE_SECRETA" } }), {
      status: 429,
      headers: { "retry-after": "120" },
    })) as Parameters<typeof query>[2];
  await assert.rejects(
    query(
      { action: "search", q: "motobomba", key: "CHAVE_FICTICIA" },
      undefined,
      fake,
    ),
    (e) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 429);
      assert.equal(e.retryAfter, 120);
      assert.ok(!e.message.includes("CHAVE_SECRETA"));
      return true;
    },
  );
  assert.equal(retrySeconds("garbage"), 0);
});
test("JSON parcial é explícito e filtro de dor não é obrigatório", () => {
  const job = newJob(settings);
  assert.equal(analysisFile(job).coleta.situacao, "parcial");
  assert.deepEqual(filteredRows(job), []);
});

test("prompt editado acompanha JSON e TXT sem perder registros excluídos do filtro", async () => {
  let job = newJob({
    ...settings,
    links: [id],
    onlyLinks: true,
    painOnly: true,
    keywords: ["termo-ausente"],
    prompt: "Descubra dores sobre {assunto}. Confira as fontes.",
    includePrompt: true,
  });
  job = await advance(job, async () => ({ items: [video()] }));
  job = await advance(job, async () => ({ items: [comment("c1")] }));
  const before = JSON.stringify(job.rows);
  assert.equal(filteredRows(job).length, 0);
  const exported = analysisFile(job);
  assert.equal(exported.total_registros, 1);
  assert.equal(exported.comentarios[0].incluido_no_txt, false);
  assert.equal(
    exported.orientacao_da_pesquisa,
    "Descubra dores sobre motobomba. Confira as fontes.",
  );
  assert.equal(textFile(job).trim(), exported.orientacao_da_pesquisa);
  job.settings.includePrompt = false;
  assert.equal(textFile(job), "");
  assert.equal(
    analysisFile(job).orientacao_da_pesquisa,
    exported.orientacao_da_pesquisa,
  );
  assert.equal(JSON.stringify(job.rows), before);
});
test("progresso antigo sem campos de prompt continua exportável", async () => {
  let job = newJob({ ...settings, terms: [], links: [id], onlyLinks: true });
  job = await advance(job, async () => ({ items: [video()] }));
  job = await advance(job, async () => ({ items: [comment("c1")] }));
  assert.match(
    analysisFile(job).orientacao_da_pesquisa,
    /Vídeos informados por link/,
  );
  assert.match(textFile(job), /Ainda não sei qual é essa dor/);
  assert.match(textFile(job), /Minha motobomba/);
});
