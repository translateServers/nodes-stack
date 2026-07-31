import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@nebula/screen-sdk';

export type ScreenEditorNotificationLevel = 'success' | 'warning' | 'error';

interface ScreenEditorNotification {
  id: number;
  level: ScreenEditorNotificationLevel;
  message: string;
}

interface ScreenEditorNotificationApi {
  notify: (level: ScreenEditorNotificationLevel, message: string) => void;
}

const ScreenEditorNotificationContext = createContext<ScreenEditorNotificationApi | null>(null);

interface ScreenEditorNotificationProviderProps {
  children: ReactNode;
}

const LEVEL_CLASS_NAMES: Record<ScreenEditorNotificationLevel, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
};

export function ScreenEditorNotificationProvider({
  children,
}: ScreenEditorNotificationProviderProps) {
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [notifications, setNotifications] = useState<ScreenEditorNotification[]>([]);

  const dismiss = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timersRef.current.delete(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback(
    (level: ScreenEditorNotificationLevel, message: string): void => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      setNotifications((current) => [...current, { id, level, message }].slice(-4));
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), 5000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <ScreenEditorNotificationContext.Provider value={{ notify }}>
      {children}
      <div
        className="pointer-events-none absolute right-3 top-15 z-[100] flex w-[min(24rem,calc(100%-1.5rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
        data-screen-editor-notifications
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`pointer-events-auto flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-md backdrop-blur-sm ${LEVEL_CLASS_NAMES[notification.level]}`}
            role={notification.level === 'error' ? 'alert' : 'status'}
          >
            <span className="min-w-0 flex-1">{notification.message}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="关闭通知"
              onClick={() => dismiss(notification.id)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </ScreenEditorNotificationContext.Provider>
  );
}

export function useScreenEditorNotifications(): ScreenEditorNotificationApi {
  const notifications = useContext(ScreenEditorNotificationContext);
  if (notifications === null) {
    throw new Error(
      'useScreenEditorNotifications must be used within ScreenEditorNotificationProvider',
    );
  }
  return notifications;
}
