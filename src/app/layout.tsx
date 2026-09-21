import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futuro",
  description: "Operações e automação com roteamento econômico de IA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
