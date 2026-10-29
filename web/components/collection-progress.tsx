"use client";
import { useEffect, useId, useState } from "react";
import type { Job } from "@/lib/model";
import {
  collectionProgress,
  readingSteps,
  secondsLeft,
} from "@/lib/presentation";
import Icon from "./icon";
export function useCountdown(deadline: number) {
  const [value, setValue] = useState(() => secondsLeft(deadline));
  useEffect(() => {
    const tick = () => setValue(secondsLeft(deadline));
    tick();
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [deadline]);
  return deadline ? value : 0;
}
export function RetryCountdown({
  seconds,
  automatic,
}: {
  seconds: number;
  automatic: boolean;
}) {
  return (
    <div className="retry-countdown">
      <Icon name="clock" />
      <div>
        <strong>Limite temporário do YouTube</strong>
        <p>
          {automatic
            ? "Repetiremos somente a página pendente em"
            : "Você poderá continuar a coleta em"}{" "}
          <time>
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")}
          </time>
          .
        </p>
        <small>O progresso salvo será preservado.</small>
      </div>
    </div>
  );
}
export default function CollectionProgress({
  job,
  running,
  waiting,
}: {
  job: Job;
  running: boolean;
  waiting: boolean;
}) {
  const { determinate, percent } = collectionProgress(job);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const path =
    "M0 20 Q12.5 4 25 20 " +
    Array.from({ length: 43 }, (_, i) => `T${(i + 2) * 25} 20`).join(" ");
  return (
    <div className="collection-progress">
      <div className="progress-heading">
        <span>
          {determinate
            ? `${job.video} de ${job.selected.length} vídeos processados`
            : "Preparando a seleção de vídeos"}
        </span>
        <strong>
          {determinate
            ? `${percent}%`
            : waiting
              ? "Aguardando"
              : running
                ? "Em andamento"
                : "Pausado"}
        </strong>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso da coleta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? percent : undefined}
        aria-valuetext={
          determinate
            ? `${percent}% dos vídeos processados`
            : "Quantidade de vídeos ainda em definição"
        }
        className={`wave-progress ${running && !waiting ? "is-running" : ""} ${determinate ? "" : "is-indeterminate"}`}
      >
        <svg
          viewBox="0 0 1000 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={`wave-${id}`}>
              <rect width={determinate ? percent * 10 : 1000} height="40" />
            </clipPath>
            <linearGradient id={`ink-${id}`}>
              <stop stopColor="#9470f5" />
              <stop offset="1" stopColor="#cfb2ff" />
            </linearGradient>
          </defs>
          <path className="wave-track" d={path} />
          <g clipPath={`url(#wave-${id})`}>
            <path className="wave-ink" d={path} stroke={`url(#ink-${id})`} />
          </g>
        </svg>
      </div>
      <ul className="reading-steps">
        {readingSteps(job).map((step) => (
          <li
            key={step.label}
            className={
              step.done
                ? "is-done"
                : step.active && running && !waiting
                  ? "is-reading"
                  : ""
            }
          >
            <span className="reading-indicator">
              {step.done ? (
                <Icon name="check" />
              ) : step.active && running && !waiting ? (
                <span className="loading-line" />
              ) : (
                <span className="step-dot" />
              )}
            </span>
            <span>{step.label}</span>
            <small>
              {step.done
                ? "Etapa encerrada"
                : step.active
                  ? waiting
                    ? "Aguardando"
                    : running
                      ? "Em leitura"
                      : "Pausada"
                  : "Pendente"}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}
