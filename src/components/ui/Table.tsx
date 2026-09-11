import React from "react";
import { cn } from "../../lib/utils";

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-xs text-[#1E1E1E] border-collapse", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-[#F9FAFB] border-b border-slate-200 text-left text-[11px] font-bold text-[#1E1E1E] uppercase tracking-wider font-mono",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-slate-100 bg-white", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { isSelected?: boolean; isHighlighted?: boolean }
>(({ className, isSelected, isHighlighted, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors duration-150 hover:bg-[#FFF5F2]/40",
      isSelected && "bg-[#FFF5F2] border-l-4 border-l-[#FF5022]",
      isHighlighted && "bg-[#EEF4FF]/50 border-l-4 border-l-[#0055FF]",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "p-3.5 text-left align-middle font-bold text-[#1E1E1E] [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-3.5 align-middle text-[#1E1E1E] [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";
