import test from "node:test";
import assert from "node:assert/strict";
import {
  quotaDay,
  quotaIdentity,
  addAttempt,
  estimatedUsed,
  Quota,
} from "../lib/quota";
test("dia da cota segue Pacífico nas viradas com e sem horário de verão", () => {
  assert.equal(quotaDay(new Date("2026-10-29T06:59:59Z")), "2026-10-28");
  assert.equal(quotaDay(new Date("2026-10-29T07:00:00Z")), "2026-10-29");
  assert.equal(quotaDay(new Date("2026-12-01T07:59:59Z")), "2026-11-30");
  assert.equal(quotaDay(new Date("2026-12-01T08:00:00Z")), "2026-12-01");
});
test("tentativas repetidas são contadas e ajuste observado continua acumulando novos custos", () => {
  const initial: Quota = {
    day: "2026-10-29",
    units: 0,
    adjustment: 0,
    checkedAt: "",
    limit: 10000,
    attempts: { search: 0, videos: 0, comments: 0 },
  };
  let q = addAttempt(initial, "search");
  q = addAttempt(q, "search");
  q = addAttempt(q, "videos");
  q = addAttempt(q, "comments");
  assert.equal(estimatedUsed(q), 202);
  assert.equal(initial.units, 0);
  assert.equal(q.attempts.search, 2);
  q = { ...q, adjustment: 500 - q.units };
  assert.equal(estimatedUsed(addAttempt(q, "comments")), 501);
});
test("identificação da chave não contém a credencial; diferentes chaves ficam isoladas", async () => {
  const id = await quotaIdentity("CHAVE_FICTICIA");
  assert.equal(id.length, 64);
  assert.ok(!id.includes("CHAVE_FICTICIA"));
  assert.equal(id, await quotaIdentity(" CHAVE_FICTICIA "));
  assert.notEqual(id, await quotaIdentity("OUTRA_CHAVE"));
});
