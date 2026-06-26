import { Button } from "@/components/ui/button";

interface Props {
  healthLabel?: string;
  githubLabel?: string;
}

/** React island demonstrating the shadcn Button (variant + asChild). */
export default function CtaButtons({ healthLabel = "Check health", githubLabel = "GitHub" }: Props) {
  async function checkHealth() {
    const res = await fetch("/api/health");
    const data = await res.json();
    // eslint-disable-next-line no-console
    console.log("health:", data);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button onClick={checkHealth}>{healthLabel}</Button>
      <Button variant="outline" asChild>
        <a href="https://github.com/design4pro/planned.travel">{githubLabel}</a>
      </Button>
    </div>
  );
}

