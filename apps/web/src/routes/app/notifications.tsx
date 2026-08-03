import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><Link to="/app" className="text-sm text-primary underline">Back to trips</Link><h1 className="mt-8 text-3xl font-bold">Notifications</h1><p className="mt-2 text-muted-foreground">Your collaboration updates will appear here.</p></main>;
}
