import { useEffect, useState } from "react";
import TransformerAssetML from "./components/TransformerAssetML";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import { useAuth } from "./components/AuthContext";
import {
  applyColorMode,
  COLOR_MODE_STORAGE_KEY,
  COLOR_MODES,
  getInitialColorMode,
} from "./lib/theme";
import api from "./services/api";

export default function App() {
  const { user, login, logout } = useAuth();
  const [authView, setAuthView] = useState("signin"); // "signin" | "signup"
  const [authNotice, setAuthNotice] = useState("");
  const [colorMode, setColorMode] = useState(getInitialColorMode);

  const toggleColorMode = () => {
    setColorMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
      return next;
    });
  };

  const colorModeVars = COLOR_MODES[colorMode] || COLOR_MODES.dark;

  useEffect(() => {
    applyColorMode(colorMode, colorModeVars);
  }, [colorMode, colorModeVars]);

  const handleSignIn = async (email, password) => {
    setAuthNotice("");
    const userData = await api.signIn(email, password);
    login(userData);
  };

  const handleSignUp = async (name, email, password) => {
    const response = await api.signUp(name, email, password);
    setAuthNotice(response?.message || "Sign up submitted. Please wait for superadmin approval before signing in.");
    setAuthView("signin");
  };

  if (!user) {
    if (authView === "signup") {
      return (
        <SignUp
          onSignUp={handleSignUp}
          onSwitchToSignIn={() => setAuthView("signin")}
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
          colorModeVars={colorModeVars}
        />
      );
    }
    return (
      <SignIn
        onSignIn={handleSignIn}
        onSwitchToSignUp={() => {
          setAuthNotice("");
          setAuthView("signup");
        }}
        colorMode={colorMode}
        toggleColorMode={toggleColorMode}
        colorModeVars={colorModeVars}
        noticeMessage={authNotice}
      />
    );
  }

  return (
    <TransformerAssetML
      user={user}
      onLogout={logout}
      colorMode={colorMode}
      toggleColorMode={toggleColorMode}
      colorModeVars={colorModeVars}
    />
  );
}
