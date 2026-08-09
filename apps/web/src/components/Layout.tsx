import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

export function Layout() {
  const { state, signOut } = useAuth();
  const user = state.status === "signedIn" ? state.user : null;
  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>FieldPulse</h1>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/accounts">Accounts</NavLink>
        <NavLink to="/visits">Visits</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <div className="spacer" />
        {user && <span className="muted">{user.name}</span>}
        <a href="#" onClick={(e) => { e.preventDefault(); void signOut(); }}>Sign out</a>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
