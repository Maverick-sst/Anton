import { Link } from "react-router-dom"
import "./Landing.css"

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <line x1="12" y1="2" x2="12" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            <line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line>
          </svg>
          Anton
        </div>
        <div className="landing-nav-links">
          <Link to="/sign-in" className="btn btn-text">Sign in</Link>
          <Link to="/sign-up" className="btn btn-primary">Try Anton</Link>
        </div>
      </header>

      <main className="landing-hero">
        <div className="landing-hero-content">
          <h1>Ask your documents anything.</h1>
          <p className="landing-hero-subtitle">
            A strictly grounded conversational agent. Upload a PDF, ask questions, and get answers cited directly from your text. No hallucinations, just facts.
          </p>
          <div className="landing-cta">
            <Link to="/sign-up" className="btn btn-primary btn-lg">Get Started</Link>
          </div>
        </div>

        <div className="landing-hero-mockup">
          <div className="mockup-header">
            <div className="mockup-dots">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
            </div>
            <span className="mockup-title">anton-chat</span>
          </div>
          <div className="mockup-body">
            <div className="mockup-msg mockup-user">What is the capital expenditure for Q3?</div>
            <div className="mockup-msg mockup-assistant">
              Based on the document, the capital expenditure for Q3 is $4.2 million, primarily driven by the expansion of the new data center facilities.
              <div className="mockup-citations">
                <span className="mockup-badge">Page 14</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
