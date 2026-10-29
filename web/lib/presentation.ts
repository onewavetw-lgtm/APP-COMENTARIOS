import type { Job } from "./model";
export function collectionProgress(job: Job) {
  const determinate = job.phase === "comments" || job.phase === "done";
  return {
    determinate,
    percent:
      job.phase === "done"
        ? 100
        : job.phase === "comments"
          ? Math.min(
              100,
              Math.floor((job.video / Math.max(1, job.selected.length)) * 100),
            )
          : 0,
  };
}
export function readingSteps(job: Job) {
  return [
    {
      label: job.settings.onlyLinks ? "Links informados" : "Buscar vídeos",
      done: job.phase !== "search",
      active: job.phase === "search",
    },
    {
      label: "Conferir dados dos vídeos",
      done: job.phase === "comments" || job.phase === "done",
      active: job.phase === "details",
    },
    {
      label: "Ler comentários",
      done: job.phase === "done",
      active: job.phase === "comments",
    },
  ];
}
export function secondsLeft(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function waitUntil(deadline: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Pesquisa pausada", "AbortError"));
    };
    const tick = () => {
      if (signal.aborted) {
        abort();
        return;
      }
      const left = deadline - Date.now();
      if (left <= 0) {
        cleanup();
        resolve();
      } else timer = setTimeout(tick, Math.min(left, 1000));
    };
    signal.addEventListener("abort", abort, { once: true });
    tick();
  });
}
