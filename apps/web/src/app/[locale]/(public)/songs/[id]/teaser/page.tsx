// I1 — Drop Teaser Page (public, no JWT required)
export default function DropTeaserPage({ params }: { params: { id: string } }) {
  // TODO Phase 8: fetch teaser, show countdown, Notify Me button
  return (
    <main className="p-8">
      <p className="text-muted-foreground">Drop teaser — song ID: {params.id}</p>
    </main>
  );
}
