const glassSelectTriggerClassName = [
  "flex h-9 w-full items-center justify-between rounded-md border border-white/10",
  "bg-white/[0.02] px-3 py-2 text-sm text-foreground shadow-none",
  "transition-colors duration-100 dark:bg-white/[0.03]",
  "hover:border-white/14 hover:bg-white/[0.03] dark:hover:bg-white/[0.04]",
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const glassSelectContentClassName = [
  "relative isolate z-[1100] max-h-96 min-w-[8rem] overflow-hidden rounded-md",
  "border-x border-b border-t-0 border-black/10 bg-white/90 text-popover-foreground shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)]",
  "dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_16px_36px_-28px_rgba(0,0,0,0.75)]",
].join(" ");

const glassSelectOverlayClassName =
  "pointer-events-none absolute inset-0 bg-transparent";

const glassSelectViewportClassName = "relative z-10 bg-transparent p-1.5";

const glassSelectScrollButtonClassName =
  "relative z-10 flex cursor-default items-center justify-center py-1";

const glassSelectSearchHeaderClassName =
  "relative z-10 border-b border-black/10 bg-black/[0.03] p-2 dark:border-white/10 dark:bg-white/[0.04]";

const glassSelectSearchInputClassName =
  "h-8 border-black/10 bg-white/70 text-xs shadow-none dark:border-white/10 dark:bg-white/[0.05]";

const glassSelectListItemClassName =
  "flex w-full items-center justify-between rounded-md border border-transparent px-2.5 py-2 text-left text-sm transition-colors duration-100";

const glassSelectListItemIdleClassName =
  "bg-transparent text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.08]";

const glassSelectListItemActiveClassName =
  "bg-brand/12 text-foreground shadow-none";

const glassRadixSelectItemClassName = [
  "relative flex w-full cursor-default select-none items-center rounded-md border border-transparent",
  "py-2 pl-8 pr-2.5 text-sm outline-none transition-colors duration-100",
  "focus:bg-black/[0.04] focus:text-foreground dark:focus:bg-white/[0.08]",
  "data-[state=checked]:bg-brand/12 data-[state=checked]:shadow-none",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
].join(" ");

const glassSelectSurfaceStyle = {
  backgroundColor: "hsl(var(--ui-popover) / 0.92)",
  backdropFilter: "blur(1px)",
  WebkitBackdropFilter: "blur(5px)",
};

export {
  glassRadixSelectItemClassName,
  glassSelectContentClassName,
  glassSelectListItemActiveClassName,
  glassSelectListItemClassName,
  glassSelectListItemIdleClassName,
  glassSelectOverlayClassName,
  glassSelectScrollButtonClassName,
  glassSelectSearchHeaderClassName,
  glassSelectSearchInputClassName,
  glassSelectSurfaceStyle,
  glassSelectTriggerClassName,
  glassSelectViewportClassName,
};
