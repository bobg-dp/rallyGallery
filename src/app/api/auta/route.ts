import { getCurrentUser } from "@/lib/current-user";
import { searchCars } from "@/lib/records";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ cars: [] }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length > 240) return Response.json({ cars: [] });
  return Response.json({ cars: await searchCars(query) });
}
