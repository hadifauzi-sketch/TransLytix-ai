import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary brand fill — flat shadcn style.
        primary:
          "bg-brand text-brand-foreground shadow-sm hover:brightness-110 active:brightness-95",
        // Subtle secondary — outlined glass surface.
        secondary:
          "border border-border bg-card/60 text-foreground hover:bg-muted hover:text-foreground backdrop-blur-sm",
        // Glass — the marquee professional look. Frosted, soft inner highlight.
        glass:
          "border border-white/10 bg-white/5 text-foreground shadow-glass backdrop-blur-md hover:bg-white/10 hover:shadow-glass-hover hover:border-white/20 active:translate-y-[1px] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] bg-glass-gradient",
        // Glass tinted with brand accent — for primary call-to-action buttons.
        "glass-brand":
          "border border-brand/30 text-brand shadow-glass backdrop-blur-md hover:border-brand/60 hover:shadow-glow active:translate-y-[1px] bg-[linear-gradient(135deg,hsl(var(--ui-brand)/0.18)_0%,hsl(var(--ui-brand)/0.04)_100%)] hover:bg-[linear-gradient(135deg,hsl(var(--ui-brand)/0.28)_0%,hsl(var(--ui-brand)/0.10)_100%)]",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        ghost:
          "bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        link:
          "bg-transparent text-brand underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        danger:
          "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 backdrop-blur-sm",
        success:
          "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 backdrop-blur-sm",
        warning:
          "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 backdrop-blur-sm",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 py-2",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
