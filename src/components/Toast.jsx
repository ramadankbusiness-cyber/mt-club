import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from "lucide-react";

const ToastContext = createContext(null);

let toastId = 0;

const TOAST_STYLES = {
  success: {
    bg: "bg-green-500/15 border-green-500/30",
    icon: CheckCircle,
    iconColor: "text-green-400",
    bar: "bg-green-500",
  },
  error: {
    bg: "bg-red-500/15 border-red-500/30",
    icon: AlertCircle,
    iconColor: "text-red-400",
    bar: "bg-red-500",
  },
  warning: {
    bg: "bg-yellow-500/15 border-yellow-500/30",
    icon: AlertTriangle,
    iconColor: "text-yellow-400",
    bar: "bg-yellow-500",
  },
  info: {
    bg: "bg-cyan-500/15 border-cyan-500/30",
    icon: Info,
    iconColor: "text-cyan-400",
    bar: "bg-cyan-500",
  },
};

function Toast({ toast, onRemove }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = style.icon;
  const timerRef = useRef(null);

  const startTimer = useCallback(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), toast.duration || 4000);
  }, [toast.id, toast.duration, onRemove]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [startTimer]);

  return (
    <div
      className={`flex items-start gap-3 w-full max-w-sm p-4 rounded-xl border backdrop-blur-xl shadow-2xl animate-toast-in ${style.bg}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      role="alert"
      aria-live="assertive"
    >
      <Icon size={20} className={`${style.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-white mb-0.5">{toast.title}</p>
        )}
        <p className="text-sm text-gray-300 break-words">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-500 hover:text-white transition flex-shrink-0 p-1"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
      <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full overflow-hidden bg-white/5">
        <div
          className={`h-full rounded-full ${style.bar} opacity-60 animate-toast-progress`}
          style={{ animationDuration: `${toast.duration || 4000}ms` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, options = {}) => {
    const id = ++toastId;
    const toast = {
      id,
      message: typeof message === "string" ? message : message.message || "",
      title: options.title || (typeof message === "object" ? message.title : undefined),
      type: options.type || "info",
      duration: options.duration || 4000,
    };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, options) => addToast(message, options),
    [addToast]
  );
  toast.success = (message, options) =>
    addToast(message, { ...options, type: "success" });
  toast.error = (message, options) =>
    addToast(message, { ...options, type: "error" });
  toast.warning = (message, options) =>
    addToast(message, { ...options, type: "warning" });
  toast.info = (message, options) =>
    addToast(message, { ...options, type: "info" });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto relative">
            <Toast toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
