"use client";

import { cn } from "@/lib/utils";

export function StarterPrompts({
  prompts,
  onSelect,
  disabled,
  className,
}: {
  prompts: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (prompts.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(p)}
          className={cn(
            "text-left text-xs sm:text-[13px] leading-snug rounded-full border border-border bg-background/95 px-3 py-2",
            "text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50",
            "transition-colors duration-200 max-w-full break-words",
            "disabled:opacity-50 disabled:pointer-events-none",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
