"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Brand from "./brand";
import Icon from "./icon";
export default function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false),
    [mobile, setMobile] = useState(false);
  const id = useId();
  const panel = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    const query = matchMedia("(max-width: 850px)");
    const sync = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>(".sidebar-close")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ) ?? [],
        ).filter((el) => el.getClientRects().length > 0);
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
    };
  }, [open, mobile]);
  return (
    <>
      <div className="mobile-topbar">
        <Brand />
        <button
          ref={trigger}
          className="menu-toggle"
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
          Menu
        </button>
      </div>
      {open && mobile && (
        <div className="drawer-backdrop" aria-hidden="true" onClick={close} />
      )}
      <aside
        ref={panel}
        id={id}
        className={`sidebar ${open ? "is-open" : ""}`}
        role={mobile && open ? "dialog" : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="Menu principal"
        aria-hidden={mobile && !open ? true : undefined}
        inert={mobile && !open}
        onClick={(e) => {
          if (mobile && (e.target as Element).closest("a")) close();
        }}
      >
        <button
          className="sidebar-close"
          aria-label="Fechar menu"
          onClick={close}
        >
          <Icon name="close" />
          Fechar
        </button>
        {children}
      </aside>
    </>
  );
}
