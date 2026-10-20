import { Anton_SC } from "next/font/google";
import Image from "next/image";

const antonSc = Anton_SC({
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export function EventHero({ src, alt, title }: { src: string; alt: string; title: string }) {
  return (
    <section className="relative h-dvh w-full">
      <Image src={src} alt={alt} fill priority unoptimized className="object-cover" sizes="100vw" />
      <p className={`${antonSc.className} pointer-events-none absolute top-[20%] left-[10%] max-w-[70%] text-6xl leading-none text-white md:text-8xl`}>
        {title}
      </p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[100px] bg-white" />
    </section>
  );
}
