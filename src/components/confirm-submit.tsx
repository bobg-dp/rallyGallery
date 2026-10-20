"use client";

export function ConfirmSubmit({
  action,
  message,
  children,
  className,
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <form
      action={async () => {
        if (!window.confirm(message)) return;
        await action();
      }}
    >
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}
