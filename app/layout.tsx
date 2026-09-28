import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

// Inter (OFL) disimpan lokal di app/fonts — tidak perlu Google Fonts saat build
// maupun saat dibuka, jadi aman untuk jaringan tertutup.
const inter = localFont({
  src: "./fonts/InterVariable-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DITPIT · Bappenas — Dashboard Wilayah",
  description:
    "Peta tematik dan profil daerah kawasan timur Indonesia — Direktorat PIT, Bappenas.",
};

// Terapkan tema tersimpan sebelum paint pertama (hindari kedip terang→gelap).
const themeBoot = `try{var t=localStorage.getItem('ditpit-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
