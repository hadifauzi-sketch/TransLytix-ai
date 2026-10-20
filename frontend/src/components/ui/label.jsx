import * as React from "react";
import { cn } from "../../lib/utils";

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
