import test from "node:test";
import assert from "node:assert/strict";
import {
  importedResearch,
  validateSource,
  readBackup,
  phrases,
  sourceLink,
} from "../lib/library";
const source = {
  formato: "lowwave-analise-v1",
  total_registros: 99,
  comentarios: [
    {
      comentario: "Já tentei, já tentei trocar a mangueira?",
      autor: "Maria",
      id_video: "abcdefghijk",
      id_comentario: "1",
    },
    {
      comentario: "Já tentei trocar a bomba.",
      autor: "João",
      id_video: "abcdefghijk",
      id_comentario: "2",
    },
    { comentario: "Já tentei trocar a mangueira.", id_video: "12345678901" },
  ],
};
test("importação preserva todos os campos originais e usa contagem real sem inventar autores", async () => {
  const before = JSON.stringify(source),
    item = await importedResearch(source, "Motobombas");
  assert.equal(item.source.comentarios.length, 3);
  assert.equal(item.source.total_registros, 99);
  item.notes = "Hipótese do pesquisador";
  item.evidence["0"] = { note: "Conferir tentativa", favorite: true };
  item.report = "Interpretação externa";
  assert.equal(JSON.stringify(item.source), before);
  const equivalent = await importedResearch(
    JSON.parse(JSON.stringify(source)),
    "Outro nome",
  );
  assert.equal(item.fingerprint, equivalent.fingerprint);
  assert.ok(!("autor" in item.source.comentarios[2]));
});
test("backup mantém anotações e verifica integridade da fonte; rejeita tudo antes de importar corrupção", async () => {
  const item = await importedResearch(source, "Motobombas");
  item.evidence["0"] = { favorite: true, note: "Minha observação" };
  const backup = { formato: "lowwave-biblioteca-v1", pesquisas: [item] };
  assert.deepEqual(await readBackup(backup), [item]);
  const broken = structuredClone(backup);
  broken.pesquisas[0].source.comentarios[0].comentario = "Alterado";
  await assert.rejects(readBackup(broken), /conferência/);
  assert.throws(() =>
    validateSource({ comentarios: [{ texto: "Não compatível" }] }),
  );
});
test("expressões contam uma vez por registro e distinguem vídeos; fontes não abrem URLs arbitrárias", () => {
  const phrase = phrases(source.comentarios).find(
    (g) => g.phrase === "já tentei",
  );
  assert.equal(phrase?.count, 3);
  assert.equal(phrase?.videos, 2);
  assert.equal(
    sourceLink({ comentario: "x", url_video: "javascript:alert(1)" }),
    null,
  );
  assert.equal(
    sourceLink(source.comentarios[0]),
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
});
