import { cn } from "@/lib/utils/cn";

interface MasonryGridProps {
  children: React.ReactNode;
  className?: string;
}

export function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <div className={cn("masonry-grid", className)}>
      {children}
    </div>
  );
}
