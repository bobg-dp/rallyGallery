import { readObject } from "@/lib/storage";

const DERIVATIVE = /^derivatives\/[0-9a-f-]{36}\/(thumb|grid|view)\.webp$/;

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const joined = key.join("/");
  if (!DERIVATIVE.test(joined)) return new Response("Nie ma takiego pliku.", { status: 404 });
  try {
    const body = await readObject(joined);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Nie ma takiego pliku.", { status: 404 });
  }
}
