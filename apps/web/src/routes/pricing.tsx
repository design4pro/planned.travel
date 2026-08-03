import { createFileRoute } from "@tanstack/react-router";
import { PublicPricing } from "../components/public/PublicPricing";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

function PricingPage() {
  return <PublicPricing />;
}
