import { create } from "zustand";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  isFading?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
  fadeOutToast: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, isFading: false }],
    }));
    setTimeout(() => {
      set((state) => {
        const toast = state.toasts.find((t) => t.id === id);
        if (toast && !toast.isFading) {
          return {
            toasts: state.toasts.map((t) =>
              t.id === id ? { ...t, isFading: true } : t
            ),
          };
        }
        return state;
      });
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, 300);
    }, 4000);
  },
  removeToast: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (toast && !toast.isFading) {
      set((state) => ({
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, isFading: true } : t
        ),
      }));
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, 300);
    } else {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }
  },
  fadeOutToast: (id) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, isFading: true } : t
      ),
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 300);
  },
}));
