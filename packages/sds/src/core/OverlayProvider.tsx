/**
 * Overlay Provider — portal system for Dialog, Toast, BottomSheet.
 *
 * Usage:
 *   const overlay = useOverlay();
 *   overlay.open(({ isOpen, close }) => <AlertDialog ... />);
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

interface OverlayState {
  id: string;
  isOpen: boolean;
  element: ReactNode;
}

interface OverlayController {
  open: (
    render: (props: { isOpen: boolean; close: () => void; exit: () => void }) => ReactNode,
  ) => string;
  close: (id?: string) => void;
  exit: (id?: string) => void;
}

const OverlayContext = createContext<OverlayController | null>(null);

let overlayId = 0;

export function OverlayProvider({ children }: PropsWithChildren) {
  const [overlays, setOverlays] = useState<OverlayState[]>([]);
  const lastIdRef = useRef<string>('');

  const close = useCallback((id?: string) => {
    const targetId = id ?? lastIdRef.current;
    setOverlays((prev) =>
      prev.map((o) => (o.id === targetId ? { ...o, isOpen: false } : o)),
    );
  }, []);

  const exit = useCallback((id?: string) => {
    const targetId = id ?? lastIdRef.current;
    setOverlays((prev) => prev.filter((o) => o.id !== targetId));
  }, []);

  const open = useCallback(
    (
      render: (props: {
        isOpen: boolean;
        close: () => void;
        exit: () => void;
      }) => ReactNode,
    ) => {
      const id = `overlay-${++overlayId}`;
      lastIdRef.current = id;

      setOverlays((prev) => [
        ...prev,
        {
          id,
          isOpen: true,
          element: render({
            isOpen: true,
            close: () => close(id),
            exit: () => exit(id),
          }),
        },
      ]);

      return id;
    },
    [close, exit],
  );

  const controller = useMemo<OverlayController>(
    () => ({ open, close, exit }),
    [open, close, exit],
  );

  return (
    <OverlayContext.Provider value={controller}>
      {children}
      {overlays.map((o) => (
        <React.Fragment key={o.id}>{o.element}</React.Fragment>
      ))}
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayController {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error('useOverlay must be used within an OverlayProvider (SDSProvider)');
  }
  return ctx;
}
