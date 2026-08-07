import { useState, useCallback, useEffect } from 'react';

// Simple in-memory toast bus. No external dependency.
let toastId = 0;
const listeners = new Set();

const notify = (message, type = 'info', duration = 3000) => {
  const t = { id: ++toastId, message, type, duration };
  listeners.forEach((fn) => fn(t));
  return t.id;
};

export const toast = {
  success: (msg, duration) => notify(msg, 'success', duration),
  error: (msg, duration) => notify(msg, 'error', duration),
  info: (msg, duration) => notify(msg, 'info', duration),
  warning: (msg, duration) => notify(msg, 'warning', duration),
};

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((t) => {
    setToasts((prev) => [...prev, t]);
    if (t.duration) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => listeners.delete(addToast);
  }, [addToast]);

  return { toasts, removeToast };
};
