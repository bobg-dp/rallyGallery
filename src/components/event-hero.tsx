"use client";

import { Anton_SC } from "next/font/google";
import Image from "next/image";
import { useEffect, useState } from "react";

const antonSc = Anton_SC({
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const railRed = "#d10f0f";

const checkerboard = {
  backgroundImage:
    "conic-gradient(#1a1714 25%, transparent 0 50%, #1a1714 0 75%, transparent 0)",
  backgroundSize: "40px 40px",
  maskImage: "linear-gradient(to bottom, transparent, #000)",
  WebkitMaskImage: "linear-gradient(to bottom, transparent, #000)",
};

export type HeroSlide = {
  src: string;
  thumb: string;
  alt: string;
  label: string | null;
};

export type HeroSocial = {
  href: string;
  label: string;
};

export function EventHero({
  slides,
  title,
  photoCount,
  socials = [],
}: {
  slides: HeroSlide[];
  title: string;
  photoCount: number;
  socials?: HeroSocial[];
}) {
  const [index, setIndex] = useState(0);
  const signature = slides
    .map((slide) => `${slide.src}\n${slide.label ?? ""}`)
    .join("\n");
  const active = slides.length ? index % slides.length : 0;
  const label = slides[active]?.label;

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [signature, slides.length]);

  return (
    <section className="relative h-dvh w-full overflow-hidden">
      {slides.map((slide, slideIndex) => (
        <Image
          key={`${slide.label ?? "hero"}-${slide.src}`}
          src={slide.src}
          alt={slideIndex === active ? slide.alt : ""}
          fill
          priority={slideIndex === 0}
          unoptimized
          aria-hidden={slideIndex !== active}
          className={`object-cover transition-opacity duration-1000 ${slideIndex === active ? "opacity-100" : "opacity-0"}`}
          sizes="100vw"
        />
      ))}
      <a
        href="https://rallydevil.com"
        className="absolute top-5 left-5 z-10 flex max-w-[calc(100%-8.5rem)] items-center gap-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      >
        <span className="text-[11px] tracking-[0.16em] uppercase">
          powered by
        </span>
        <Image
          src="/brand/rallydevil.png"
          alt="Rallydevil"
          width={128}
          height={22}
          className="h-[22px] w-auto"
        />
      </a>
      <div
        className={`${antonSc.className} pointer-events-none absolute top-[20%] left-[10%] z-10 max-w-[min(70%,calc(90%-7.25rem))] text-white`}
      >
        <h1 className="m-0 text-6xl leading-none md:text-8xl">{title}</h1>
        {label ? (
          <p className="m-0 mt-5 text-3xl leading-none md:mt-16 md:text-5xl">
            {label}
          </p>
        ) : null}
      </div>
      {socials.length ? (
        <ul className="absolute bottom-6 left-[10%] z-10 flex gap-3">
          {socials.map((social) => (
            <li key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className="grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/55"
              >
                <SocialIcon name={social.label} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <a
        href="#galeria"
        aria-label={`Przewiń do galerii, ${photoCount} ${photoWord(photoCount)}`}
        className="absolute inset-y-0 right-0 z-20 grid w-[100px] grid-cols-1 grid-rows-[1fr_auto_auto_1fr] bg-white"
      >
        <span
          aria-hidden
          className="col-start-1 row-start-3 row-span-2"
          style={checkerboard}
        />
        <span className="col-start-1 row-start-1" />
        <span className="col-start-1 row-start-2 flex justify-center">
          <PhotoCount count={photoCount} />
        </span>
        <span className="relative z-10 col-start-1 row-start-3 flex flex-col gap-2 px-3">
          {slides.map((slide, slideIndex) => (
            <span
              key={`${slide.label ?? "miniatura"}-${slide.src}`}
              className={`relative block aspect-[3/2] w-full overflow-hidden ${slideIndex === active ? "outline outline-2" : ""}`}
              style={
                slideIndex === active ? { outlineColor: railRed } : undefined
              }
            >
              <Image
                src={slide.thumb}
                alt=""
                fill
                unoptimized
                aria-hidden
                className="object-cover"
                sizes="72px"
              />
            </span>
          ))}
        </span>
        <span className="relative z-10 col-start-1 row-start-4 flex flex-col items-center">
          <span className="mt-3 w-0.5 flex-1" style={{ background: railRed }} />
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="mt-1 mb-4 h-5 w-5"
            style={{ color: railRed }}
          >
            <path
              d="M5 9l7 7 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </a>
    </section>
  );
}

function photoWord(count: number) {
  const tens = Math.abs(count) % 100;
  const ones = tens % 10;
  if (tens > 10 && tens < 20) return "zdjęć";
  if (ones > 1 && ones < 5) return "zdjęcia";
  if (ones === 1) return "zdjęcie";
  return "zdjęć";
}

function PhotoCount({ count }: { count: number }) {
  const digits = String(Math.max(0, count)).split("");
  return (
    <span className="mb-1 flex flex-col items-center text-ink" aria-hidden>
      {digits.map((digit, index) => (
        <span
          key={`${digit}-${index}`}
          className={`${antonSc.className} text-[1.7rem] leading-none`}
        >
          {digit}
        </span>
      ))}
      <span className="mt-2 flex flex-col items-center text-[13px] leading-none">
        {"Zdjęć".split("").map((letter, index) => (
          <span key={`${letter}-${index}`} className="leading-[1.15]">
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}

function SocialIcon({ name }: { name: string }) {
  if (name === "Facebook") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5"
        fill="currentColor"
      >
        <path d="M14.5 8.5V6.8c0-.7.5-1 1.1-1H17V3h-2.1C12.4 3 11 4.5 11 6.6v1.9H9v2.7h2V21h3.5v-9.8h2.3l.4-2.7h-2.7z" />
      </svg>
    );
  }
  if (name === "Instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M22 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C18.2 5.4 12 5.4 12 5.4s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 9 2 12.2 2 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6zM10 15.5v-6.6l5.2 3.3-5.2 3.3z" />
    </svg>
  );
}
