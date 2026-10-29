import type { Metadata } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";
import "./themes.css";
import MotionEffects from "@/components/motion-effects";
export const metadata: Metadata = {
  title: "LowWave · Pesquisa de público",
  description:
    "Comentários reais, fontes verificáveis e exportação para análise.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('lowwave-theme')==='light'?'light':'dark'}catch{}`,
          }}
        />
      </head>
      <body>
        <MotionEffects />
        {children}
      </body>
    </html>
  );
}
