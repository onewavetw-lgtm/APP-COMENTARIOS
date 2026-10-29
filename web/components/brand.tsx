import Image from "next/image";
export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <a
      className="brand brand--art"
      href={href}
      aria-label="LowWave · Pesquisa de público"
    >
      <span className="brand-frame">
        <Image
          src="/brand/lowwave-logo.png"
          alt="LowWave. Pesquisa de público"
          width={2172}
          height={724}
          sizes="(max-width: 850px) 330px, 290px"
          priority
        />
      </span>
    </a>
  );
}
