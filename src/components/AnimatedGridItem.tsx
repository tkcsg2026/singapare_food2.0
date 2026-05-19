"use client";

import type { CSSProperties, ReactNode } from "react";

/** Staggered grid entrance (marketplace / supplier listings). */
export function AnimatedGridItem({
  index,
  children,
  className = "",
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  const delayMs = Math.min(index, 24) * 42;
  return (
    <div
      className={`animate-grid-item-in min-w-0 w-full ${className}`.trim()}
      style={{ "--grid-delay": `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

