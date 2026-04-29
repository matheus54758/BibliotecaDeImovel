import { forwardRef } from "react";
import { cn } from "../lib/utils";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className={cn("space-y-2", className)}>
        <label className="block font-label text-sm font-medium text-on-surface">
          {label}
        </label>
        <div className="relative">
          {icon && (
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined text-xl">{icon}</span>
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full pr-4 py-3 bg-surface-container-high border-0 rounded text-on-surface font-body text-base focus:bg-surface-container-lowest focus:ring-2 focus:ring-surface-tint/20 focus:outline-none transition-colors placeholder:text-on-surface/30",
              icon ? "pl-12" : "pl-4",
              error && "ring-2 ring-error/20 bg-error-container/10"
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-error font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">error</span>
            {error}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = "InputField";
