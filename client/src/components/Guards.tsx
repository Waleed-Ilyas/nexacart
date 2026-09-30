import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { useAppSelector } from "../hooks";
import { Skeleton } from "./ui";

/** Waits for the silent session restore, then sends anonymous visitors to sign in and back again. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const location = useLocation();
  if (status === "unknown")
    return (
      <div className="wrap py-16" aria-busy="true">
        <Skeleton className="h-8 w-56" />
      </div>
    );
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAppSelector((s) => s.auth.user);
  return (
    <RequireAuth>
      {user?.role === "admin" ? (
        children
      ) : (
        <div className="wrap py-20 text-center" role="alert">
          <p className="display text-4xl">Admins only</p>
          <p className="mt-3 text-ink-2">Your account does not have access to this page.</p>
          <Link to="/" className="btn mt-6">
            Back to the store
          </Link>
        </div>
      )}
    </RequireAuth>
  );
}
