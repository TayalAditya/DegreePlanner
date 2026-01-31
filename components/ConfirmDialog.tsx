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
      button: "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
      icon: "text-red-600 dark:text-red-400",
    },
    warning: {
      button: "bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800",
      icon: "text-yellow-600 dark:text-yellow-400",
    },
    info: {
      button: "bg-primary hover:bg-primary-hover",
      icon: "text-primary",
    },
  };

  const variant = options?.variant || "info";
  const styles = variantStyles[variant];

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface dark:bg-surface rounded-lg shadow-xl max-w-md w-full animate-scale-in">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {options.title}
                </h3>
                <button
                  onClick={handleCancel}
                  className="text-foreground-secondary hover:text-foreground"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-foreground-secondary mb-6">{options.message}</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-border rounded-md text-foreground-secondary hover:bg-background-secondary transition-colors"
                >
                  {options.cancelText || "Cancel"}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-white rounded-md transition-colors ${styles.button}`}
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
