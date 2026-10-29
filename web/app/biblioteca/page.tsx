"use client";
import Brand from "@/components/brand";
import ThemeToggle from "@/components/theme-toggle";
import { useEffect, useMemo, useState } from "react";
import {
  Research,
  Comment,
  importedResearch,
  listResearch,
  storeResearch,
  deleteResearch,
  readBackup,
  archiveLegacyJob,
  sourceLink,
  phrases,
  statuses,
} from "@/lib/library";
import { loadJob } from "@/lib/storage";
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function read(file: File) {
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Escolha um arquivo de até 25 MB.");
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error(
      "Não foi possível ler este JSON. O arquivo não foi importado.",
    );
  }
}
export default function Library() {
  const [items, setItems] = useState<Research[]>([]),
    [current, setCurrent] = useState<Research | null>(null),
    [pending, setPending] = useState<Research | null>(null);
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState("comments"),
    [page, setPage] = useState(0),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [working, setWorking] = useState(false);
  async function refresh() {
    setItems(await listResearch());
  }
  useEffect(() => {
    (async () => {
      try {
        const job = await loadJob();
        if (job) await archiveLegacyJob(job);
        await refresh();
      } catch (e) {
        setMessage((e as Error).message);
      }
    })();
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const expressions = useMemo(
    () => (current ? phrases(current.source.comentarios) : []),
    [current?.source],
  );
  const rows = useMemo(
    () =>
      current?.source.comentarios
        .map((row, index) => ({ row, index }))
        .filter(
          ({ row, index }) =>
            (tab !== "notes" ||
              current.evidence[String(index)]?.favorite ||
              current.evidence[String(index)]?.note) &&
            `${row.comentario} ${row.autor ?? ""} ${row.video ?? ""}`
              .toLocaleLowerCase()
              .replace(/[^\p{L}\p{N}]+/gu, " ")
              .includes(
                query.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " "),
              ),
        ) ?? [],
    [current, query, tab],
  );
  function update(patch: Partial<Research>) {
    if (current) {
      setCurrent({ ...current, ...patch });
      setDirty(true);
    }
  }
  async function act(fn: () => Promise<void>) {
    setWorking(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function open(item: Research | null) {
    if (dirty && !window.confirm("Descartar as anotações ainda não salvas?"))
      return;
    setCurrent(item);
    setDirty(false);
    setQuery("");
    setPage(0);
    setTab("comments");
  }
  function renderComment(row: Comment, index: number) {
    const key = String(index),
      annotation = current!.evidence[key],
      link = sourceLink(row);
    return (
      <article className="library-comment" key={index}>
        <strong>
          {typeof row.autor === "string" && row.autor
            ? row.autor
            : "Autor não informado"}
        </strong>
        <small>
          {" "}
          · {Number(row.curtidas) || 0} curtidas · Registro {index + 1}
        </small>
        <p className="original">{row.comentario}</p>
        <p>
          {String(row.video ?? "Vídeo não informado")}
          {link && (
            <>
              {" "}
              ·{" "}
              <a href={link} target="_blank" rel="noreferrer">
                Abrir fonte ↗
              </a>
            </>
          )}
        </p>
        <details>
          <summary>Identificação e metadados originais</summary>
          <pre>{JSON.stringify(row, null, 2)}</pre>
        </details>
        <label className="check">
          <input
            type="checkbox"
            checked={annotation?.favorite ?? false}
            onChange={(e) =>
              update({
                evidence: {
                  ...current!.evidence,
                  [key]: {
                    note: annotation?.note ?? "",
                    favorite: e.target.checked,
                  },
                },
              })
            }
          />
          Favoritar evidência
        </label>
        <label>
          Sua anotação — separada do comentário original
          <textarea
            rows={2}
            value={annotation?.note ?? ""}
            onChange={(e) =>
              update({
                evidence: {
                  ...current!.evidence,
                  [key]: {
                    favorite: annotation?.favorite ?? false,
                    note: e.target.value,
                  },
                },
              })
            }
          />
        </label>
      </article>
    );
  }
  return (
    <div className="shell">
      <aside>
        <Brand />
        <nav>
          <a href="/">◎ Nova pesquisa</a>
          <a href="/biblioteca" aria-current="location">
            ▤ Biblioteca
          </a>
        </nav>
        <p>
          Dados salvos neste navegador. Consultar, anotar e exportar não consome
          cota do YouTube.
        </p>
        <p>Faça backup antes de limpar dados ou trocar de computador.</p>
      </aside>
      <main>
        <header>
          <span>Seu espaço / Biblioteca de pesquisas</span>
          <div className="header-actions">
            <span className="pill">SEM CONSULTAS AO YOUTUBE</span>
            <ThemeToggle />
          </div>
        </header>
        <h1>{current ? current.name : "Biblioteca de pesquisas"}</h1>
        {message && (
          <div role="status" className="notice">
            {message}
          </div>
        )}
        {!current ? (
          <>
            <p>
              Reaproveite suas coletas. Comentários originais, suas anotações e
              análises recebidas permanecem separados.
            </p>
            <div className="actions">
              <label className="file-button">
                + Importar JSON antigo
                <input
                  aria-label="Importar JSON antigo"
                  type="file"
                  accept=".json,application/json"
                  disabled={working}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void act(async () => {
                        const item = await importedResearch(
                          await read(file),
                          file.name.replace(/\.json$/i, ""),
                        );
                        if (
                          (await listResearch()).some(
                            (r) => r.fingerprint === item.fingerprint,
                          )
                        ) {
                          setMessage(
                            "Esta pesquisa já está na biblioteca. Nenhuma cópia foi criada.",
                          );
                          return;
                        }
                        setPending(item);
                      });
                  }}
                />
              </label>
              <button
                disabled={working || !items.length}
                onClick={() =>
                  download("lowwave-biblioteca-backup.json", {
                    formato: "lowwave-biblioteca-v1",
                    pesquisas: items,
                  })
                }
              >
                Baixar backup
              </button>
              <label className="file-button">
                Restaurar backup
                <input
                  aria-label="Restaurar backup"
                  type="file"
                  accept=".json,application/json"
                  disabled={working}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void act(async () => {
                        const restored = await readBackup(await read(file));
                        await storeResearch(restored);
                        await refresh();
                        setMessage(
                          "Backup restaurado. Pesquisas que já existiam foram preservadas, sem substituir suas anotações.",
                        );
                      });
                  }}
                />
              </label>
            </div>
            {pending && (
              <section className="card export">
                <h2>Conferir importação</h2>
                <p>
                  {pending.source.comentarios.length.toLocaleString("pt-BR")}{" "}
                  comentários encontrados na lista do arquivo. Total declarado:{" "}
                  {String(pending.source.total_registros ?? "não informado")}.
                </p>
                <p>
                  A importação preserva os registros, inclusive os sem autor ou
                  ID. Não faz classificação nem elimina relatos.
                </p>
                <label>
                  Nome da pesquisa
                  <input
                    value={pending.name}
                    onChange={(e) =>
                      setPending({ ...pending, name: e.target.value })
                    }
                  />
                </label>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={working || !pending.name.trim()}
                    onClick={() =>
                      void act(async () => {
                        const existing = await listResearch();
                        if (
                          existing.some(
                            (r) => r.fingerprint === pending.fingerprint,
                          )
                        )
                          throw new Error("Esta pesquisa já foi importada.");
                        await storeResearch([pending]);
                        setPending(null);
                        await refresh();
                        setMessage(
                          "Pesquisa importada. Nenhuma consulta ao YouTube foi feita.",
                        );
                      })
                    }
                  >
                    Salvar pesquisa importada
                  </button>
                  <button onClick={() => setPending(null)}>
                    Cancelar importação
                  </button>
                </div>
              </section>
            )}
            <label>
              Buscar pesquisa salva
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome do nicho ou tema"
              />
            </label>
            <div className="library-list">
              {items
                .filter((r) =>
                  r.name
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((item) => (
                  <article className="card" key={item.id}>
                    <small>{item.status.toUpperCase()}</small>
                    <h2>{item.name}</h2>
                    <p>
                      {item.source.comentarios.length.toLocaleString("pt-BR")}{" "}
                      comentários · Salva em{" "}
                      {new Date(item.added).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="actions">
                      <button onClick={() => open(item)}>Abrir pesquisa</button>
                      <button
                        disabled={working}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir “${item.name}” desta biblioteca? Baixe um backup se quiser guardar uma cópia.`,
                            )
                          )
                            void act(async () => {
                              await deleteResearch(item.id);
                              await refresh();
                            });
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!items.length && (
              <p className="empty">
                Importe seu JSON antigo ou faça uma coleta. As novas coletas com
                comentários são guardadas automaticamente.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="actions">
              <button onClick={() => open(null)}>← Voltar à biblioteca</button>
              <button
                className="primary"
                disabled={working || !dirty}
                onClick={() =>
                  void act(async () => {
                    await storeResearch([current], "metadata");
                    setDirty(false);
                    await refresh();
                    setMessage(
                      "Anotações salvas. Os comentários originais foram preservados.",
                    );
                  })
                }
              >
                Salvar anotações
              </button>
              <button
                onClick={() => download("lowwave-analise.json", current.source)}
              >
                Baixar JSON original
              </button>
            </div>
            <p>
              {dirty ? "Há alterações ainda não salvas." : "Anotações salvas."}{" "}
              · {current.source.comentarios.length.toLocaleString("pt-BR")}{" "}
              registros originais
            </p>
            <div className="controls">
              <label>
                Nome da pesquisa
                <input
                  value={current.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label>
                Status da pesquisa
                <select
                  value={current.status}
                  onChange={(e) =>
                    update({ status: e.target.value as Research["status"] })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tabs" role="group" aria-label="Áreas da pesquisa">
              {[
                ["comments", "Comentários e fontes"],
                ["notes", "Minhas anotações"],
                ["language", "Linguagem do público"],
                ["report", "Análise recebida"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={tab === id}
                  onClick={() => {
                    setTab(id);
                    setPage(0);
                    setQuery("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "notes" && (
              <label>
                Suas observações sobre esta pesquisa
                <textarea
                  rows={4}
                  value={current.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
            )}
            {(tab === "comments" || tab === "notes") && (
              <>
                <p>
                  Os nomes são públicos e podem ser apelidos ou contas
                  compartilhadas. Não indicam gênero confirmado nem pessoas
                  únicas.
                </p>
                <label>
                  Buscar nos comentários, autores ou vídeos
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <p>
                  {rows.length} registros encontrados
                  {tab === "notes" ? " com favoritos ou anotações" : ""}.
                </p>
                {rows
                  .slice(page * 50, (page + 1) * 50)
                  .map(({ row, index }) => renderComment(row, index))}
                <div className="actions">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page + 1} de{" "}
                    {Math.max(1, Math.ceil(rows.length / 50))}
                  </span>
                  <button
                    disabled={(page + 1) * 50 >= rows.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Próxima
                  </button>
                </div>
              </>
            )}
            {tab === "language" && (
              <>
                <p>
                  Expressões literais de 2 a 4 palavras, contadas uma vez por
                  registro. Não são categorias de dor nem pessoas únicas.
                  Acentos são preservados; pontuação e maiúsculas são
                  normalizadas. Expressões sobrepostas podem aparecer.
                </p>
                {expressions.length === 0 && (
                  <p>Nenhuma expressão repetida encontrada nesta amostra.</p>
                )}
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Expressão</th>
                        <th>Comentários</th>
                        <th>Vídeos identificados</th>
                        <th>Exemplos completos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expressions.map((g) => (
                        <tr key={g.phrase}>
                          <td>
                            <button
                              onClick={() => {
                                setTab("comments");
                                setQuery(g.phrase);
                                setPage(0);
                              }}
                            >
                              {g.phrase}
                            </button>
                          </td>
                          <td>{g.count}</td>
                          <td>{g.videos}</td>
                          <td>
                            <details>
                              <summary>Conferir exemplos</summary>
                              {g.examples.map((i) => (
                                <blockquote key={i}>
                                  {current.source.comentarios[i].comentario}
                                  <small>
                                    {String(
                                      current.source.comentarios[i].autor ??
                                        "Autor não informado",
                                    )}
                                  </small>
                                </blockquote>
                              ))}
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h2>Perguntas nos comentários</h2>
                <p>
                  Trechos com ponto de interrogação, sem classificação
                  automática.
                </p>
                {current.source.comentarios
                  .map((r, i) => ({ r, i }))
                  .filter(({ r }) => r.comentario.includes("?"))
                  .slice(0, 50)
                  .map(({ r, i }) => (
                    <blockquote key={i}>
                      {r.comentario}
                      <small>
                        {String(r.autor ?? "Autor não informado")} · Registro{" "}
                        {i + 1}
                      </small>
                    </blockquote>
                  ))}
              </>
            )}
            {tab === "report" && (
              <>
                <p>
                  Guarde aqui o relatório recebido do Analista de Dores. É uma
                  interpretação externa; o LowWave não verifica suas conclusões
                  e não altera os comentários originais.
                </p>
                <label>
                  Relatório recebido
                  <textarea
                    rows={18}
                    aria-label="Relatório recebido"
                    value={current.report}
                    onChange={(e) => update({ report: e.target.value })}
                  />
                </label>
                <label>
                  Importar relatório de texto (.txt ou .md)
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f)
                        void act(async () => {
                          if (f.size > 2 * 1024 * 1024)
                            throw new Error("O relatório deve ter até 2 MB.");
                          update({ report: await f.text() });
                        });
                    }}
                  />
                </label>
              </>
            )}
          </>
        )}
        <footer>
          A biblioteca é local a este navegador. Limpar os dados do site pode
          apagá-la. Use Baixar backup para guardar pesquisas e anotações.
        </footer>
      </main>
    </div>
  );
}
