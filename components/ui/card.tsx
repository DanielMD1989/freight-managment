import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined";
}

const cardVariants = {
  default:
    "bg-white border border-[#064d51]/10 shadow-sm dark:bg-slate-900 dark:border-slate-700",
  elevated:
    "bg-white shadow-lg hover:shadow-xl transition-shadow dark:bg-slate-900",
  outlined: "bg-transparent border-2 border-[#064d51]/20 dark:border-slate-700",
};

export function Card({
  className = "",
  variant = "default",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl ${cardVariants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function CardHeader({
  className = "",
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function CardTitle({
  className = "",
  children,
  ...props
}: CardTitleProps) {
  return (
    <h3
      className={`text-lg leading-none font-semibold tracking-tight text-[#064d51] dark:text-white ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function CardDescription({
  className = "",
  children,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      className={`text-sm text-[#064d51]/70 dark:text-slate-400 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export function CardContent({
  className = "",
  children,
  ...props
}: CardContentProps) {
  return (
    <div className={`p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function CardFooter({
  className = "",
  children,
  ...props
}: CardFooterProps) {
  return (
    <div className={`flex items-center p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}
