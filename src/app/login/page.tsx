import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field, TextInput } from "@/components/field";
import { getCurrentUser } from "@/lib/current-user";
import { login } from "./actions";

async function LoginForm() {
  const user = await getCurrentUser();
  if (user) redirect("/studio");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm text-muted">Galeria rajdowa</p>
      <h1 className="mt-2 font-display text-4xl">Wejście</h1>
      <div className="mt-6">
        <ActionForm action={login} submit="Zaloguj">
          <Field label="E-mail">
            <TextInput name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Hasło">
            <TextInput name="password" type="password" autoComplete="current-password" required />
          </Field>
        </ActionForm>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Wczytuję…</p>}>
      <LoginForm />
    </Suspense>
  );
}
