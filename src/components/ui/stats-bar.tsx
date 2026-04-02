import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export interface StatItem {
  icon?: LucideIcon;
  iconNode?: ReactNode;
  value: string | number;
  label: string;
  color?: string; // tailwind text color class e.g. "text-blue-600"
}

interface StatsBarProps {
  items: StatItem[];
  className?: string;
}

export const StatsBar = ({ items, className }: StatsBarProps) => {
  return (
    <div className={cn("forti-stats-bar", className)}>
      {items.map((item, index) => (
        <div key={index} className="forti-stat-item">
          <span className={cn("forti-stat-value", item.color || "text-foreground")}>
            {item.value}
          </span>
          <span className="forti-stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
