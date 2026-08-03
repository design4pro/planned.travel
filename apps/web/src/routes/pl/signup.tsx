import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "../../components/public/AuthPage";

export const Route = createFileRoute("/pl/signup")({ component: PolishSignupPage });

function PolishSignupPage() {
  return <AuthPage mode="signup" language="pl" />;
}
