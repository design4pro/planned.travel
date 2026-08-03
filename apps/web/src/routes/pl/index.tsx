import { createFileRoute } from "@tanstack/react-router";
import { PublicPricing } from "../../components/public/PublicPricing";

export const Route = createFileRoute("/pl/")({ component: PolishHomePage });

function PolishHomePage() {
  return <PublicPricing language="pl" />;
}
