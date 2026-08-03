import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/trips/$id/documents")({ component: DocumentsPage });

function DocumentsPage() {
  const { id } = Route.useParams();
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-12"><Link to="/app/trips/$id" params={{ id }} className="text-sm text-primary underline">Back to trip</Link><h1 className="mt-8 text-3xl font-bold">Documents</h1><p className="mt-2 text-muted-foreground">Trip documents and reservation attachments.</p></main>;
}
