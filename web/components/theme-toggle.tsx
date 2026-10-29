"use client";
import { useEffect, useState } from "react";
export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark"),
    [message, setMessage] = useState("");
  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "light" ? "light" : "dark",
    );
    const sync = (event: StorageEvent) => {
      if (event.key === "lowwave-theme") {
        const next = event.newValue === "light" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        setTheme(next);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    setMessage("");
    try {
      localStorage.setItem("lowwave-theme", next);
    } catch {
      setMessage(
        "Tema aplicado. Não foi possível salvar a preferência neste navegador.",
      );
    }
  }
  return (
    <div className="theme-control">
      <button
        className="theme-toggle"
        type="button"
        onClick={toggle}
        aria-label={
          theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
        }
        title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {theme === "dark" ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
            </>
          ) : (
            <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />
          )}
        </svg>
        {theme === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
