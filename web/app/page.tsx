"use client";
import { useEffect, useRef, useState } from "react";
import {
  Job,
  Settings,
  parseLinks,
  newJob,
  analysisFile,
  csvFile,
  filteredRows,
  textFile,
} from "@/lib/model";
import { advance, RequestError, YouTubeData } from "@/lib/engine";
import { loadJob, saveJob } from "@/lib/storage";
import { archiveLegacyJob } from "@/lib/library";
import QuotaMeter, { QuotaMeterHandle } from "@/components/quota-meter";
import type { QuotaAction } from "@/lib/quota";
import { DEFAULT_KEYWORDS, DEFAULT_PROMPT } from "@/lib/defaults";
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [key, setKey] = useState(""),
    [terms, setTerms] = useState("motobomba a gasolina"),
    [links, setLinks] = useState(""),
    [onlyLinks, setOnlyLinks] = useState(false);
  const [pages, setPages] = useState(1),
    [videos, setVideos] = useState(15),
    [perVideo, setPerVideo] = useState(200),
    [days, setDays] = useState(0),
    [order, setOrder] = useState("relevance"),
    [minimum, setMinimum] = useState(1),
    [letters, setLetters] = useState(20),
    [maxText, setMaxText] = useState(300),
    [painOnly, setPainOnly] = useState(false),
    [keywords, setKeywords] = useState(DEFAULT_KEYWORDS),
    [prompt, setPrompt] = useState(DEFAULT_PROMPT),
    [includePrompt, setIncludePrompt] = useState(true),
    [section, setSection] = useState("search");
  const [job, setJob] = useState<Job | null>(null),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("sources"),
    [cooldown, setCooldown] = useState(0);
  const quotaMeter = useRef<QuotaMeterHandle>(null);
  const active = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    loadJob()
      .then(async (saved) => {
        setJob(saved);
        if (saved) {
          await archiveLegacyJob(saved);
          setTerms(saved.settings.terms.join("\n"));
          setLinks(
            saved.settings.links
              .map((id) => `https://www.youtube.com/watch?v=${id}`)
              .join("\n"),
          );
          setOnlyLinks(saved.settings.onlyLinks);
          setPages(saved.settings.pages);
          setVideos(saved.settings.videos);
          setPerVideo(saved.settings.perVideo);
          setDays(saved.settings.days);
          setOrder(saved.settings.order);
          setMinimum(saved.settings.minimum);
          setLetters(saved.settings.letters);
          setMaxText(saved.settings.maxText);
          setPainOnly(saved.settings.painOnly);
          setKeywords(saved.settings.keywords.join(", "));
          setPrompt(saved.settings.prompt ?? DEFAULT_PROMPT);
          setIncludePrompt(saved.settings.includePrompt !== false);
        }
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setReady(true));
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(
      () => setCooldown((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);
  async function run(initial: Job) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    let current = initial;
    controller.current = new AbortController();
    try {
      await saveJob(current);
      setJob(current);
      const api = async (
        params: Record<string, unknown>,
      ): Promise<YouTubeData> => {
        // Serial requests only. Waits happen in the browser, never inside a serverless function.
        for (let attempt = 0; attempt < 4; attempt++) {
          if (!active.current)
            throw new Error(
              "Pesquisa pausada. Você pode continuar de onde parou.",
            );
          await quotaMeter.current?.record(params.action as QuotaAction);
          if (!active.current) throw new Error("Pesquisa pausada.");
          const response = await fetch("/api/youtube", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...params, key: key.trim() }),
            signal: controller.current!.signal,
            cache: "no-store",
          });
          const data = await response.json();
          if (response.ok) return data;
          if (
            response.status === 429 &&
            attempt < 3 &&
            (data.retryAfter ?? 30) <= 60
          ) {
            const wait = Math.max(data.retryAfter ?? 30, 2 ** (attempt + 1));
            setMessage(
              `Limite temporário: aguardando ${wait}s para repetir somente esta página.`,
            );
            for (let second = 0; second < wait; second++) {
              await new Promise((r) => setTimeout(r, 1000));
              if (!active.current) throw new Error("Pesquisa pausada.");
            }
            continue;
          }
          if (response.status === 429) setCooldown(data.retryAfter ?? 30);
          throw new RequestError(
            data.error ?? "Falha na consulta.",
            response.status,
            data.retryAfter ?? 0,
          );
        }
        throw new Error("Não foi possível concluir a página.");
      };
      while (active.current && current.phase !== "done") {
        const next = await advance(current, api);
        await saveJob(next);
        current = next;
        setJob(next);
        setMessage("");
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch (e) {
      setMessage(
        controller.current?.signal.aborted
          ? "Pesquisa pausada. Continue quando quiser."
          : e instanceof Error
            ? e.message
            : "Falha na coleta.",
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  function start() {
    try {
      if (!key.trim()) throw new Error("Informe sua chave do YouTube.");
      const queries = [
        ...new Set(
          terms
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ];
      const ids = parseLinks(links);
      if (queries.length > 10 || queries.some((q) => q.length > 250))
        throw new Error("Use até 10 buscas, com até 250 caracteres cada.");
      if (onlyLinks ? !ids.length : !queries.length && !ids.length)
        throw new Error("Informe um tema ou link.");
      if (
        job &&
        !window.confirm(
          "Iniciar outra pesquisa substituirá o progresso salvo neste navegador. Você já exportou os dados atuais?",
        )
      )
        return;
      const settings: Settings = {
        terms: onlyLinks ? [] : queries,
        links: ids,
        onlyLinks: onlyLinks || !queries.length,
        pages,
        videos,
        perVideo,
        days,
        order,
        minimum,
        letters,
        maxText,
        painOnly,
        prompt,
        includePrompt,
        keywords: keywords
          .split(",")
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      };
      void run(newJob(settings));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function navigate(target: string) {
    setSection(target);
    const element = document.getElementById(target);
    if (element instanceof HTMLDetailsElement) element.open = true;
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    element?.focus({ preventScroll: true });
  }
  async function applyExportSettings() {
    if (!job || active.current) return;
    const updated: Job = {
      ...job,
      settings: {
        ...job.settings,
        letters,
        maxText,
        painOnly,
        prompt,
        includePrompt,
        keywords: keywords
          .split(",")
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      },
    };
    setJob(updated);
    try {
      await saveJob(updated);
      setMessage(
        "Filtros e prompt aplicados aos dados salvos. Nenhuma consulta ao YouTube foi feita.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const selected = job ? filteredRows(job) : [];
  const stage =
    job?.phase === "search"
      ? `Buscando tema ${job.term + 1}/${job.settings.terms.length}, página ${job.page + 1}`
      : job?.phase === "details"
        ? "Conferindo os vídeos encontrados"
        : job?.phase === "comments"
          ? `Lendo vídeo ${job.video + 1}/${job.selected.length}`
          : job
            ? "Coleta concluída"
            : "Pronto para começar";
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#search">
          <b>≋</b>
          <span>
            LowWave<span className="cyan">.</span>
            <small>PESQUISA DE PÚBLICO</small>
          </span>
        </a>
        <nav>
          <a href="/biblioteca">▤ Biblioteca de pesquisas</a>
          {[
            ["search", "◎ Nova pesquisa"],
            ["results", "▤ Resultados e fontes"],
            ["filters", "◇ Palavras de dor e filtros"],
            ["prompts", "✎ Prompt para o ChatGPT"],
            ["export", "↗ Exportar pesquisa"],
          ].map(([target, label]) => (
            <a
              key={target}
              href={`#${target}`}
              aria-current={section === target ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(target);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <label className="key">
          CHAVE DO YOUTUBE
          <input
            aria-label="Chave YouTube API"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={busy}
            placeholder="Sua chave de API"
          />
        </label>
        <p className="muted">
          A chave fica nesta sessão e é enviada por conexão segura ao servidor
          para consultar o YouTube. Não é salva no progresso.
        </p>
        <QuotaMeter ref={quotaMeter} apiKey={key} busy={busy} />
        <hr />
        <h4>SEU FLUXO</h4>
        <p>01 · Pesquise o público</p>
        <p>02 · Confira as fontes</p>
        <p>03 · Exporte para seu agente</p>
        <footer>
          LOWWAVE / VERSÃO WEB
          <br />
          Em desenvolvimento para Vercel
        </footer>
      </aside>
      <main>
        <header>
          <span>Seu espaço / Pesquisa de público</span>
          <span className="pill">YOUTUBE DATA API</span>
        </header>
        <section className="hero">
          <small>ESCUTE O PÚBLICO. ENCONTRE O PRÓXIMO PASSO.</small>
          <h1>
            Sua próxima descoberta
            <br />
            <em>começa aqui.</em>
          </h1>
          <p>
            Reúna comentários, confira as fontes e leve as evidências para seu
            agente.
          </p>
        </section>
        <div className="steps">
          01 Pesquisar <i /> 02 Conferir fontes <i /> 03 Levar para análise
        </div>
        <div id="search" className="grid" tabIndex={-1}>
          <section>
            <div className="card">
              <small>NOVA PESQUISA</small>
              <h2>Quem você quer entender?</h2>
              <p>
                O título não precisa mencionar uma dor. Explore temas,
                avaliações e demonstrações.
              </p>
              <label>
                Tema ou buscas — uma por linha
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  disabled={busy}
                  rows={5}
                />
              </label>
            </div>
            <details>
              <summary>Ajustar coleta e filtros</summary>
              <fieldset disabled={busy}>
                <div className="controls">
                  {[
                    ["Vídeos", videos, setVideos, 1, 50],
                    ["Comentários por vídeo", perVideo, setPerVideo, 50, 500],
                    ["Páginas por busca", pages, setPages, 1, 3],
                    [
                      "Últimos dias (0 = qualquer época)",
                      days,
                      setDays,
                      0,
                      5475,
                    ],
                    [
                      "Mínimo de comentários no vídeo",
                      minimum,
                      setMinimum,
                      1,
                      100,
                    ],
                  ].map(([label, value, set, min, max]) => (
                    <label key={String(label)}>
                      {String(label)}
                      <input
                        type="number"
                        min={Number(min)}
                        max={Number(max)}
                        value={Number(value)}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          (set as (n: number) => void)(
                            Math.max(Number(min), Math.min(Number(max), n)),
                          );
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Priorizar vídeos
                  <select
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                  >
                    <option value="relevance">Relevância</option>
                    <option value="viewCount">Mais visualizações</option>
                  </select>
                </label>
                <p>
                  Mais páginas consomem mais cota. Português é uma preferência,
                  não um filtro estrito de idioma.
                </p>
              </fieldset>
            </details>
            <details id="filters" tabIndex={-1}>
              <summary>Palavras de dor e filtros do texto</summary>
              <fieldset disabled={busy}>
                <div className="controls">
                  <label>
                    Mínimo de letras por comentário
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={letters}
                      onChange={(e) =>
                        setLetters(
                          Math.max(10, Math.min(100, Number(e.target.value))),
                        )
                      }
                    />
                  </label>
                  <label>
                    Máximo no texto filtrado
                    <input
                      type="number"
                      min={50}
                      max={1000}
                      value={maxText}
                      onChange={(e) =>
                        setMaxText(
                          Math.max(50, Math.min(1000, Number(e.target.value))),
                        )
                      }
                    />
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={painOnly}
                    onChange={(e) => setPainOnly(e.target.checked)}
                  />
                  Manter só comentários com palavras de dor
                </label>
                <label>
                  Palavras de dor (separadas por vírgula)
                  <textarea
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    rows={4}
                  />
                </label>
                <p>
                  Para descobrir dores que você ainda não conhece, deixe o
                  filtro desmarcado. As palavras filtram a prévia e o TXT. O
                  JSON e o CSV mantêm todos os comentários baixados.
                </p>
                {job && (
                  <button onClick={() => void applyExportSettings()}>
                    Aplicar aos comentários salvos
                  </button>
                )}
              </fieldset>
            </details>
            <details id="prompts" tabIndex={-1}>
              <summary>Orientação para a análise no ChatGPT</summary>
              <fieldset disabled={busy}>
                <p>
                  Esta orientação acompanha o JSON e pode abrir o TXT. Ela não
                  restringe a busca no YouTube.
                </p>
                <label>
                  Prompt para o ChatGPT (editável)
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={12}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={includePrompt}
                    onChange={(e) => setIncludePrompt(e.target.checked)}
                  />
                  Incluir prompt no início do TXT
                </label>
                <p>
                  Use {"{assunto}"} para inserir automaticamente os temas
                  pesquisados.
                </p>
                <div className="actions">
                  <button onClick={() => setPrompt(DEFAULT_PROMPT)}>
                    Restaurar prompt padrão
                  </button>
                  {job && (
                    <button onClick={() => void applyExportSettings()}>
                      Aplicar prompt à pesquisa salva
                    </button>
                  )}
                </div>
              </fieldset>
            </details>
            <details>
              <summary>Incluir vídeos específicos por link</summary>
              <label>
                Um link por linha
                <textarea
                  value={links}
                  onChange={(e) => setLinks(e.target.value)}
                  disabled={busy}
                  rows={3}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={onlyLinks}
                  onChange={(e) => setOnlyLinks(e.target.checked)}
                  disabled={busy}
                />
                Coletar somente estes links
              </label>
              <p>
                Links têm prioridade e ignoram o período e o mínimo de
                comentários. Vídeos privados ou com comentários desativados
                podem não ser coletados.
              </p>
            </details>
            <button
              className="primary full"
              onClick={start}
              disabled={!ready || busy || cooldown > 0}
            >
              ⌕ Iniciar nova coleta
            </button>
          </section>
          <section>
            <div className="card">
              <small>ANTES DE COMEÇAR</small>
              <h2>Sua próxima coleta</h2>
              <div className="stats two">
                <div>
                  <strong>{videos}</strong>vídeos · até
                </div>
                <div>
                  <strong>{perVideo}</strong>comentários por vídeo
                </div>
              </div>
              <p>Período: {days ? `${days} dias` : "qualquer época"}</p>
              <p>
                As consultas são sequenciais. Você pode pausar e continuar com o
                progresso salvo neste navegador.
              </p>
            </div>
          </section>
        </div>
        {message && (
          <div role="status" className="notice">
            {message}
          </div>
        )}
        {cooldown > 0 && <p>Nova tentativa disponível em {cooldown}s.</p>}
        <section id="results" tabIndex={-1}>
          {job ? (
            <>
              <div className="sectionTitle">
                <div>
                  <small>SUA PESQUISA</small>
                  <h2>{stage}</h2>
                </div>
                <div className="actions">
                  {busy ? (
                    <button
                      onClick={() => {
                        active.current = false;
                        controller.current?.abort();
                      }}
                    >
                      Pausar
                    </button>
                  ) : (
                    job.phase !== "done" && (
                      <button
                        disabled={!key.trim() || cooldown > 0}
                        onClick={() => void run(job)}
                      >
                        Continuar coleta
                      </button>
                    )
                  )}
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        window.confirm(
                          "Apagar o progresso salvo neste navegador?",
                        )
                      ) {
                        await saveJob(null);
                        setJob(null);
                      }
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <p className="muted">
                Configuração desta pesquisa:{" "}
                {job.settings.terms.join(" · ") || "Links informados"}. O
                progresso não é sincronizado entre dispositivos.
              </p>
              <div className="stats">
                <div>
                  <strong>{job.selected.length}</strong>vídeos selecionados
                </div>
                <div>
                  <strong>{job.video}</strong>vídeos finalizados
                </div>
                <div>
                  <strong>{job.rows.length}</strong>comentários baixados
                </div>
                <div>
                  <strong>{selected.length}</strong>selecionados para texto
                </div>
              </div>
              <progress
                aria-label="Progresso dos vídeos"
                value={job.phase === "done" ? 1 : job.video}
                max={
                  job.phase === "done" ? 1 : Math.max(1, job.selected.length)
                }
              />
              <div className="tabs">
                <button
                  aria-pressed={tab === "sources"}
                  onClick={() => setTab("sources")}
                >
                  Vídeos e fontes
                </button>
                <button
                  aria-pressed={tab === "comments"}
                  onClick={() => setTab("comments")}
                >
                  Comentários selecionados
                </button>
              </div>
              {tab === "sources" ? (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Vídeo</th>
                        <th>Visualizações</th>
                        <th>Baixados</th>
                        <th>Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.selected.map((v) => (
                        <tr key={v.id}>
                          <td>
                            {v.title}
                            <small>{v.channel}</small>
                          </td>
                          <td>{v.views.toLocaleString("pt-BR")}</td>
                          <td>
                            {job.rows.filter((r) => r.id_video === v.id).length}
                          </td>
                          <td>
                            <a href={v.url} target="_blank" rel="noreferrer">
                              Abrir vídeo ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!job.selected.length && (
                    <p>
                      A seleção aparecerá após conferir os resultados da busca.
                    </p>
                  )}
                </div>
              ) : (
                <div className="comments">
                  {selected.slice(0, 100).map((r, i) => (
                    <blockquote key={i}>
                      <strong>{r.autor || "Autor não informado"}</strong>
                      <p>{r.comentario}</p>
                      <small>
                        {r.video} · {r.curtidas} curtidas
                      </small>
                    </blockquote>
                  ))}
                  {selected.length > 100 && (
                    <p>Prévia dos primeiros 100. A exportação inclui todos.</p>
                  )}
                </div>
              )}
              {job.warnings.map((w, i) => (
                <p className="notice" key={i}>
                  {w}
                </p>
              ))}
            </>
          ) : (
            <div className="empty">
              <h2>Resultados e fontes</h2>
              <p>
                Os vídeos e comentários aparecerão aqui depois de iniciar uma
                coleta. Nenhuma pesquisa foi feita ainda.
              </p>
            </div>
          )}
        </section>
        <section id="export" className="card export" tabIndex={-1}>
          {job && job.rows.length > 0 ? (
            <>
              <small>LEVAR PARA SEU AGENTE</small>
              <h2>Uma pesquisa. Um arquivo. Tudo para analisar.</h2>
              <p>
                {job.rows.length} comentários baixados com IDs, fontes e
                instruções.{" "}
                {job.phase !== "done" && (
                  <strong>Coleta parcial: há etapas pendentes.</strong>
                )}
              </p>
              <button
                className="primary full"
                onClick={() =>
                  download(
                    "lowwave-analise.json",
                    JSON.stringify(analysisFile(job), null, 2),
                    "application/json",
                  )
                }
              >
                ↓ Baixar para análise
              </button>
              <p>
                Mesmo formato do aplicativo local. O arquivo reúne todos os
                registros baixados, não apenas os filtrados. O agente continua
                responsável pela análise.
              </p>
              <details>
                <summary>Outros formatos</summary>
                <div className="actions">
                  <button
                    onClick={() =>
                      download("lowwave-dados.csv", csvFile(job), "text/csv")
                    }
                  >
                    Baixar CSV
                  </button>
                  <button
                    onClick={() =>
                      download(
                        "lowwave-comentarios.txt",
                        textFile(job),
                        "text/plain",
                      )
                    }
                  >
                    Baixar TXT filtrado
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <h2>Exportar pesquisa</h2>
              <p>
                Quando houver comentários baixados, você poderá baixar o JSON
                para seu agente, o CSV completo ou o TXT filtrado.
              </p>
            </>
          )}
        </section>
        <footer>
          LowWave Web · A cota do YouTube continua valendo. Esta ferramenta não
          classifica dores automaticamente.
        </footer>
      </main>
    </div>
  );
}
