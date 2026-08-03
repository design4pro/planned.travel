import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "../../components/public/AuthPage";

export const Route = createFileRoute("/pl/login")({ component: PolishLoginPage });

function PolishLoginPage() {
  return <AuthPage mode="signin" language="pl" />;
}
