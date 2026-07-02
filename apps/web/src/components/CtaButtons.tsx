import { Button } from "@/components/ui/button";
import { Button as HeroUIButton } from "@/components/ui/heroui";

interface Props {
  healthLabel?: string;
  githubLabel?: string;
}

/** React island: legacy shadcn Buttons + a HeroUI Button (coexistence proof). */
export default function CtaButtons({ healthLabel = "Check health", githubLabel = "GitHub" }: Props) {
  async function checkHealth() {
    const res = await fetch("/api/health");
    const data = await res.json();
    // eslint-disable-next-line no-console
    console.log("health:", data);
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button onClick={checkHealth}>{healthLabel}</Button>
      <Button variant="outline" asChild>
        <a href="https://github.com/design4pro/planned.travel">{githubLabel}</a>
      </Button>
      {/* HeroUI v3 Button (new UI standard) — proves the wiring + brand primary. */}
      <HeroUIButton onPress={() => window.open("https://www.heroui.com", "_blank")}>
        HeroUI
      </HeroUIButton>
    </div>
  );
}

