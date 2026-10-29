"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./icon";
export default function CopyButton({
  text,
  label = "Copiar",
  disabled = false,
}: {
  text: string;
  label?: string;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    setStatus("idle");
  }, [text]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("idle"), 2200);
    } catch {
      setStatus("error");
    }
  }
  return (
    <span className="copy-control">
      <button
        type="button"
        className="copy-button"
        disabled={disabled || !text}
        onClick={() => void copy()}
        aria-label={status === "copied" ? "Copiado ✓" : label}
      >
        <Icon name={status === "copied" ? "check" : "copy"} />
        <span aria-live="polite">
          {status === "copied" ? "Copiado ✓" : label}
        </span>
      </button>
      {status === "error" && (
        <small role="status">
          Não foi possível copiar. Selecione o texto e copie manualmente.
        </small>
      )}
    </span>
  );
}
