import { Link } from "@tanstack/react-router";
import { Card } from "../ui/card";

const plans = [
  { name: "Free", price: "$0", detail: "Plan up to three trips with the essentials." },
  { name: "Pro", price: "$9", detail: "Unlock exports, richer planning, and more space." },
  { name: "Team", price: "$19", detail: "Give every collaborator a shared workspace." },
];

export function PublicPricing({ language = "en" }: { language?: "en" | "pl" }) {
  const polish = language === "pl";
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16">
      <Link to={polish ? "/pl" : "/"} className="text-sm font-semibold text-primary underline">planned.travel</Link>
      <div className="mt-10 max-w-2xl">
        <p className="eyebrow">{polish ? "Prosto i wspólnie" : "Simple, shared planning"}</p>
        <h1 className="mt-2 text-4xl font-bold">{polish ? "Wybierz swój plan" : "Choose your plan"}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{polish ? "Zacznij za darmo i rozwijaj podróże razem." : "Start free and grow your trips together."}</p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className="h-full">
            <Card.Header><Card.Title>{polish && plan.name === "Free" ? "Darmowy" : plan.name}</Card.Title><Card.Description>{plan.detail}</Card.Description></Card.Header>
            <Card.Content><p className="text-3xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground"> / {polish ? "miesiąc" : "month"}</span></p></Card.Content>
          </Card>
        ))}
      </div>
    </main>
  );
}
