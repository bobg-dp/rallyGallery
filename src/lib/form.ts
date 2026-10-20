export type FormState = { error?: string; message?: string };

export function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseAuthorFields(formData: FormData, prefix = "") {
  const name = readString(formData, `${prefix}name`);
  const websiteUrl = readString(formData, `${prefix}websiteUrl`);
  const websiteLabel = readString(formData, `${prefix}websiteLabel`);
  if (!name) return { ok: false as const, error: "Podaj nazwę autora." };
  if (name.length > 120) return { ok: false as const, error: "Nazwa autora jest za długa." };
  if (websiteUrl && !websiteLabel) {
    return { ok: false as const, error: "Podaj etykietę linku, na przykład Facebook." };
  }
  if (!websiteUrl && websiteLabel) {
    return { ok: false as const, error: "Podaj adres, albo zostaw etykietę pustą." };
  }
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false as const, error: "Adres musi zaczynać się od https://" };
      }
    } catch {
      return { ok: false as const, error: "Adres musi zaczynać się od https://" };
    }
  }
  return {
    ok: true as const,
    value: {
      name,
      websiteUrl: websiteUrl || null,
      websiteLabel: websiteLabel || null,
    },
  };
}
