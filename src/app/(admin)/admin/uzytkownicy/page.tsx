import { getDb } from "@/db";
import { users } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { Field, SelectInput, TextInput } from "@/components/field";
import { createUser, updateUser } from "../actions";

export default async function Page() {
  const rows = await getDb().select().from(users).orderBy(users.name);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <h1 className="font-display text-4xl">Konta</h1>
        {rows.map((user) => (
          <ActionForm key={user.id} action={updateUser.bind(null, user.id)} submit="Zapisz konto" className="grid gap-3 rounded-xl border border-line bg-panel p-4 md:grid-cols-2">
            <Field label="Imię">
              <TextInput name="name" defaultValue={user.name} />
            </Field>
            <Field label="Rola">
              <SelectInput name="role" defaultValue={user.role}>
                <option value="editor">Edytor</option>
                <option value="admin">Administrator</option>
              </SelectInput>
            </Field>
            <Field label="Nowe hasło, opcjonalnie">
              <TextInput name="password" type="password" autoComplete="new-password" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="disabled" defaultChecked={Boolean(user.disabledAt)} />
              Konto wyłączone
            </label>
            <p className="text-sm text-muted md:col-span-2">{user.email}</p>
          </ActionForm>
        ))}
      </div>
      <ActionForm action={createUser} submit="Załóż konto" className="h-fit space-y-3 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-display text-2xl">Nowe konto</h2>
        <Field label="Imię">
          <TextInput name="name" required />
        </Field>
        <Field label="E-mail">
          <TextInput name="email" type="email" required />
        </Field>
        <Field label="Hasło">
          <TextInput name="password" type="password" required />
        </Field>
        <Field label="Rola">
          <SelectInput name="role" defaultValue="editor">
            <option value="editor">Edytor</option>
            <option value="admin">Administrator</option>
          </SelectInput>
        </Field>
      </ActionForm>
    </div>
  );
}
