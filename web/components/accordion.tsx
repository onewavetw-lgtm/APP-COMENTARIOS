"use client";
import {
  Children,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";
export default function Accordion({
  children,
  ...props
}: ComponentPropsWithoutRef<"details">) {
  const ref = useRef<HTMLDetailsElement>(null),
    animation = useRef<Animation | null>(null),
    target = useRef(false);
  useEffect(() => () => animation.current?.cancel(), []);
  function animate(open: boolean, from: number) {
    const el = ref.current;
    if (!el) return;
    animation.current?.cancel();
    target.current = open;
    if (open) el.open = true;
    const end = open
      ? el.scrollHeight
      : (el.querySelector("summary")?.getBoundingClientRect().height ?? 0) +
        parseFloat(getComputedStyle(el).paddingTop) +
        parseFloat(getComputedStyle(el).paddingBottom) +
        2;
    el.style.overflow = "hidden";
    const current = el.animate(
      { height: [`${from}px`, `${end}px`] },
      { duration: 220, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    animation.current = current;
    current.onfinish = () => {
      el.open = open;
      el.style.overflow = "";
      animation.current = null;
    };
  }
  const nodes = Children.toArray(children);
  return (
    <details
      {...props}
      ref={ref}
      className={`accordion ${props.className ?? ""}`}
      onClick={(event) => {
        const el = ref.current,
          summary = (event.target as Element).closest("summary");
        if (
          !el ||
          summary?.parentElement !== el ||
          matchMedia("(prefers-reduced-motion: reduce)").matches ||
          typeof el.animate !== "function"
        )
          return;
        event.preventDefault();
        const from = el.getBoundingClientRect().height;
        animate(animation.current ? !target.current : !el.open, from);
      }}
      onToggle={() => {
        const el = ref.current;
        if (
          el?.open &&
          !animation.current &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches &&
          typeof el.animate === "function"
        ) {
          const summary = el.querySelector("summary");
          animate(
            true,
            (summary?.getBoundingClientRect().height ?? 0) +
              parseFloat(getComputedStyle(el).paddingTop) +
              parseFloat(getComputedStyle(el).paddingBottom) +
              2,
          );
        }
      }}
    >
      {nodes[0]}
      <div className="accordion-body">{nodes.slice(1)}</div>
    </details>
  );
}
