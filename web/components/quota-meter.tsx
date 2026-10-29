"use client";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  Quota,
  QuotaAction,
  quotaIdentity,
  quotaUpdate,
  estimatedUsed,
} from "@/lib/quota";
export type QuotaMeterHandle = {
  record: (action: QuotaAction) => Promise<void>;
};
const QuotaMeter = forwardRef<
  QuotaMeterHandle,
  { apiKey: string; busy: boolean }
>(function QuotaMeter({ apiKey, busy }, ref) {
  const [usage, setUsage] = useState<Quota | null>(null),
    [error, setError] = useState(""),
    [limit, setLimit] = useState("10000"),
    [observed, setObserved] = useState("");
  useEffect(() => {
    let cancelled = false;
    setUsage(null);
    setError("");
    setObserved("");
    const refresh = async () => {
      if (!apiKey.trim()) return;
      try {
        const q = await quotaUpdate(await quotaIdentity(apiKey));
        if (!cancelled) {
          setUsage(q);
          setLimit(String(q.limit));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apiKey]);
  useImperativeHandle(
    ref,
    () => ({
      record: async (action) => {
        try {
          const q = await quotaUpdate(await quotaIdentity(apiKey), { action });
          setUsage(q);
        } catch (e) {
          setError((e as Error).message);
        }
      },
    }),
    [apiKey],
  );
  async function adjust() {
    try {
      const reference = Number(limit),
        actual = observed.trim() ? Number(observed) : undefined;
      if (
        !Number.isSafeInteger(reference) ||
        reference < 1 ||
        (actual !== undefined && (!Number.isSafeInteger(actual) || actual < 0))
      )
        throw new Error(
          "Use números inteiros: referência maior que zero e consumo a partir de zero.",
        );
      const q = await quotaUpdate(await quotaIdentity(apiKey), {
        limit: reference,
        ...(actual === undefined ? {} : { observed: actual }),
      });
      setUsage(q);
      setObserved("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const used = usage ? estimatedUsed(usage) : 0,
    percent = usage ? (used / usage.limit) * 100 : 0;
  return (
    <section className="quota-meter" aria-label="Consumo estimado da cota">
      <h4>COTA · ESTIMATIVA LOCAL</h4>
      {!apiKey.trim() ? (
        <p>Informe sua chave para acompanhar as consultas feitas aqui.</p>
      ) : error && !usage ? (
        <p role="status">
          {error} Consulte o Google Cloud para verificar a cota.
        </p>
      ) : !usage ? (
        <p>Carregando contador…</p>
      ) : (
        <>
          <div className="quota-numbers">
            <strong>{Math.round(percent)}%</strong>
            <span>
              {used.toLocaleString("pt-BR")} /{" "}
              {usage.limit.toLocaleString("pt-BR")} unidades
            </span>
          </div>
          <progress
            aria-label="Uso estimado da referência diária"
            value={Math.min(used, usage.limit)}
            max={usage.limit}
            className={
              percent >= 90
                ? "quota-high"
                : percent >= 75
                  ? "quota-warning"
                  : ""
            }
          />
          <p>
            {usage.checkedAt
              ? "Estimativa com ajuste manual."
              : "Uso registrado neste navegador; não é o saldo real do projeto."}
          </p>
          {percent >= 75 && (
            <p className="quota-alert">
              {percent >= 100
                ? "A estimativa atingiu a referência diária."
                : "A estimativa está perto da referência diária."}{" "}
              Confira o Google Cloud antes de ampliar a coleta.
            </p>
          )}
          {error && <p role="status">{error}</p>}
          <details>
            <summary>Conferir e ajustar referência</summary>
            <p>
              Não inclui uso anterior à instalação do contador, outros
              computadores, o app Windows ou outras chaves do mesmo projeto.
            </p>
            <p>
              Custos adotados: busca 100 unidades por página; consulta de vídeos
              e de comentários 1 por página. Todas as tentativas são contadas,
              inclusive falhas que podem não chegar ao YouTube.
            </p>
            <p>
              Dia da contagem: {usage.day}. A virada segue o horário do
              Pacífico, usado pela cota diária do YouTube.
            </p>
            <p>
              Buscas: {usage.attempts.search} · Vídeos: {usage.attempts.videos}{" "}
              · Páginas de comentários: {usage.attempts.comments}
            </p>
            <fieldset disabled={busy}>
              <label>
                Referência diária em unidades
                <input
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </label>
              <label>
                Consumo total de hoje no Google Cloud (opcional)
                <input
                  type="number"
                  min={0}
                  value={observed}
                  onChange={(e) => setObserved(e.target.value)}
                  placeholder="Digite somente se conferiu no Cloud"
                />
              </label>
              <button onClick={() => void adjust()}>Salvar referência</button>
            </fieldset>
            <p>
              Um valor informado ajusta o total estimado; novas tentativas são
              acrescentadas a partir dele. No próximo dia, a contagem começa
              novamente.
            </p>
            <a
              href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
              target="_blank"
              rel="noreferrer"
            >
              Conferir cota no Google Cloud ↗
            </a>
          </details>
        </>
      )}
    </section>
  );
});
export default QuotaMeter;
