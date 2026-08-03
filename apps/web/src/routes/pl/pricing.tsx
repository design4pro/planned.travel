import { createFileRoute } from "@tanstack/react-router";
import { PublicPricing } from "../../components/public/PublicPricing";

export const Route = createFileRoute("/pl/pricing")({ component: PolishPricingPage });

function PolishPricingPage() {
  return <PublicPricing language="pl" />;
}
