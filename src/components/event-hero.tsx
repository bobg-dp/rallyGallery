"use client";

import { Anton_SC } from "next/font/google";
import Image from "next/image";
import { useEffect, useState } from "react";

const antonSc = Anton_SC({
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export type HeroSlide = {
  src: string;
  alt: string;
  label: string | null;
};

export function EventHero({ slides, title }: { slides: HeroSlide[]; title: string }) {
  const [index, setIndex] = useState(0);
  const signature = slides.map((slide) => `${slide.src}\n${slide.label ?? ""}`).join("\n");
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
      <h1 className={`${antonSc.className} pointer-events-none absolute top-[20%] left-[10%] z-10 m-0 max-w-[70%] text-6xl leading-none text-white md:text-8xl`}>
        {title}
      </h1>
      {label ? (
        <p className={`${antonSc.className} pointer-events-none absolute top-[36%] left-[10%] z-10 max-w-[70%] text-3xl leading-none text-white md:top-[40%] md:text-5xl`}>
          {label}
        </p>
      ) : null}
      {slides.length > 1 ? (
        <div className="absolute bottom-[116px] left-[10%] z-10 flex gap-2">
          {slides.map((slide, slideIndex) => (
            <button
              key={`${slide.label ?? "kropka"}-${slide.src}`}
              type="button"
              aria-label={slide.label ?? `Zdjęcie ${slideIndex + 1}`}
              aria-current={slideIndex === active}
              className={`h-2.5 w-2.5 rounded-full ${slideIndex === active ? "bg-white" : "bg-white/45"}`}
              onClick={() => setIndex(slideIndex)}
            />
          ))}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[100px] bg-white" />
    </section>
  );
}
