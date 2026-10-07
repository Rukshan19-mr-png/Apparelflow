"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [role, setRole] = useState("cutting_supervisor");
  const [error, setError] = useState("");
  const router = useRouter();

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      setError("Unable to start demo session.");
      return;
    }
    router.push(role === "cutting_verifier" ? "/verifier" : role === "sewing_supervisor" ? "/sewing" : "/dashboard");
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={login}>
        <span className="eyebrow">APPARELFLOW ERP</span>
        <h1>Sign in to your workspace</h1>
        <p>Choose a demo role to open its production workspace.</p>
        <label htmlFor="role">Workspace role</label>
        <select id="role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="cutting_supervisor">Cutting Supervisor</option>
          <option value="cutting_verifier">Cutting Verifier</option>
          <option value="sewing_supervisor">Sewing Supervisor</option>
        </select>
        {error && <p role="alert">{error}</p>}
        <button className="primary-button" type="submit">Continue</button>
      </form>
    </main>
  );
}
