import { RequireAdmin, RequireAuth } from "./Guards";

// Short names for the route table in App.tsx.
const Guards = { Auth: RequireAuth, Admin: RequireAdmin };
export default Guards;
