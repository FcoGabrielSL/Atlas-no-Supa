import React from "react";
import { cn } from "../../lib/utils";

export interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  highlightVariant?: "orange" | "blue" | "neutral" | "danger";
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  highlightVariant = "orange",
  isActive = false,
  onClick,
  className,
  badge,
  children,
}) => {
  // Configurações de Destaques Visuais Brisanet
  const highlightStyles = {
    // 1. Laranja Vibrante (#FF5022) para Ações Ativas, Destaques Críticos ou Foco Principal
    orange: {
      activeBorder: "border-[#FF5022] ring-2 ring-[#FF5022]/20 bg-[#FFF5F2]/40",
      iconBg: "bg-[#FFF5F2] text-[#FF5022] border border-[#FFD1C5]",
      badge: "bg-[#FFF5F2] text-[#FF5022] border-[#FFD1C5]",
      accentBar: "bg-[#FF5022]",
    },
    // 2. Azul Realce (#0055FF) para Status Neutros, Métricas Técnicas ou Informativos
    blue: {
      activeBorder: "border-[#0055FF] ring-2 ring-[#0055FF]/20 bg-[#EEF4FF]/40",
      iconBg: "bg-[#EEF4FF] text-[#0055FF] border border-[#BFD5FE]",
      badge: "bg-[#EEF4FF] text-[#0055FF] border-[#BFD5FE]",
      accentBar: "bg-[#0055FF]",
    },
    // 3. Neutro / Grafite
    neutral: {
      activeBorder: "border-[#1E1E1E] ring-2 ring-slate-400/20 bg-slate-50",
      iconBg: "bg-slate-100 text-[#1E1E1E] border border-slate-200",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      accentBar: "bg-slate-400",
    },
    // 4. Perigo / Crítico
    danger: {
      activeBorder: "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40",
      iconBg: "bg-rose-50 text-rose-600 border border-rose-200",
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      accentBar: "bg-rose-500",
    },
  };

  const currentTheme = highlightStyles[highlightVariant];

  return (
    <div
      onClick={onClick}
      className={cn(
        // Fundo limpo (branco / cinza muito claro #F9FAFB) com bordas suaves
        "bg-white hover:bg-[#F9FAFB] border border-slate-200 rounded-2xl p-5 shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between select-none",
        onClick && "cursor-pointer hover:shadow-md hover:border-slate-300",
        isActive && currentTheme.activeBorder,
        className
      )}
    >
      {/* Topo do Card: Título + Ícone */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
            {title}
          </span>
          {subtitle && (
            <p className="text-[11px] text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105",
              currentTheme.iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Conteúdo Principal: Valor de KPI em Grafite Escuro (#1E1E1E) */}
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <span className="text-3xl font-extrabold text-[#1E1E1E] font-mono tracking-tight leading-none">
          {value}
        </span>

        {badge && <div>{badge}</div>}

        {trend && (
          <div
            className={cn(
              "text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1",
              trend.isPositive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            )}
          >
            <span>{trend.isPositive ? "↑" : "↓"}</span>
            <span>{trend.value}</span>
            {trend.label && (
              <span className="text-slate-400 font-normal ml-0.5">
                {trend.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Área adicional / children (se houver gráficos ou mini tabelas) */}
      {children && <div className="mt-3 pt-3 border-t border-slate-100">{children}</div>}
    </div>
  );
};
