import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";

// The access token lives only in memory. The long-lived refresh token is an httpOnly cookie that scripts cannot read,
// so an XSS bug cannot steal a session that outlives the page.
const HINT = "nexacart.session";

/**
 * A plain flag (not a credential) that says this browser had a session. Without it there is no refresh cookie either,
 * so the app skips the silent refresh and first-time visitors never trigger a failing request.
 */
export const hasSessionHint = () => {
  try {
    return localStorage.getItem(HINT) === "1";
  } catch {
    return false;
  }
};
export const setSessionHint = (on: boolean) => {
  try {
    if (on) localStorage.setItem(HINT, "1");
    else localStorage.removeItem(HINT);
  } catch {
    /* storage blocked: the app falls back to trying the refresh every time */
  }
};

export type AuthState = { status: "unknown" | "anonymous" | "authenticated"; user: User | null; accessToken: string | null };

const slice = createSlice({
  name: "auth",
  initialState: { status: "unknown", user: null, accessToken: null } as AuthState,
  reducers: {
    setSession: (_s, a: PayloadAction<{ user: User; accessToken: string }>): AuthState => ({
      status: "authenticated",
      user: a.payload.user,
      accessToken: a.payload.accessToken,
    }),
    signedOut: (): AuthState => ({ status: "anonymous", user: null, accessToken: null }),
  },
});

export const { setSession, signedOut } = slice.actions;
export default slice.reducer;
