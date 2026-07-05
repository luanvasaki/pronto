import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { RegisterServiceWorker } from "./register-service-worker";
import "./globals.css";

// Hanken Grotesk carrega o texto e os botões; Bricolage Grotesque só
// os títulos; mono só pro código OTP e valor monetário — ver
// design_handoff_pronto/README.md.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Pronto — vagas de trabalho avulso",
  description: "Encontre vagas de trabalho avulso perto de você.",
  icons: {
    apple: "/icons/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pronto",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5531E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${hanken.variable} ${bricolage.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
