import type { Metadata } from "next";
import { connection } from "next/server";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Galeria rajdowa",
  description: "Zdjęcia z rajdu: załogi, miejsca, mapa i oś czasu.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html lang="pl" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
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
