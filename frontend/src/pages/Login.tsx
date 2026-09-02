import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { connectSocket } from "../services/socket";

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function go(e: FormEvent) {
    e.preventDefault();

    try {
      const d = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("sf_token", d.token);
      localStorage.setItem("sf_email", d.user.email);
      localStorage.setItem("sf_user_id", d.user.id);
      localStorage.setItem("sf_role", d.user.role);
      localStorage.setItem("sf_addons", JSON.stringify(d.user.addons || {}));

      if (d.user.planCode) {
        localStorage.setItem("sf_plan", d.user.planCode);
      }

      connectSocket(d.token);

      nav(d.user.role === "SUPER_ADMIN" ? "/super-admin" : "/dashboard");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="auth">
      <form onSubmit={go} className="form-card">
        <h1>Sign in</h1>

        {err && <div className="error">{err}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="btn">Login</button>

        <Link to="/forgot-password">Forgot password?</Link>

        <Link to="/signup">Create a workspace</Link>
      </form>
    </div>
  );
}
