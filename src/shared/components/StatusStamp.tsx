import type { BoardStatusKey } from "../../board";
import { statusStyles } from "../statusStyles";

type StatusStampProps = {
 statusKey: BoardStatusKey;
 label: string;
 className?: string;
};

export function StatusStamp({ statusKey, label, className = "" }: StatusStampProps) {
 return (
  <span
   key={statusKey}
   aria-hidden="true"
   className={`animate-stamp-in pointer-events-none inline-block -rotate-3 rounded-sm border-[1.5px] px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-ink ${statusStyles[statusKey].border} ${className}`}
  >
   {label}
  </span>
 );
}
