import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import TripMap from "../../../components/trips/TripMap";
import TripRealtime from "../../../components/collab/TripRealtime";
import { submitPlaceForm } from "../../../components/trips/submit-place-form";
import { useTranslations } from "../../../i18n/utils";

export const Route = createFileRoute("/app/trips/$id")({ component: TripDetailPage });

function TripDetailPage() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const t = useTranslations(pathname.startsWith("/pl") ? "pl" : "en");
  const plan = trpc.trips.get.useQuery({ id });
  const utils = trpc.useUtils();
  const addPlace = trpc.trips.addPlace.useMutation({
    onSuccess: async () => {
      await utils.trips.get.invalidate({ id });
    },
  });
  const addDay = trpc.trips.addDay.useMutation({ onSuccess: () => utils.trips.get.invalidate({ id }) });
  const addItem = trpc.trips.addItem.useMutation({ onSuccess: () => utils.trips.get.invalidate({ id }) });
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [dayId, setDayId] = useState("");
  const [note, setNote] = useState("");

  if (plan.isPending) return <main className="mx-auto max-w-6xl px-6 py-12" role="status"><h1 className="text-2xl font-semibold">Loading trip…</h1></main>;
  if (plan.isError) return <main className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold">Trip unavailable</h1><p className="mt-2 text-muted-foreground">You may not have access to this trip, or it no longer exists.</p><Link to="/app" className="mt-6 inline-block text-primary underline">Back to trips</Link></main>;

  const { trip, days, places, items } = plan.data;
  const canEdit = trip.role !== "viewer";
  const placesById = new Map(places.map((place) => [place.id, place]));
  const submitPlace = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await submitPlaceForm(
        { tripId: id, dayId, name, lat, lng },
        addPlace.mutateAsync,
        () => {
          setName("");
          setLat("");
          setLng("");
          setDayId("");
        },
      );
    } catch {
      // The mutation exposes the server error below while preserving the form values.
    }
  };
  const submitNote = (event: React.FormEvent) => { event.preventDefault(); if (note.trim()) addItem.mutate({ tripId: id, note }); setNote(""); };

  return <main className="mx-auto max-w-6xl px-6 py-10"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link to="/app" className="text-sm text-muted-foreground underline">← All trips</Link><h1 className="mt-3 text-4xl font-bold">{trip.title}</h1><p className="mt-2 text-muted-foreground">{trip.role} access</p></div>{canEdit && <Button variant="outline" onPress={() => addDay.mutate({ id })} isPending={addDay.isPending}>Add day</Button>}</header>
    <div className="mb-6 flex gap-4 text-sm"><Link to="/app/trips/$id/reservations" params={{ id }} className="text-primary underline">Reservations</Link><Link to="/app/trips/$id/expenses" params={{ id }} className="text-primary underline">Costs</Link></div>
    <TripRealtime tripId={id} />
    {places.length > 0 && <div className="mb-8 overflow-hidden rounded-xl border"><TripMap places={places.map((place) => ({ id: place.id, name: place.name, lat: place.lat, lng: place.lng }))} /></div>}
    {trip.role === "viewer" && <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">You’re viewing this trip. Editing is disabled.</p>}
    {canEdit && <div className="mb-8 grid gap-4 lg:grid-cols-2"><Card><Card.Header><Card.Title>{t("planner.addPlace.title")}</Card.Title></Card.Header><Card.Content><form onSubmit={submitPlace} className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="place-name">{t("planner.name")}</Label><Input id="place-name" placeholder="Belém Tower" value={name} onChange={(event) => setName(event.target.value)} required /></div>{days.length > 0 && <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="place-day">{t("planner.day")}</Label><select id="place-day" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={dayId} onChange={(event) => setDayId(event.target.value)}><option value="">{t("planner.firstDay")}</option>{days.map((day, index) => <option key={day.id} value={day.id}>{t("planner.day")} {index + 1}</option>)}</select></div>}<div className="grid gap-1.5"><Label htmlFor="place-latitude">{t("planner.lat")}</Label><Input id="place-latitude" placeholder="38.6916" type="number" min={-90} max={90} step="any" value={lat} onChange={(event) => setLat(event.target.value)} required /></div><div className="grid gap-1.5"><Label htmlFor="place-longitude">{t("planner.lng")}</Label><Input id="place-longitude" placeholder="-9.2160" type="number" min={-180} max={180} step="any" value={lng} onChange={(event) => setLng(event.target.value)} required /></div><Button type="submit" className="sm:col-span-2" isPending={addPlace.isPending} isDisabled={!name.trim() || !lat || !lng}>{t("planner.addToItinerary")}</Button></form>{addPlace.isError && <p role="alert" className="mt-3 text-sm text-danger">{t("planner.error")}. {addPlace.error.message}</p>}</Card.Content></Card><Card><Card.Header><Card.Title>Add a note</Card.Title></Card.Header><Card.Content><form onSubmit={submitNote} className="flex gap-3"><Input aria-label="Note" placeholder="Dinner reservation…" value={note} onChange={(event) => setNote(event.target.value)} /><Button type="submit" isPending={addItem.isPending} isDisabled={!note.trim()}>Add</Button></form></Card.Content></Card></div>}
    <section aria-labelledby="itinerary-heading"><h2 id="itinerary-heading" className="mb-4 text-2xl font-semibold">Itinerary</h2>{days.length === 0 ? <Card><Card.Content><p className="py-6 text-muted-foreground">No days planned yet.</p></Card.Content></Card> : <div className="grid gap-4 md:grid-cols-2">{days.map((day, index) => <Card key={day.id}><Card.Header><Card.Title>Day {index + 1}</Card.Title></Card.Header><Card.Content>{items.filter((item) => item.dayId === day.id).length === 0 ? <p className="text-sm text-muted-foreground">No items yet.</p> : <ul className="space-y-3">{items.filter((item) => item.dayId === day.id).map((item) => <li key={item.id} className="text-sm">{item.placeId ? <span>📍 {placesById.get(item.placeId)?.name ?? "Place"}</span> : item.note}</li>)}</ul>}</Card.Content></Card>)}</div>}</section>
  </main>;
}
