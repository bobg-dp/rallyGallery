import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { authors } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { Field, TextInput } from "@/components/field";
import { btnDanger } from "@/components/styles";
import { createAuthor, deleteAuthor, updateAuthor } from "../actions";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const errorValue = (await searchParams).error;
  const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  const rows = await getDb().select().from(authors).orderBy(asc(authors.name));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Autorzy</h1>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <div className="grid gap-4">
        {rows.map((author) => (
          <div key={author.id} className="rounded-xl border border-line bg-panel p-4">
            <ActionForm action={updateAuthor.bind(null, author.id)} submit="Zapisz autora" className="grid gap-3 md:grid-cols-3">
              <Field label="Nazwa">
                <TextInput name="name" defaultValue={author.name} />
              </Field>
              <Field label="Adres">
                <TextInput name="websiteUrl" defaultValue={author.websiteUrl ?? ""} />
              </Field>
              <Field label="Etykieta">
                <TextInput name="websiteLabel" defaultValue={author.websiteLabel ?? ""} />
              </Field>
            </ActionForm>
            <form action={deleteAuthor.bind(null, author.id)} className="mt-3">
              <button className={btnDanger} type="submit">
                Usuń
              </button>
            </form>
          </div>
        ))}
      </div>
      <ActionForm action={createAuthor} submit="Dodaj autora" className="grid max-w-3xl gap-3 rounded-xl border border-line bg-panel p-4 md:grid-cols-3">
        <Field label="Nazwa">
          <TextInput name="name" required />
        </Field>
        <Field label="Adres">
          <TextInput name="websiteUrl" placeholder="https://" />
        </Field>
        <Field label="Etykieta">
          <TextInput name="websiteLabel" placeholder="Facebook" />
        </Field>
      </ActionForm>
    </div>
  );
}
