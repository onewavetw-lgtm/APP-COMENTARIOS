import type { Metadata } from "next";
import "./globals.css";
import MotionEffects from "@/components/motion-effects";
export const metadata: Metadata = {
  title: "LowWave · Pesquisa de público",
  description:
    "Comentários reais, fontes verificáveis e exportação para análise.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <MotionEffects />
        {children}
      </body>
    </html>
  );
}
