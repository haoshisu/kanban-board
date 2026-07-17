import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
 title: string;
 onClose: () => void;
 children: ReactNode;
};

export function Modal({ title, onClose, children }: ModalProps) {
 const panelRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === "Escape") {
    onClose();
   }
  };

  document.addEventListener("keydown", handleKeyDown);
  panelRef.current?.focus();

  return () => document.removeEventListener("keydown", handleKeyDown);
 }, [onClose]);

 return createPortal(
  <div
   className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-8"
   onClick={onClose}
  >
   <div
    aria-label={title}
    aria-modal="true"
    className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-ink-muted/40 bg-card p-5 outline-none sm:p-6"
    onClick={(event) => event.stopPropagation()}
    ref={panelRef}
    role="dialog"
    tabIndex={-1}
   >
    <div className="mb-4 flex items-center justify-between gap-3">
     <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
      {title}
     </h2>
     <button
      aria-label="關閉"
      className="rounded-[5px] px-2 py-1 text-ink-muted transition hover:cursor-pointer hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
      onClick={onClose}
      type="button"
     >
      ✕
     </button>
    </div>
    {children}
   </div>
  </div>,
  document.body,
 );
}
