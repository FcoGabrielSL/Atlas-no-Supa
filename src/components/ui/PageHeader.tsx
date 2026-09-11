import React, { ReactNode } from "react";

export interface PageHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = "",
  badge,
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-1 border-b border-gray-200/80 bg-transparent transition-all ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="p-2 bg-[#FFF5F2] text-[#FF5022] rounded-xl border border-[#FFD1C5] shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-[#1E1E1E] tracking-tight leading-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 font-medium leading-normal mt-0.5 truncate sm:whitespace-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
};
