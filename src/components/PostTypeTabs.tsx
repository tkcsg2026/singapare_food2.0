"use client";

import type { LucideIcon } from "lucide-react";

export interface PostTypeTabOption<T extends string> {
  value: T;
  /** Tab label, e.g. "Available" / "Wanted" */
  label: string;
  /** Optional one-line explanation shown under the label on wider screens */
  hint?: string;
  icon: LucideIcon;
  count?: number;
}

interface PostTypeTabsProps<T extends string> {
  options: PostTypeTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * The shared "who is posting" switch used by every two-sided board on the
 * portal — Jobs (Hiring / Looking for Job), Shop & Takeover (Available /
 * Wanted) and Buy & Sell (For Sale / Wanted).
 *
 * Keeping one component means all the boards read the same way, so a member who
 * learns one board already knows the others.
 */
export function PostTypeTabs<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: PostTypeTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={`flex items-stretch gap-1 sm:gap-2 border-b border-border overflow-x-auto scrollbar-hide ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex-shrink-0 flex flex-col items-start gap-0.5 px-3 sm:px-4 py-2.5 border-b-2 transition-colors -mb-px text-left min-h-[44px] ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold whitespace-nowrap">
              <Icon className="h-4 w-4 flex-shrink-0" />
              {option.label}
              {typeof option.count === "number" && (
                <span
                  className={`ml-0.5 text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {option.count}
                </span>
              )}
            </span>
            {option.hint && (
              <span className="hidden sm:block text-[11px] font-normal text-muted-foreground leading-tight whitespace-nowrap">
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
