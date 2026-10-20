import { getDb } from "@/db";
import { series } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field, TextInput } from "@/components/field";
import { btnDanger } from "@/components/styles";
import { createSeries, deleteSeries, updateSeries } from "../actions";

export default async function Page() {
  const rows = await getDb().select().from(series).orderBy(series.name);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <h1 className="font-display text-4xl">Cykle</h1>
        {rows.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-panel p-4">
            <ActionForm action={updateSeries.bind(null, item.id)} submit="Zapisz" className="flex items-end gap-3">
              <Field label="Nazwa">
                <TextInput name="name" defaultValue={item.name} />
              </Field>
            </ActionForm>
            <ConfirmSubmit
              action={deleteSeries.bind(null, item.id)}
              message="Usunąć ten cykl razem z rajdami i zdjęciami?"
              className={`${btnDanger} mt-3`}
            >
              Usuń cykl
            </ConfirmSubmit>
          </div>
        ))}
      </div>
      <ActionForm action={createSeries} submit="Dodaj cykl" className="h-fit space-y-3 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-display text-2xl">Nowy cykl</h2>
        <Field label="Nazwa">
          <TextInput name="name" required />
        </Field>
      </ActionForm>
    </div>
  );
}
