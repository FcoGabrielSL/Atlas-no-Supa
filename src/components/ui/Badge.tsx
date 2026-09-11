import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "neutral" | "success" | "warning" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = "primary",
  size = "md",
  dot = false,
  icon,
  ...props
}) => {
  // Paleta Semântica Brisanet
  const variantStyles = {
    // 1. Primária: Laranja Vibrante (#FF5022)
    primary:
      "bg-[#FFF5F2] text-[#FF5022] border border-[#FFD1C5] font-bold",
    
    // 2. Secundária / Apoio: Azul Realce (#0055FF)
    secondary:
      "bg-[#EEF4FF] text-[#0055FF] border border-[#BFD5FE] font-bold",

    // 3. Neutro / Grafite (#1E1E1E)
    neutral:
      "bg-slate-100 text-[#1E1E1E] border border-slate-200 font-semibold",

    // 4. Sucesso (UP / Concluído / Operacional)
    success:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold",

    // 5. Alerta (Pendente / Em Andamento / Atenção)
    warning:
      "bg-amber-50 text-amber-800 border border-amber-200 font-bold",

    // 6. Crítico (DOWN / Rompimento / Erro)
    danger:
      "bg-rose-50 text-rose-700 border border-rose-200 font-bold",

    // 7. Outline Laranja Brisanet
    outline:
      "bg-white text-[#FF5022] border border-[#FF5022]/40 font-bold",
  };

  const dotColors = {
    primary: "bg-[#FF5022]",
    secondary: "bg-[#0055FF]",
    neutral: "bg-[#1E1E1E]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    outline: "bg-[#FF5022]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] gap-1 rounded-md",
    md: "px-2.5 py-1 text-xs gap-1.5 rounded-lg",
    lg: "px-3 py-1.5 text-xs font-bold gap-2 rounded-xl",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-sans tracking-tight transition-colors select-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotColors[variant]
          )}
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
