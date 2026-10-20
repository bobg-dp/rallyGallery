import { GUEST_ID } from "@/lib/guest-label";
import { countGuests, rememberGuest } from "@/lib/visitors";

export async function POST(request: Request) {
  let id = "";
  try {
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id === "string") id = body.id;
  } catch {
    id = "";
  }
  if (!GUEST_ID.test(id)) {
    return Response.json({ guests: await countGuests() }, { status: 400 });
  }
  return Response.json({ guests: await rememberGuest(id) });
}
