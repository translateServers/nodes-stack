import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const emptyState: ConfirmState = {
  open: false,
  title: '',
  description: '',
  resolve: null,
};

let state = emptyState;
let listeners: Array<() => void> = [];

function emit() {
  for (const l of listeners) l();
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    state = { ...options, open: true, resolve };
    emit();
  });
}

function handleClose(confirmed: boolean) {
  state.resolve?.(confirmed);
  state = emptyState;
  emit();
}

export function ConfirmDialogProvider() {
  const { open, title, description, confirmText, cancelText } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleClose(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <AlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {cancelText ?? '取消'}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              handleClose(true);
            }}
          >
            {confirmText ?? '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
