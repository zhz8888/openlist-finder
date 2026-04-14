import { useToastStore } from "@/stores";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`alert shadow-lg animate-in slide-in-from-right ${
            toast.type === "success"
              ? "alert-success"
              : toast.type === "error"
                ? "alert-error"
                : toast.type === "warning"
                  ? "alert-warning"
                  : "alert-info"
          }`}
        >
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => removeToast(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
