import "./Landing.css";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <header className="landing-nav">
        <button type="button" className="brand" onClick={() => navigate("/")}>
          NovaChat
        </button>

        <nav className="nav-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate("/auth?mode=login")}
          >
            Log in
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/auth?mode=signup")}
          >
            Sign up
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="hero-badge">Powered by Gemini & Fast LLM Streaming</p>

          <h1>Ask Nova, Know More</h1>

          <p className="hero-copy">
            Experience real-time AI conversations with lightning-fast streaming,
            smart context management, and automatic conversational memory.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/auth?mode=signup")}
            >
              Start Chatting Free
            </button>
          </div>
        </section>

        <section className="showcase">
          <div className="mockup-card">
            <div className="mockup-header">NovaChat Assistant</div>

            <div className="mockup-body">
              <div className="message user-message">
                Tell me a quick tip to boost React web app performance.
              </div>

              <div className="message assistant-message">
                <span className="assistant-icon">✦</span>
                <p>
                  Use code-splitting with React.lazy() and leverage streaming
                  responses with SSE to reduce initial load latency and
                  time-to-first-token!
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="features">
          <div className="feature-card">
            <div className="feature-icon">✦</div>
            <h3>Real-time Streaming</h3>
            <p>
              Instant chunk-by-chunk token responses via optimized Server-Sent
              Events (SSE).
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">✦</div>
            <h3>Smart Summarization</h3>
            <p>
              Automatic sliding-window context compression so you never lose
              conversation history.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">✦</div>
            <h3>Private & Persistent</h3>
            <p>
              Secure session-based authentication preserving all your threads
              across devices.
            </p>
          </div>
        </section>
      </main>

      <footer id="about" className="footer">
        <p>© 2026 NovaChat. Built for personal productivity.</p>
      </footer>
    </div>
  );
}