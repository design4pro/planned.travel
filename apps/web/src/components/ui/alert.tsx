import * as React from "react";
import { cn } from "../../lib/utils";

const Alert = ({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }) => <div role="alert" className={cn("relative w-full rounded-lg border p-4", variant === "destructive" && "border-destructive/50 text-destructive", className)} {...props} />;
const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
const AlertDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;

export { Alert, AlertTitle, AlertDescription };
