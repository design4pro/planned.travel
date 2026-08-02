import { Button, Card, Input } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import TripMap from "../../../components/trips/TripMap";
import TripRealtime from "../../../components/collab/TripRealtime";

export const Route = createFileRoute("/app/trips/$id")({ component: TripDetailPage });

function TripDetailPage() {
  const { id } = Route.useParams();
  const plan = trpc.trips.get.useQuery({ id });
  const utils = trpc.useUtils();
  const addPlace = trpc.trips.addPlace.useMutation({ onSuccess: () => utils.trips.get.invalidate({ id }) });
  const addDay = trpc.trips.addDay.useMutation({ onSuccess: () => utils.trips.get.invalidate({ id }) });
  const addItem = trpc.trips.addItem.useMutation({ onSuccess: () => utils.trips.get.invalidate({ id }) });
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [note, setNote] = useState("");

  if (plan.isPending) return <main className="mx-auto max-w-6xl px-6 py-12" role="status">Loading trip…</main>;
  if (plan.isError) return <main className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold">Trip unavailable</h1><p className="mt-2 text-muted-foreground">You may not have access to this trip, or it no longer exists.</p><Link to="/app" className="mt-6 inline-block text-primary underline">Back to trips</Link></main>;

  const { trip, days, places, items } = plan.data;
  const canEdit = trip.role !== "viewer";
  const placesById = new Map(places.map((place) => [place.id, place]));
  const submitPlace = (event: React.FormEvent) => { event.preventDefault(); addPlace.mutate({ tripId: id, name, lat: Number(lat), lng: Number(lng) }); setName(""); setLat(""); setLng(""); };
  const submitNote = (event: React.FormEvent) => { event.preventDefault(); if (note.trim()) addItem.mutate({ tripId: id, note }); setNote(""); };

  return <main className="mx-auto max-w-6xl px-6 py-10"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link to="/app" className="text-sm text-muted-foreground underline">← All trips</Link><h1 className="mt-3 text-4xl font-bold">{trip.title}</h1><p className="mt-2 text-muted-foreground">{trip.role} access</p></div>{canEdit && <Button variant="outline" onPress={() => addDay.mutate({ id })} isPending={addDay.isPending}>Add day</Button>}</header>
    <TripRealtime tripId={id} />
    {places.length > 0 && <div className="mb-8 overflow-hidden rounded-xl border"><TripMap places={places.map((place) => ({ id: place.id, name: place.name, lat: place.lat, lng: place.lng }))} /></div>}
    {trip.role === "viewer" && <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">You’re viewing this trip. Editing is disabled.</p>}
    {canEdit && <div className="mb-8 grid gap-4 lg:grid-cols-2"><Card><Card.Header><Card.Title>Add a place</Card.Title></Card.Header><Card.Content><form onSubmit={submitPlace} className="grid gap-3 sm:grid-cols-3"><Input className="sm:col-span-3" aria-label="Place name" placeholder="Place name" value={name} onChange={(event) => setName(event.target.value)} required /><Input aria-label="Latitude" placeholder="Latitude" type="number" value={lat} onChange={(event) => setLat(event.target.value)} required /><Input aria-label="Longitude" placeholder="Longitude" type="number" value={lng} onChange={(event) => setLng(event.target.value)} required /><Button type="submit" className="sm:col-span-3" isPending={addPlace.isPending}>Add place</Button></form>{addPlace.isError && <p role="alert" className="mt-3 text-sm text-danger">{addPlace.error.message}</p>}</Card.Content></Card><Card><Card.Header><Card.Title>Add a note</Card.Title></Card.Header><Card.Content><form onSubmit={submitNote} className="flex gap-3"><Input aria-label="Note" placeholder="Dinner reservation…" value={note} onChange={(event) => setNote(event.target.value)} /><Button type="submit" isPending={addItem.isPending} isDisabled={!note.trim()}>Add</Button></form></Card.Content></Card></div>}
    <section aria-labelledby="itinerary-heading"><h2 id="itinerary-heading" className="mb-4 text-2xl font-semibold">Itinerary</h2>{days.length === 0 ? <Card><Card.Content><p className="py-6 text-muted-foreground">No days planned yet.</p></Card.Content></Card> : <div className="grid gap-4 md:grid-cols-2">{days.map((day, index) => <Card key={day.id}><Card.Header><Card.Title>Day {index + 1}</Card.Title></Card.Header><Card.Content>{items.filter((item) => item.dayId === day.id).length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> : <ul className="space-y-3">{items.filter((item) => item.dayId === day.id).map((item) => <li key={item.id} className="text-sm">{item.placeId ? <span>📍 {placesById.get(item.placeId)?.name ?? "Place"}</span> : item.note}</li>)}</ul>}</Card.Content></Card>)}</div>}</section>
  </main>;
}
