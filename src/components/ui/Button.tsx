import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    // Hierarquia de Variantes de Cores Brisanet
    const variantStyles = {
      // 1. Primária: Laranja Vibrante (#FF5022) -> Hover: #E63D10 -> Disabled: Laranja Opaco / Cinza
      primary:
        "bg-[#FF5022] hover:bg-[#E63D10] active:bg-[#C22E06] text-white shadow-xs focus-visible:ring-4 focus-visible:ring-[#FF5022]/25 disabled:bg-[#FF5022]/40 disabled:cursor-not-allowed disabled:shadow-none border border-transparent",

      // 2. Secundária: Azul Realce (#0055FF) -> Hover: #0045D6 -> Focus: Azul
      secondary:
        "bg-[#0055FF] hover:bg-[#0045D6] active:bg-[#0037AD] text-white shadow-xs focus-visible:ring-4 focus-visible:ring-[#0055FF]/25 disabled:bg-[#0055FF]/40 disabled:cursor-not-allowed disabled:shadow-none border border-transparent",

      // 3. Contorno / Outline (Com detalhes em Laranja ou Azul)
      outline:
        "bg-white hover:bg-[#FFF5F2] text-[#FF5022] border border-[#FFD1C5] hover:border-[#FF5022] focus-visible:ring-4 focus-visible:ring-[#FF5022]/20 disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed",

      // 4. Ghost / Sutil
      ghost:
        "bg-transparent hover:bg-slate-100 text-[#1E1E1E] focus-visible:ring-4 focus-visible:ring-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed",

      // 5. Destrutiva / Alerta Crítico
      danger:
        "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white focus-visible:ring-4 focus-visible:ring-rose-500/25 disabled:bg-rose-300 disabled:cursor-not-allowed",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs font-semibold rounded-lg gap-1.5",
      md: "h-10 px-4 text-xs font-bold rounded-xl gap-2",
      lg: "h-12 px-6 text-sm font-bold rounded-xl gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-sans tracking-tight transition-all duration-150 cursor-pointer select-none outline-none focus-visible:outline-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="w-4 h-4 animate-spin shrink-0 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {!isLoading && icon && iconPosition === "left" && (
          <span className="shrink-0">{icon}</span>
        )}
        <span>{children}</span>
        {!isLoading && icon && iconPosition === "right" && (
          <span className="shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
