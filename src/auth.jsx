import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Heart, KeyRound, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { supabase, supabaseConfigError, supabaseConfigured } from "./lib/supabase.js";

const AuthContext = createContext(null);

function getSafeAuthErrorDetails(error) {
  const message = String(error?.message || "Unknown authentication error")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi, "[redacted key]")
    .slice(0, 240);

  return {
    name: typeof error?.name === "string" ? error.name.slice(0, 80) : "AuthError",
    code: typeof error?.code === "string" ? error.code.slice(0, 80) : undefined,
    status: Number.isFinite(error?.status) ? error.status : undefined,
    message,
  };
}

function getFriendlyLoginError(details) {
  const code = (details.code || "").toLowerCase();
  const message = details.message.toLowerCase();

  if (["invalid_credentials", "invalid_grant", "user_not_found"].includes(code)
    || message.includes("invalid login credentials")
    || message.includes("invalid password")) {
    return "That email and password do not match an authorized account.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please confirm this email address before signing in.";
  }
  if (details.status === 429 || code.includes("rate_limit")) {
    return "There have been too many attempts. Please wait a moment and try again.";
  }
  if (details.name === "AuthRetryableFetchError"
    || /network|fetch|timeout|load failed|connection/i.test(message)) {
    return "We could not reach the sign-in service. Check your connection and try again.";
  }
  if (details.status >= 500) {
    return "The sign-in service is temporarily unavailable. Please try again shortly.";
  }
  return `Sign-in failed: ${details.message}`;
}

function logAuthError(action, error) {
  const details = getSafeAuthErrorDetails(error);
  console.error(`[auth] ${action} failed`, details);
  return details;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [coupleId, setCoupleId] = useState(null);
  const [membershipError, setMembershipError] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  const login = useCallback(async (email, password) => {
    if (!supabase) throw new Error(supabaseConfigError);
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) throw new Error("Enter both your email address and password.");
    setMembershipError("");
    let result;
    try {
      result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    } catch (requestError) {
      const details = logAuthError("sign-in", requestError);
      throw new Error(getFriendlyLoginError(details));
    }
    if (result.error) {
      const details = logAuthError("sign-in", result.error);
      throw new Error(getFriendlyLoginError(details));
    }
    return result.data;
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT") {
        setCoupleId(null);
        setRecoveryMode(false);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMembershipError(error.message);
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setCoupleId(null);
      setMembershipLoading(false);
      return undefined;
    }

    let active = true;
    setMembershipLoading(true);
    setMembershipError("");
    supabase.rpc("current_couple_id").then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        setMembershipError("Private account access is not configured. Apply the Supabase setup SQL, then try again.");
        setCoupleId(null);
      } else if (!data) {
        setMembershipError("This account is not one of the two authorized members.");
        setCoupleId(null);
        await supabase.auth.signOut();
      } else {
        setCoupleId(data);
        setMembershipError("");
      }
      setMembershipLoading(false);
    }).catch(() => {
      if (!active) return;
      setMembershipError("Could not verify private account access. Check the Supabase setup and connection.");
      setCoupleId(null);
      setMembershipLoading(false);
    });

    return () => { active = false; };
  }, [session?.user?.id]);

  const value = useMemo(() => ({
    supabase,
    configured: supabaseConfigured,
    configError: supabaseConfigError,
    session,
    user: session?.user || null,
    coupleId,
    loading,
    membershipLoading,
    membershipError,
    recoveryMode,
    setRecoveryMode,
    login,
    logout,
    signOut: logout,
  }), [session, coupleId, loading, membershipLoading, membershipError, recoveryMode, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

function AuthField({ label, type, value, onChange, autoComplete, icon: Icon, trailing }) {
  const inputId = useId();

  return (
    <div className="block text-xs text-rose-100/65">
      <label htmlFor={inputId}>{label}</label>
      <span className="mt-1.5 flex items-center gap-2 rounded-md border border-rose-100/15 bg-[#1a080f] px-3 focus-within:border-rose-300/60">
        <Icon size={15} className="shrink-0 text-rose-300/65" />
        <input id={inputId} required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-rose-50 outline-none placeholder:text-rose-100/25" />
        {trailing}
      </span>
    </div>
  );
}

export function LoginScreen({ message = "" }) {
  const { recoveryMode, setRecoveryMode, user, login, logout } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRecovery = recoveryMode || mode === "recovery";
  const setupMissing = !supabaseConfigured;

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setNotice("");
    setError("");
    try {
      if (isRecovery) {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        setRecoveryMode(false);
        setMode("login");
        setPassword("");
        setNewPassword("");
        setNotice("Your password has been updated.");
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        if (resetError) throw resetError;
        setNotice("If this email belongs to an authorized account, a reset link is on its way.");
      } else {
        await login(email, password);
      }
    } catch (submitError) {
      setError(submitError.message || "That request could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = setupMissing
    ? "A private place for two"
    : isRecovery
      ? "Choose a new password"
      : mode === "reset"
        ? "Reset your password"
        : "Welcome back, love";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#210b12] px-5 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_52%_34%,_#572033_0%,_#35121e_42%,_#210b12_78%)]" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3.2, repeat: Infinity }} className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-rose-200/20 bg-rose-300/5 text-rose-300">
            <Heart size={25} className="fill-rose-400/70" />
          </motion.div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-rose-300/80">Our Love Story</p>
          <h1 className="mt-2 font-serif text-3xl text-rose-50 sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-rose-100/55">{setupMissing ? "Set up your private Supabase project to open this shared keepsake." : "Your shared memories, safe in our little corner."}</p>
        </div>

        <div className="rounded-2xl border border-rose-200/15 bg-[#2a0e18]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          {setupMissing ? (
            <div className="space-y-4 text-sm leading-6 text-rose-100/70">
              <p className="flex items-center gap-2 text-rose-100"><LockKeyhole size={16} className="text-rose-300" /> Supabase setup is required</p>
              <p>{supabaseConfigError || "Supabase setup is required."} Add <code className="text-rose-200">VITE_SUPABASE_URL</code> and <code className="text-rose-200">VITE_SUPABASE_ANON_KEY</code> to a local <code className="text-rose-200">.env.local</code>, then apply <code className="text-rose-200">supabase/setup.sql</code>.</p>
              <p className="border-t border-rose-100/10 pt-4 text-xs text-rose-100/45">The browser key is public by design. Database policies enforce access. Never put a service-role key here.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {!isRecovery && <AuthField label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" icon={Mail} />}
              {mode === "login" && !recoveryMode && <AuthField label="Password" type={showPassword ? "text" : "password"} value={password} onChange={setPassword} autoComplete="current-password" icon={KeyRound} trailing={<button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="rounded p-1 text-rose-100/45 transition hover:text-rose-100"><span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />}
              {isRecovery && <AuthField label="New password" type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" icon={KeyRound} />}

              {(error || message) && <p role="alert" className="rounded-md border border-rose-300/20 bg-rose-950/45 px-3 py-2.5 text-xs leading-5 text-rose-100">{error || message}</p>}
              {notice && <p role="status" className="rounded-md border border-rose-300/20 bg-rose-950/35 px-3 py-2.5 text-xs leading-5 text-rose-100">{notice}</p>}

              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-md bg-rose-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Please wait..." : isRecovery ? "Update password" : mode === "reset" ? "Send reset link" : "Sign in"}
                {!submitting && <Sparkles size={15} />}
              </button>

              {!isRecovery && mode === "login" && <button type="button" onClick={() => { setMode("reset"); setError(""); setNotice(""); }} className="w-full text-center text-xs text-rose-200/65 underline decoration-rose-200/20 underline-offset-4 hover:text-rose-100">Forgot password?</button>}
              {mode === "reset" && <button type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); }} className="w-full text-center text-xs text-rose-200/65 hover:text-rose-100">Back to sign in</button>}
              {user && !isRecovery && <button type="button" onClick={() => logout()} className="w-full text-center text-xs text-rose-200/65 hover:text-rose-100">Sign out of this account</button>}
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.16em] text-rose-100/35"><LockKeyhole size={12} /> Private memories for two</p>
      </motion.div>
    </main>
  );
}

export function ProtectedRoute({ children }) {
  const { configured, loading, membershipLoading, session, coupleId, membershipError, recoveryMode } = useAuth();

  if (!configured) return <LoginScreen />;
  if (loading || (session && membershipLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#210b12] text-rose-200">
        <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-rose-200/30 border-t-rose-300" />
        Checking your private space...
      </main>
    );
  }
  if (recoveryMode || !session || !coupleId) {
    return <LoginScreen message={membershipError} />;
  }
  return children;
}