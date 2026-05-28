import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function InfoPopover({
  label = "Learn more",
  content,
  className,
}: {
  label?: ReactNode;
  content: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-[11px] font-medium text-shade-teal hover:text-shade-teal/80 underline underline-offset-2",
            className,
          )}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[90vw]">
        <div className="space-y-2">{content}</div>
      </PopoverContent>
    </Popover>
  );
}

