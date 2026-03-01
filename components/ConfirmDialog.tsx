"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { X } from "lucide-react";

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(
  undefined
);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null
  );

  const confirm = (opts: ConfirmDialogOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    resolver?.(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolver?.(false);
  };

  const variantStyles = {
    danger: {
      button: "dp-btn-danger",
      icon: "bg-error",
    },
    warning: {
      button: "dp-btn-warning",
      icon: "bg-warning",
    },
    info: {
      button: "dp-btn-primary",
      icon: "bg-primary",
    },
  };

  const variant = options?.variant || "info";
  const styles = variantStyles[variant];

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="dp-card shadow-xl max-w-md w-full animate-scale-in">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-2 h-2.5 w-2.5 rounded-full ${styles.icon}`}
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold text-foreground">
                    {options.title}
                  </h3>
                </div>
                <button
                  onClick={handleCancel}
                  className="dp-icon-btn min-h-0 min-w-0 w-9 h-9 border-transparent bg-transparent hover:bg-surface-hover"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-foreground-secondary mb-6">{options.message}</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="dp-btn dp-btn-outline"
                >
                  {options.cancelText || "Cancel"}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`dp-btn ${styles.button}`}
                >
                  {options.confirmText || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return context;
};
