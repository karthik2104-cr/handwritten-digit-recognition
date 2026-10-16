export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--ns-border)] px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ns-muted)]">{body}</p>
    </div>
  );
}
