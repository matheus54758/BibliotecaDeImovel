import { cn } from "../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  className?: string;
}

export const Button = ({ variant = 'primary', className, children, ...props }: ButtonProps) => {
  const variants = {
    primary: "bg-gradient-primary text-on-primary shadow-lg shadow-primary/20 hover:opacity-90",
    secondary: "bg-surface-container-high text-primary hover:bg-surface-container-highest",
  };

  return (
    <button
      className={cn(
        "px-6 py-2 rounded-lg font-label font-medium transition-all active:scale-[0.98]",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
