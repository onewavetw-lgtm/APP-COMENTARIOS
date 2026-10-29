"use client";
import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent,
} from "react";
/** Pointer coordinates belong to this card; scrolling and form controls retain their native behavior. */
export function GlowCard({
  as: Tag = "div",
  children,
  className = "",
  onPointerMove,
  onPointerLeave,
  onFocusCapture,
  onBlurCapture,
  ...props
}: { as?: "div" | "section" | "article" } & HTMLAttributes<HTMLElement>) {
  const frame = useRef<number | null>(null);
  const cancel = () => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  };
  useEffect(() => cancel, []);
  function track(event: PointerEvent<HTMLElement>) {
    onPointerMove?.(event);
    if (
      event.pointerType === "touch" ||
      !matchMedia("(hover: hover) and (pointer: fine)").matches ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const card = event.currentTarget,
      { left, top } = card.getBoundingClientRect();
    const x = event.clientX - left,
      y = event.clientY - top;
    cancel();
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (card.isConnected) {
        card.style.setProperty("--spot-x", `${x}px`);
        card.style.setProperty("--spot-y", `${y}px`);
        card.dataset.spotlight = "pointer";
      }
    });
  }
  return (
    <Tag
      {...props}
      className={`card glow-card ${className}`}
      onPointerMove={track}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        cancel();
        if (!event.currentTarget.matches(":focus-within"))
          delete event.currentTarget.dataset.spotlight;
      }}
      onFocusCapture={(event) => {
        onFocusCapture?.(event);
        cancel();
        event.currentTarget.style.setProperty("--spot-x", "50%");
        event.currentTarget.style.setProperty("--spot-y", "45%");
        event.currentTarget.dataset.spotlight = "focus";
      }}
      onBlurCapture={(event) => {
        onBlurCapture?.(event);
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          cancel();
          delete event.currentTarget.dataset.spotlight;
        }
      }}
    >
      {children}
    </Tag>
  );
}
