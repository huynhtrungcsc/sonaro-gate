import { cn } from "@/lib/utils";

export interface FortiToggleProps {
  enabled: boolean;
  onToggle?: () => void;
  onChange?: () => void;
  size?: 'sm' | 'md';
}

export const FortiToggle = ({ enabled, onToggle, onChange, size = 'md' }: FortiToggleProps) => {
  const handleClick = onToggle || onChange;
  const sizeClasses = size === 'sm' 
    ? 'w-8 h-4' 
    : 'w-10 h-5';
  
  const knobSize = size === 'sm' 
    ? 'w-3 h-3' 
    : 'w-4 h-4';
    
  const knobPosition = size === 'sm'
    ? (enabled ? 'left-[18px]' : 'left-0.5')
    : (enabled ? 'left-[22px]' : 'left-0.5');

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative rounded-full transition-colors cursor-pointer border-2",
        sizeClasses,
        enabled 
          ? "bg-[hsl(142,70%,35%)] border-[hsl(142,75%,28%)]" 
          : "bg-[#999] border-[#777]"
      )}
    >
      <span 
        className={cn(
          "absolute top-0.5 bg-white rounded-full shadow-md transition-all",
          knobSize,
          knobPosition
        )} 
      />
    </button>
  );
};
