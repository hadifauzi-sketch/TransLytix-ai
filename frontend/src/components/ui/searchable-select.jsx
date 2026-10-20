import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Input } from "./input";
import { Label } from "./label";
import {
  glassSelectContentClassName,
  glassSelectListItemActiveClassName,
  glassSelectListItemClassName,
  glassSelectListItemIdleClassName,
  glassSelectOverlayClassName,
  glassSelectSearchHeaderClassName,
  glassSelectSearchInputClassName,
  glassSelectSurfaceStyle,
  glassSelectTriggerClassName,
  glassSelectViewportClassName,
} from "./select-glass";

function SearchableSelect({
  label,
  value,
  placeholder = "Search...",
  options = [],
  onChange,
  disabled = false,
  emptyMessage = "No results",
  className,
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) {
      return options;
    }

    const normalizedQuery = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || "",
    [options, value]
  );

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    updateMenuPosition();

    const handlePointerDown = (event) => {
      const insideTrigger = containerRef.current?.contains(event.target);
      const insideMenu = menuRef.current?.contains(event.target);

      if (!insideTrigger && !insideMenu) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className={cn(glassSelectContentClassName, "p-0")}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              zIndex: 9999,
              ...glassSelectSurfaceStyle,
            }}
          >
            <div aria-hidden className={glassSelectOverlayClassName} />
            <div className={glassSelectSearchHeaderClassName}>
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type to search..."
                className={glassSelectSearchInputClassName}
              />
            </div>
            <div className={cn(glassSelectViewportClassName, "max-h-56 overflow-y-auto")}>
              {filteredOptions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">{emptyMessage}</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        glassSelectListItemClassName,
                        isSelected
                          ? glassSelectListItemActiveClassName
                          : glassSelectListItemIdleClassName
                      )}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-brand" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={cn("flex min-w-0 flex-col gap-1", className)}>
      {label ? <Label>{label}</Label> : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          glassSelectTriggerClassName,
          triggerClassName
        )}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <span className={cn("truncate", selectedLabel ? "text-foreground" : "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {menu}
    </div>
  );
}

export { SearchableSelect };
