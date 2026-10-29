"use client";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
const curves = [1, -1].flatMap((position) =>
  Array.from({ length: 18 }, (_, i) => {
    const n = i * 2;
    return {
      id: `${position}-${i}`,
      d: `M-${380 - n * 5 * position} -${189 + n * 6}C-${380 - n * 5 * position} -${189 + n * 6} -${312 - n * 5 * position} ${216 - n * 6} ${152 - n * 5 * position} ${343 - n * 6}C${616 - n * 5 * position} ${470 - n * 6} ${684 - n * 5 * position} ${875 - n * 6} ${684 - n * 5 * position} ${875 - n * 6}`,
      width: 0.55 + i * 0.035,
      opacity: 0.08 + i * 0.011,
      duration: 24 + i * 0.6,
      delay: -i * 0.8,
    };
  }),
);
/** Decorative adaptation of the supplied Background Paths, behind the actual LowWave banner. */
export function BackgroundPaths() {
  const ref = useRef<HTMLDivElement>(null),
    [running, setRunning] = useState(false);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () =>
      setRunning(visible && !reduced.matches && !document.hidden);
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            sync();
          })
        : null;
    if (observer && ref.current) observer.observe(ref.current);
    else {
      visible = true;
      sync();
    }
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer?.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="background-paths"
      data-running={running}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 696 316"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        focusable="false"
      >
        {curves.map((path) => (
          <path
            key={path.id}
            d={path.d}
            pathLength="1"
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={path.opacity}
            style={
              {
                "--path-duration": `${path.duration}s`,
                "--path-delay": `${path.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </svg>
    </div>
  );
}
export function AnimatedPhrase({
  text,
  delay = 0,
}: {
  text: string;
  delay?: number;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          <span className="headline-word">
            {Array.from(word).map((letter, j) => (
              <span
                key={j}
                className="headline-letter"
                style={
                  {
                    "--letter-delay": `${delay + index * 70 + j * 20}ms`,
                  } as CSSProperties
                }
              >
                {letter}
              </span>
            ))}
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
