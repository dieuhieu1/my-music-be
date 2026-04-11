// D4 — Resubmit Song
export default function Page({ params }: { params: Record<string, string> }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">D4 — Resubmit Song</h1>
      <pre className="mt-2 text-sm text-muted-foreground">{JSON.stringify(params, null, 2)}</pre>
    </div>
  );
}
