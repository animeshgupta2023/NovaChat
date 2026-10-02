import { useContext, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MyContext } from "../context/MyContext.jsx";
import "./Authentication.css";

const API_URL = "http://localhost:8080";

export default function Authentication() {
  const navigate = useNavigate();
  const { setCurrentUser } = useContext(MyContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "login" ? "login" : "signup";

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const switchMode = (nextMode) => {
    setSearchParams({ mode: nextMode });
    setError("");
    setFormData((prev) => ({
      ...prev,
      password: "",
      confirmPassword: "",
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const payload = isLogin
      ? { username: formData.username, password: formData.password }
      : {
          username: formData.username,
          email: formData.email,
          password: formData.password,
        };

    try {
      const response = await fetch(`${API_URL}/auth/${isLogin ? "login" : "signup"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      const user = data.user || { username: formData.username, email: formData.email || "" };
      setCurrentUser(user);
      localStorage.setItem("novachat_logged_in", "true");
      localStorage.setItem("novachat_user", JSON.stringify(user));
      navigate("/home");
    } catch (submitError) {
      setError(submitError.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-brand">
          <div className="auth-brand-header">
            <button type="button" className="auth-brand-button" onClick={() => navigate("/")}>
              NovaChat
            </button>
          </div>

          <div className="auth-badge">
            <span className="auth-badge-dot" />
            AI workspace
          </div>

          <h1>
            Ask smarter.<br />
            <span>Ship faster.</span>
          </h1>

          <p className="auth-brand-copy">
            Turn ideas into clear, grounded conversations with persistent memory,
            fast streaming, and collaborative AI workflows.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <span className="auth-feature-mark">✓</span>
              <div>
                <strong>Fast, live responses</strong>
                <span>Stream answers as the model thinks in real time.</span>
              </div>
            </div>

            <div className="auth-feature-item">
              <span className="auth-feature-mark">✓</span>
              <div>
                <strong>Thread-aware memory</strong>
                <span>Keep context consistent across your recent conversations.</span>
              </div>
            </div>

            <div className="auth-feature-item">
              <span className="auth-feature-mark">✓</span>
              <div>
                <strong>Private & secure</strong>
                <span>Protected sessions built for personal productivity.</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${!isLogin ? "active" : ""}`}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
            <button
              type="button"
              className={`auth-tab ${isLogin ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
            <p className="auth-form-subtitle">
              {isLogin
                ? "Sign in to continue your AI conversations."
                : "Start your journey with NovaChat in seconds."}
            </p>

            <div className="auth-input-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            {!isLogin && (
              <div className="auth-input-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="auth-input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            {!isLogin && (
              <div className="auth-input-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="auth-alt">
            {isLogin ? "Need an account?" : "Already have an account?"} {" "}
            <button type="button" onClick={() => switchMode(isLogin ? "signup" : "login")}>
              {isLogin ? "Create one" : "Log in"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}