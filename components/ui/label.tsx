import * as React from "react";

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = "", children, ...props }: LabelProps) {
  return (
    <label
      className={`text-sm leading-none font-medium text-[#064d51] peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
