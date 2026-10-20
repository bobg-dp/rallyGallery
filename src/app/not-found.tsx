import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <h1 className="font-display text-5xl">Nie ma takiej strony</h1>
      <Link href="/" className="mt-4 text-sm underline decoration-accent underline-offset-4">
        Wróć do galerii
      </Link>
    </main>
  );
}
