import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "active-primary" | "active-secondary";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      // Fundo limpo (#FFFFFF) com borda suave
      default: "bg-white border-slate-200 text-[#1E1E1E]",
      // Fundo cinza suave (#F9FAFB)
      subtle: "bg-[#F9FAFB] border-slate-200 text-[#1E1E1E]",
      // Destaque ativo com borda Laranja Vibrante
      "active-primary": "bg-white border-[#FF5022] ring-2 ring-[#FF5022]/20 text-[#1E1E1E]",
      // Destaque ativo com borda Azul Realce
      "active-secondary": "bg-white border-[#0055FF] ring-2 ring-[#0055FF]/20 text-[#1E1E1E]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border p-5 shadow-xs transition-all duration-200",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-bold text-[#1E1E1E] leading-tight tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-slate-500 font-medium", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4 border-t border-slate-100", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
