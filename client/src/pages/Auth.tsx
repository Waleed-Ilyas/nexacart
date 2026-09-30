import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { errorMessage, fieldErrors, useLoginMutation, useRegisterMutation } from "../api";
import { Field } from "../components/ui";
import { setSession } from "../features/authSlice";
import { useAppDispatch, useAppSelector } from "../hooks";

const DEMOS = [
  { label: "Demo shopper", email: "demo@waleed.dev", password: "Demo@1234" },
  { label: "Demo admin", email: "admin@waleed.dev", password: "Admin@1234" },
];

function useAfterAuth() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith("/") ? from : "/";
}

export function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const to = useAfterAuth();
  const status = useAppSelector((s) => s.auth.status);
  const [login, { isLoading }] = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  if (status === "authenticated") return <Navigate to={to} replace />;

  const submit = async (e?: React.FormEvent, creds = { email, password }) => {
    e?.preventDefault();
    setError("");
    setFields({});
    try {
      dispatch(setSession(await login(creds).unwrap()));
      navigate(to, { replace: true });
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  };

  return (
    <div className="wrap grid gap-8 py-14 md:grid-cols-2 md:py-20">
      <div>
        <h1 className="display text-5xl">Sign in</h1>
        <form onSubmit={submit} noValidate className="mt-6 max-w-sm space-y-4">
          <Field id="email" label="Email" error={fields.email}>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={fields.email ? true : undefined}
              aria-describedby={fields.email ? "email-error" : undefined}
            />
          </Field>
          <Field id="password" label="Password" error={fields.password}>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fields.password ? true : undefined}
              aria-describedby={fields.password ? "password-error" : undefined}
            />
          </Field>
          {error && !Object.keys(fields).length && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-sm text-ink-2">
          New here?{" "}
          <Link to="/register" state={{ from: to }} className="underline underline-offset-4 hover:text-accent">
            Create an account
          </Link>
        </p>
      </div>
      <aside className="card h-fit p-6">
        <h2 className="text-lg font-medium">Try a demo account</h2>
        <p className="mt-1 text-sm text-ink-2">
          One click signs you in. The admin account shows the dashboard, products and order management. On this public demo it cannot edit or delete products.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {DEMOS.map((d) => (
            <button key={d.email} className="btn" disabled={isLoading} onClick={() => submit(undefined, { email: d.email, password: d.password })}>
              {d.label}
            </button>
          ))}
        </div>
        <dl className="mt-5 space-y-1 font-mono text-xs text-ink-3">
          {DEMOS.map((d) => (
            <div key={d.email}>
              {d.email} / {d.password}
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

export function Register() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const to = useAfterAuth();
  const status = useAppSelector((s) => s.auth.status);
  const [register, { isLoading }] = useRegisterMutation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  if (status === "authenticated") return <Navigate to={to} replace />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFields({});
    try {
      dispatch(setSession(await register(form).unwrap()));
      navigate(to, { replace: true });
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    }
  };

  const err = (k: string) => ({ "aria-invalid": fields[k] ? true : undefined, "aria-describedby": fields[k] ? `${k}-error` : undefined }) as const;
  return (
    <div className="wrap py-14 md:py-20">
      <h1 className="display text-5xl">Create an account</h1>
      <form onSubmit={submit} noValidate className="mt-6 max-w-sm space-y-4">
        <Field id="name" label="Name" error={fields.name}>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={set("name")} {...err("name")} />
        </Field>
        <Field id="email" label="Email" error={fields.email}>
          <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} {...err("email")} />
        </Field>
        <Field id="password" label="Password" error={fields.password}>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            {...err("password")}
          />
          <p className="mt-1 text-xs text-ink-3">At least 8 characters with a letter and a number.</p>
        </Field>
        {error && !Object.keys(fields).length && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={isLoading}>
          {isLoading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-sm text-ink-2">
        Already have an account?{" "}
        <Link to="/login" state={{ from: to }} className="underline underline-offset-4 hover:text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
