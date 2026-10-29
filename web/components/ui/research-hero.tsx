"use client";
import { AnimatedPhrase, BackgroundPaths } from "./background-paths";
import Icon from "../icon";
/** Horizon composition adapted to the actual research workflow, not the demo's availability claims. */
export default function ResearchHero({
  onStart,
  busy = false,
}: {
  onStart: () => void;
  busy?: boolean;
}) {
  return (
    <section className="hero hero-horizon" aria-labelledby="lowwave-manifesto">
      <div className="hero-aura" aria-hidden="true">
        <div className="aura-core" />
      </div>
      <div className="horizon-light" aria-hidden="true">
        <div className="horizon-rim" />
        <div className="horizon-haze" />
      </div>
      <BackgroundPaths />
      <div className="hero-frame-corners" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="hero-content">
        <small className="hero-eyebrow">
          <span />
          ESCUTE O PÚBLICO. ENCONTRE O PRÓXIMO PASSO.
        </small>
        <h1
          id="lowwave-manifesto"
          aria-label="are we ever gonna be better than this?"
        >
          <span aria-hidden="true">
            <AnimatedPhrase text="are we ever gonna be" />
          </span>
          <br />
          <em aria-hidden="true">
            <AnimatedPhrase text="better than this?" delay={260} />
          </em>
        </h1>
        <p>
          As próximas ideias começam com quem você escuta. Reúna comentários,
          confira as fontes e leve as evidências para seu agente.
        </p>
        <div className="hero-actions">
          <button type="button" className="liquid-button" onClick={onStart}>
            <Icon name={busy ? "eye" : "search"} />
            <span>{busy ? "Ver coleta em andamento" : "Começar pesquisa"}</span>
            <Icon name="arrow" />
          </button>
          <a className="hero-library-link" href="/biblioteca">
            <Icon name="library" />
            Abrir biblioteca
          </a>
        </div>
        <div className="hero-signature">
          <span className="signature-line" />
          LOWWAVE <span>/</span> STAY CURIOUS.
          <span className="signature-line" />
        </div>
      </div>
    </section>
  );
}
