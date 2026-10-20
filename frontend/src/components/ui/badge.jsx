import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand/15 text-brand",
        secondary: "border-border bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
        success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
        warning: "border-amber-500/40 bg-amber-500/15 text-amber-400",
        destructive: "border-destructive/40 bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const Badge = React.forwardRef(function Badge(
  { className, variant, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
});

Badge.displayName = "Badge";

export { Badge, badgeVariants };
