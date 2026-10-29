import test from "node:test";
import assert from "node:assert/strict";
import { newJob } from "../lib/model";
import { advance, RequestError } from "../lib/engine";
import {
  collectionProgress,
  readingSteps,
  secondsLeft,
  waitUntil,
} from "../lib/presentation";
test("onda fica indeterminada até a seleção; 429 preserva progresso real e etapas concluídas", async () => {
  let job = newJob({
    terms: ["tema"],
    links: [],
    onlyLinks: false,
    pages: 1,
    videos: 2,
    perVideo: 100,
    maxText: 100,
    days: 0,
    minimum: 1,
    letters: 10,
    order: "relevance",
    painOnly: false,
    keywords: [],
  });
  assert.equal(collectionProgress(job).determinate, false);
  job = await advance(job, async () => ({
    items: ["abcdefghijk", "12345678901"].map((id) => ({
      id: { videoId: id },
      snippet: {},
    })),
  }));
  assert.equal(collectionProgress(job).determinate, false);
  assert.deepEqual(
    readingSteps(job).map((s) => s.done),
    [true, false, false],
  );
  job = await advance(job, async () => ({
    items: ["abcdefghijk", "12345678901"].map((id) => ({
      id,
      snippet: { title: id },
      statistics: { commentCount: "1" },
    })),
  }));
  assert.deepEqual(collectionProgress(job), { determinate: true, percent: 0 });
  job = await advance(job, async () => ({ items: [] }));
  assert.equal(collectionProgress(job).percent, 50);
  const before = JSON.stringify(job);
  await assert.rejects(
    advance(job, async () => {
      throw new RequestError("Limite temporário", 429, 20);
    }),
  );
  assert.equal(JSON.stringify(job), before);
  assert.equal(collectionProgress(job).percent, 50);
  assert.equal(readingSteps(job)[2].done, false);
  job = await advance(job, async () => ({ items: [] }));
  assert.equal(collectionProgress(job).percent, 100);
  assert.equal(
    readingSteps(job).every((s) => s.done),
    true,
  );
});
test("contagem usa prazo absoluto e não acumula atraso de abas em segundo plano", () => {
  assert.equal(secondsLeft(10000, 1000), 9);
  assert.equal(secondsLeft(10000, 9700), 1);
  assert.equal(secondsLeft(10000, 11000), 0);
  assert.equal(secondsLeft(0, 1000), 0);
});
test("pausar cancela espera sem aguardar Retry-After nem executar nova consulta", async () => {
  const controller = new AbortController();
  const waiting = waitUntil(Date.now() + 60000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await assert.rejects(waitUntil(Date.now() + 60000, alreadyAborted.signal), {
    name: "AbortError",
  });
  await waitUntil(Date.now() - 1, new AbortController().signal);
});
