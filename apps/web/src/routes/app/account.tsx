import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/account")({ component: AccountPage });

function AccountPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><Link to="/app" className="text-sm text-primary underline">Back to trips</Link><h1 className="mt-8 text-3xl font-bold">Account</h1><p className="mt-2 text-muted-foreground">Manage your profile and plan.</p></main>;
}
