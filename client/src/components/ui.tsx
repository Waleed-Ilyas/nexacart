import type { ReactNode } from "react";
import type { OrderStatus } from "../types";

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} aria-hidden />;

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-[14px] border border-bad/30 bg-bad-soft p-5">
      <p className="font-medium text-bad">Something went wrong</p>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      {onRetry && (
        <button className="btn btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="display text-3xl">{title}</p>
      {children && <div className="mx-auto mt-3 max-w-[46ch] text-ink-2">{children}</div>}
    </div>
  );
}

const STATUS: Record<OrderStatus, string> = {
  pending: "bg-warn-soft text-warn",
  paid: "bg-accent-soft text-accent",
  shipped: "bg-sunken text-ink",
  delivered: "bg-ok-soft text-ok",
  cancelled: "bg-bad-soft text-bad",
};
export const StatusBadge = ({ status }: { status: OrderStatus }) => <span className={`badge capitalize ${STATUS[status]}`}>{status}</span>;

export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[13px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
