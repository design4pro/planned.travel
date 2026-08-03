import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "../components/public/AuthPage";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  return <AuthPage mode="signin" />;
}
