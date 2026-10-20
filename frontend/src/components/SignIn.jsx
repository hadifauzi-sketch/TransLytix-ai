import React, { useState } from "react";
import { Eye, EyeOff, LogIn, Zap, Sun, Moon } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function SignIn({ onSignIn, onSwitchToSignUp, colorMode, toggleColorMode, colorModeVars, noticeMessage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address");
      valid = false;
    }
    if (!password || password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      valid = false;
    }
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await onSignIn(email, password);
    } catch (err) {
      setServerError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 font-sans bg-background text-foreground transition-colors duration-200 ${colorMode === "dark" ? "dark" : ""}`}
      style={{ ...colorModeVars }}
    >
      {/* Subtle radial brand glow behind card */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-0 opacity-60"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% 35%, hsl(var(--ui-brand) / 0.10), transparent 70%)",
        }}
      />

      {/* Color mode toggle */}
      <Button
        variant="glass"
        size="icon"
        onClick={toggleColorMode}
        className="fixed top-4 right-4 z-10"
        title={`Switch to ${colorMode === "dark" ? "light" : "dark"} mode`}
      >
        {colorMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </Button>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <Card variant="glass" className="p-8 rounded-2xl">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg, hsl(var(--ui-brand)), var(--purple))" }}
            >
              <Zap size={24} className="text-brand-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              Transformer Asset ML
            </h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          {noticeMessage && (
            <Card
              variant="glass"
              className="mb-4 px-3 py-2 text-center text-sm border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            >
              {noticeMessage}
            </Card>
          )}

          {serverError && (
            <Card
              variant="glass"
              className="mb-4 px-3 py-2 text-center text-sm border-destructive/40 bg-destructive/10 text-destructive"
            >
              {serverError}
            </Card>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest font-medium mb-2 block text-muted-foreground" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {emailError && <p className="text-xs mt-1 text-destructive">{emailError}</p>}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-widest font-medium mb-2 block text-muted-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`pr-10 ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && <p className="text-xs mt-1 text-destructive">{passwordError}</p>}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="h-4 w-4 rounded border-border bg-card/40 accent-[hsl(var(--ui-brand))]" />
              <span className="text-sm text-muted-foreground">Remember me</span>
            </label>

            <Button
              type="submit"
              variant="glass-brand"
              size="lg"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? (
                <span className="spinner h-5 w-5" />
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm mt-6 text-muted-foreground">
            Don't have an account?{" "}
            <button
              onClick={onSwitchToSignUp}
              className="font-semibold text-brand hover:underline bg-transparent border-none cursor-pointer"
            >
              Sign up
            </button>
          </p>
        </Card>

        <p className="text-center text-xs mt-6 text-muted-foreground/60">
          Transformer DGA ML Analytics Platform
        </p>
      </div>
    </div>
  );
}
