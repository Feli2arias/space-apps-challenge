import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Centres content on the page grid with the shared gutter. */
export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-page px-gutter", className)}>{children}</div>
  );
}
