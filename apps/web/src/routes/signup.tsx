import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "../components/public/AuthPage";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  return <AuthPage mode="signup" />;
}
