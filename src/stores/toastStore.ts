import { create } from "zustand";
import { logger } from "@/utils/logger";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  isFading?: boolean;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: Toast["type"], message: string) => string;
  removeToast: (id: string) => void;
  fadeOutToast: (id: string) => void;
  cleanup: () => void;
}

const TOAST_LEVEL_MAP: Record<Toast["type"], "info" | "warn" | "error"> = {
  success: "info",
  info: "info",
  warning: "warn",
  error: "error",
};

const FADE_OUT_DURATION = 300;
const TOAST_DISPLAY_DURATION = 4000;
const AUTO_REMOVE_DELAY = 100;

let toastCounter = 0;
const timeoutRefs = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  addToast: (type, message) => {
    const level = TOAST_LEVEL_MAP[type];
    logger[level](`[Toast] ${message}`);

    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, isFading: false }],
    }));

    const fadeTimeout = setTimeout(() => {
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

      const removeTimeout = setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
        timeoutRefs.delete(id);
      }, FADE_OUT_DURATION);

      timeoutRefs.set(`${id}-remove`, removeTimeout);
    }, TOAST_DISPLAY_DURATION);

    timeoutRefs.set(id, fadeTimeout);
    return id;
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
        timeoutRefs.delete(id);
      }, FADE_OUT_DURATION);
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
      timeoutRefs.delete(id);
    }, FADE_OUT_DURATION);
  },
  cleanup: () => {
    timeoutRefs.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.clear();
    set({ toasts: [] });
  },
}));
