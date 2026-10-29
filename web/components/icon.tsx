import type { SVGProps } from "react";
const paths = {
  search: "M21 21l-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  library: "M3 3h5v18H3zM11 3h4v18h-4zM17 4l3-1 3 17-3 1z",
  filter: "M4 6h16M7 12h10M10 18h4",
  prompt: "M4 4h16v12H8l-4 4V4zM8 8h8M8 12h5",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  check: "m5 12 4 4L19 6",
  copy: "M9 9h12v12H9zM15 5V3H3v12h2",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M18 6 6 18",
  pause: "M8 4v16M16 4v16",
  play: "m8 4 12 8-12 8V4z",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
};
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
