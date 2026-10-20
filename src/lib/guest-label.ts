export const GUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function guestLabel(count: number) {
  const formatted = new Intl.NumberFormat("pl-PL").format(count);
  return count === 1 ? `${formatted} gość` : `${formatted} gości`;
}
