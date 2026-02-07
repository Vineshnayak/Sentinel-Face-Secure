import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TechCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function TechCard({ children, className, title, subtitle }: TechCardProps) {
  return (
    <div className={cn(
      "relative bg-card rounded-2xl border border-white/5 shadow-2xl overflow-hidden",
      "before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/5 before:to-transparent before:pointer-events-none",
      className
    )}>
      {/* Decorative top header line */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
      
      <div className="p-6 md:p-8 relative z-10">
        {(title || subtitle) && (
          <div className="mb-6">
            {title && <h3 className="text-2xl font-bold font-display tracking-tight text-foreground">{title}</h3>}
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>

      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-20 h-20 bg-primary/5 rounded-br-full blur-2xl -z-0" />
      <div className="absolute bottom-0 right-0 w-20 h-20 bg-accent/5 rounded-tl-full blur-2xl -z-0" />
    </div>
  );
}
