"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { btnPrimary } from "./styles";

export function ActionForm({
  action,
  children,
  submit,
  className = "space-y-3",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      {state.message ? <p className="text-sm">{state.message}</p> : null}
      <button className={btnPrimary} disabled={pending} type="submit">
        {pending ? "Zapisuję…" : submit}
      </button>
    </form>
  );
}
