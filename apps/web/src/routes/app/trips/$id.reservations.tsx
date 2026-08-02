import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RESERVATION_STATES, RESERVATION_TYPES, type ReservationDto, type ReservationState, type ReservationType } from "@planned/shared";
import { trpc } from "../../../lib/trpc";

export const Route = createFileRoute("/app/trips/$id/reservations")({ component: ReservationsPage });

const inputClass = "rounded-lg border border-border bg-background px-3 py-2";

function toEpoch(value: string) {
  if (!value) return undefined;
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : undefined;
}

function toLocalInput(value: number | null) {
  if (value == null) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ReservationsPage() {
  const { id } = Route.useParams();
  const plan = trpc.trips.get.useQuery({ id });
  const reservations = trpc.trips.reservations.list.useQuery({ tripId: id });
  const utils = trpc.useUtils();
  const create = trpc.trips.reservations.create.useMutation({ onSuccess: () => reservations.refetch() });
  const update = trpc.trips.reservations.update.useMutation({ onSuccess: () => reservations.refetch() });
  const remove = trpc.trips.reservations.remove.useMutation({ onSuccess: () => reservations.refetch() });
  const [editing, setEditing] = useState<string | null>(null);

  if (plan.isPending || reservations.isPending) return <main className="mx-auto max-w-4xl px-6 py-12" role="status">Loading reservations…</main>;
  if (plan.isError || reservations.isError) return <main className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold">Reservations unavailable</h1><p className="mt-2 text-muted-foreground">You may not have access to this trip, or it no longer exists.</p><Link to="/app" className="mt-6 inline-block text-primary underline">Back to trips</Link></main>;

  const canEdit = plan.data.trip.role !== "viewer";
  const refresh = () => { void utils.trips.reservations.list.invalidate({ tripId: id }); void reservations.refetch(); };
  return <main className="mx-auto max-w-4xl px-6 py-10">
    <Link to="/app/trips/$id" params={{ id }} className="text-sm text-muted-foreground underline">← {plan.data.trip.title}</Link>
    <header className="mb-8 mt-4 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-bold">Reservations</h1><p className="mt-2 text-muted-foreground">Flights, hotels, meals, and other bookings for this trip.</p></div><span className="text-sm text-muted-foreground">{plan.data.trip.role} access</span></header>
    {!canEdit && <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">You’re viewing this trip. Editing is disabled.</p>}
    {canEdit && <ReservationForm tripId={id} busy={create.isPending} error={create.isError ? create.error.message : null} onSubmit={(form) => create.mutate({ tripId: id, type: form.type, status: form.status, title: form.title.trim() || undefined, confirmationCode: form.confirmationCode.trim() || undefined, startsAt: toEpoch(form.startsAt), endsAt: toEpoch(form.endsAt), notes: form.notes.trim() || undefined })} />}
    <section aria-labelledby="reservations-heading" className="mt-8"><h2 id="reservations-heading" className="mb-4 text-2xl font-semibold">Your bookings</h2>
      {reservations.data.length === 0 ? <Card><Card.Content><p className="py-8 text-center text-muted-foreground">No reservations yet.</p></Card.Content></Card> : <div className="space-y-3">{reservations.data.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} canEdit={canEdit} editing={editing === reservation.id} busy={update.isPending || remove.isPending} error={update.isError || remove.isError ? (update.error?.message ?? remove.error?.message ?? null) : null} onEdit={() => setEditing(reservation.id)} onCancel={() => setEditing(null)} onSave={(form) => { update.mutate({ id: reservation.id, data: { type: form.type, status: form.status, title: form.title.trim() || null, confirmationCode: form.confirmationCode.trim() || null, startsAt: form.startsAt ? toEpoch(form.startsAt) : null, endsAt: form.endsAt ? toEpoch(form.endsAt) : null, notes: form.notes.trim() || null } }, { onSuccess: () => { setEditing(null); refresh(); } }); }} onDelete={() => remove.mutate({ id: reservation.id })} />)}</div>}
    </section>
  </main>;
}

type FormData = { type: ReservationType; status: ReservationState; title: string; confirmationCode: string; startsAt: string; endsAt: string; notes: string };

function ReservationForm({ tripId: _tripId, busy, error, onSubmit, initial }: { tripId: string; busy: boolean; error: string | null; onSubmit: (input: FormData) => void; initial?: FormData }) {
  const [form, setForm] = useState<FormData>(initial ?? { type: "other", status: "planned", title: "", confirmationCode: "", startsAt: "", endsAt: "", notes: "" });
  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((current) => ({ ...current, [key]: value }));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(form);
  }
  return <Card><Card.Header><Card.Title>Add a reservation</Card.Title></Card.Header><Card.Content><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Title"><Input aria-label="Title" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={200} /></Field>
    <Choice label="Type" value={form.type} options={RESERVATION_TYPES} labels={RESERVATION_TYPES} onChange={(value) => set("type", value as ReservationType)} />
    <Choice label="Status" value={form.status} options={RESERVATION_STATES} labels={RESERVATION_STATES} onChange={(value) => set("status", value as ReservationState)} />
    <Field label="Confirmation code"><Input aria-label="Confirmation code" value={form.confirmationCode} onChange={(event) => set("confirmationCode", event.target.value)} maxLength={200} /></Field>
    <Field label="Starts"><Input aria-label="Starts" type="datetime-local" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} /></Field>
    <Field label="Ends"><Input aria-label="Ends" type="datetime-local" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} /></Field>
    <Field label="Notes" className="sm:col-span-2"><Input aria-label="Notes" value={form.notes} onChange={(event) => set("notes", event.target.value)} maxLength={4000} /></Field>
    {error && <p role="alert" className="text-sm text-danger sm:col-span-2">{error === "ends_before_starts" ? "End must be after the start." : error}</p>}
    <Button type="submit" isPending={busy} className="sm:col-span-2">Add reservation</Button>
  </form></Card.Content></Card>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}><span className="font-medium">{label}</span>{children}</label>;
}

function Choice({ label, value, options, labels, onChange }: { label: string; value: string; options: readonly string[]; labels: readonly string[]; onChange: (value: string) => void }) {
  return <label className="flex flex-col gap-1 text-sm"><span className="font-medium">{label}</span><select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={option} value={option}>{labels[index]}</option>)}</select></label>;
}

function ReservationCard({ reservation, canEdit, editing, busy, error, onEdit, onCancel, onSave, onDelete }: { reservation: ReservationDto; canEdit: boolean; editing: boolean; busy: boolean; error: string | null; onEdit: () => void; onCancel: () => void; onSave: (data: FormData) => void; onDelete: () => void }) {
  if (editing) return <Card><Card.Content><ReservationForm tripId={reservation.tripId} busy={busy} error={error} initial={{ type: reservation.type, status: reservation.status, title: reservation.title ?? "", confirmationCode: reservation.confirmationCode ?? "", startsAt: toLocalInput(reservation.startsAt), endsAt: toLocalInput(reservation.endsAt), notes: reservation.notes ?? "" }} onSubmit={(form) => onSave(form)} /><Button className="mt-3" variant="outline" onPress={onCancel}>Cancel</Button></Card.Content></Card>;
  return <Card><Card.Content><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{reservation.title || reservation.type}</h3><span className="rounded-full bg-muted px-2 py-1 text-xs">{reservation.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{reservation.startsAt ? new Date(reservation.startsAt).toLocaleString() : "No start date"}{reservation.endsAt ? ` → ${new Date(reservation.endsAt).toLocaleString()}` : ""}</p>{reservation.confirmationCode && <p className="mt-1 text-sm">Confirmation: {reservation.confirmationCode}</p>}{reservation.notes && <p className="mt-2 text-sm text-muted-foreground">{reservation.notes}</p>}</div>{canEdit && <div className="flex gap-2"><Button size="sm" variant="outline" onPress={onEdit}>Edit</Button><Button size="sm" variant="ghost" onPress={onDelete} isPending={busy}>Delete</Button></div>}</div></Card.Content></Card>;
}
