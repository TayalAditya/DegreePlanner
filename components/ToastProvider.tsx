"use client";

import { createContext, useContext, useRef, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: Toast["type"], message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(0);

  const showToast = (type: Toast["type"], message: string, duration = 5000) => {
    nextToastId.current += 1;
    const id = String(nextToastId.current);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-[max(1rem,calc((100vw-72rem)/2+1rem))] z-50 space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <XCircle className="w-5 h-5 text-error" />,
    warning: <AlertCircle className="w-5 h-5 text-warning" />,
    info: <AlertCircle className="w-5 h-5 text-info" />,
  };

  const bgColors = {
    success: "bg-success-light/45 border-success/20",
    error: "bg-error-light/45 border-error/20",
    warning: "bg-warning-light/45 border-warning/20",
    info: "bg-info-light/45 border-info/20",
  };

  return (
    <div
      className={`${bgColors[toast.type]} border rounded-xl p-4 shadow-lg animate-slide-in pointer-events-auto backdrop-blur-sm`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {icons[toast.type]}
        <p className="flex-1 text-sm text-foreground">{toast.message}</p>
        <button
          onClick={() => onRemove(toast.id)}
          className="dp-icon-btn min-h-0 min-w-0 w-8 h-8 border-transparent bg-transparent hover:bg-surface-hover"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
