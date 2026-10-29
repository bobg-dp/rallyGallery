import type { Metadata } from "next";
import { connection } from "next/server";
import { Saira_Condensed } from "next/font/google";
import { shareImage } from "@/lib/share-image";
import "./globals.css";

const saira = Saira_Condensed({
  weight: ["400", "900"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-saira",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rajdsniezki.rallydevil.com"),
  title: "Galeria rajdowa",
  description: "Zdjęcia z rajdu: załogi, miejsca i mapa.",
  openGraph: {
    title: "Rajd Śnieżki 2026 | Największa galeria zdjęć",
    description: "Największa galeria zdjęć z rajdu.",
    locale: "pl_PL",
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [shareImage],
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="pl" className={`${saira.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper text-ink">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var nav=performance.getEntriesByType("navigation")[0];var y=Number(sessionStorage.getItem("gallery-y:"+location.pathname)||0);if(!nav||(nav.type!=="reload"&&nav.type!=="back_forward")||!(y>40))return;var root=document.documentElement;root.style.scrollBehavior="auto";root.style.visibility="hidden";var id=0;var apply=function(){root.scrollTop=y;if(document.body)document.body.scrollTop=y;if(Math.abs(window.scrollY-y)<8){root.style.visibility="";if(id){clearInterval(id);id=0;}}};apply();document.addEventListener("DOMContentLoaded",apply);window.addEventListener("load",apply);id=setInterval(apply,50);setTimeout(function(){if(id)clearInterval(id);root.style.visibility="";},2000);}catch(e){document.documentElement.style.visibility="";}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
