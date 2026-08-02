import { Button, Card, Input } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

export const Route = createFileRoute("/app/")({ component: TripsPage });

function TripsPage() {
  const navigate = useNavigate();
  const trips = trpc.trips.list.useQuery();
  const createTrip = trpc.trips.create.useMutation({
    onSuccess: (trip) => navigate({ to: "/app/trips/$id", params: { id: trip.id } }),
    onSettled: () => trips.refetch(),
  });
  const [title, setTitle] = useState("");

  if (trips.isPending) return <Status title="Loading trips…" />;
  if (trips.isError) return <Status title="We couldn’t load your trips." detail="Please sign in or try again." retry={() => trips.refetch()} />;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (value) createTrip.mutate({ title: value });
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">planned.travel</p><h1 className="mt-2 text-4xl font-bold">Your trips</h1><p className="mt-2 text-muted-foreground">Plan together, one day at a time.</p></div>
        <Link to="/" className="text-sm text-primary underline">Home</Link>
      </header>
      <Card className="mb-8"><Card.Header><Card.Title>Start a trip</Card.Title><Card.Description>Create a private trip and invite collaborators later.</Card.Description></Card.Header><Card.Content>
        <form onSubmit={submit} className="flex max-w-xl gap-3" aria-label="Create trip">
          <Input aria-label="Trip name" placeholder="e.g. Iceland ring road" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
          <Button type="submit" isPending={createTrip.isPending} isDisabled={!title.trim()}>Create</Button>
        </form>
        {createTrip.isError && <p role="alert" className="mt-3 text-sm text-danger">{createTrip.error.message}</p>}
      </Card.Content></Card>
      {trips.data.length === 0 ? <Card><Card.Content><p className="py-8 text-center text-muted-foreground">No trips yet — create your first.</p></Card.Content></Card> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.data.map((trip) => <Link key={trip.id} to="/app/trips/$id" params={{ id: trip.id }}><Card className="h-full transition hover:border-primary"><Card.Header><Card.Title>{trip.title}</Card.Title><Card.Description>{trip.role} · Updated {new Date(trip.updatedAt).toLocaleDateString()}</Card.Description></Card.Header></Card></Link>)}
      </div>}
    </main>
  );
}

function Status({ title, detail, retry }: { title: string; detail?: string; retry?: () => void }) {
  return <main className="mx-auto max-w-3xl px-6 py-20" role="status"><h1 className="text-2xl font-semibold">{title}</h1>{detail && <p className="mt-2 text-muted-foreground">{detail}</p>}{retry && <Button className="mt-6" variant="outline" onPress={retry}>Try again</Button>}</main>;
}
