import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cardVariants = cva(
  "rounded-lg text-card-foreground transition-shadow",
  {
    variants: {
      variant: {
        default: "bg-card border border-border shadow-sm",
        glass:
          "border border-white/10 bg-card/60 shadow-glass backdrop-blur-md bg-glass-gradient hover:shadow-glass-hover dark:border-white/10 dark:bg-white/[0.04]",
        // Slightly brighter glass for stat / highlight cards.
        elevated:
          "border border-white/15 bg-card/70 shadow-glass-hover backdrop-blur-md bg-glass-gradient",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const Card = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant, className }))} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
