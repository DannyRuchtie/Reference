"use client";

import { useState, useContext } from "react";
import { AuthContext } from "./AuthProvider";

export function InlineLoginForm() {
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    return (
      <div className="text-xs text-red-400">
        Authentication not available. Please refresh the page.
      </div>
    );
  }
  
  const { signIn, signUp } = authContext;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/50 p-2 text-xs text-red-200">{error}</div>
        )}
        <div>
          <label htmlFor="settings-email" className="mb-1 block text-xs text-zinc-400">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-zinc-700"
          />
        </div>
        <div>
          <label htmlFor="settings-password" className="mb-1 block text-xs text-zinc-400">
            Password
          </label>
          <input
            id="settings-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-zinc-700"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-xs text-zinc-400 hover:text-zinc-300"
        >
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
        {/* Placeholder for OAuth buttons - to be added later */}
        {/* <div className="mt-3 flex gap-2">
          <button type="button" className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800">
            Sign in with Apple
          </button>
          <button type="button" className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800">
            Sign in with Google
          </button>
        </div> */}
    </form>
  );
}

