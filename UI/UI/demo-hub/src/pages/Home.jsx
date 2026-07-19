import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { API_BASE } from "../config/api.js";

const templateHighlights = [
  {
    title: "Banking",
    detail: "Retail, corporate, and digital banking journeys with AI copilots.",
  },
  {
    title: "Insurance",
    detail: "Claims, underwriting, and policy intelligence at scale.",
  },
  {
    title: "Healthcare",
    detail: "Member support and care operations with secure automation.",
  },
  {
    title: "Telecom",
    detail: "High-volume support orchestration and outage communication.",
  },
  {
    title: "Retail",
    detail: "Personalized commerce flows and service resolution assistants.",
  },
  {
    title: "Manufacturing",
    detail: "Operational workflows, quality checks, and service diagnostics.",
  },
  {
    title: "Public Sector",
    detail: "Citizen-facing services with auditability and governance.",
  },
  {
    title: "Travel & Hospitality",
    detail: "Guest support, booking workflows, and incident response.",
  },
];

export default function Home() {
  const [demos, setDemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePoc, setActivePoc] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [isNavPaused, setIsNavPaused] = useState(false);
  const currentYear = new Date().getFullYear();
  const pocRollerRef = useRef(null);
  const pocCardRefs = useRef([]);
  const navPauseTimerRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/demos`)
      .then(response => response.json())
      .then(data => {
        setDemos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch demos:", error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const roller = pocRollerRef.current;
    if (!roller) return;

    const updateActiveFromScroll = () => {
      const rollerRect = roller.getBoundingClientRect();
      const rollerCenter = rollerRect.left + rollerRect.width / 2;
      let closestIndex = 0;
      let minDistance = Number.POSITIVE_INFINITY;

      pocCardRefs.current.forEach((card, index) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - rollerCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      setActivePoc(closestIndex);
    };

    updateActiveFromScroll();
    roller.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    window.addEventListener("resize", updateActiveFromScroll);

    return () => {
      roller.removeEventListener("scroll", updateActiveFromScroll);
      window.removeEventListener("resize", updateActiveFromScroll);
    };
  }, []);

  const carouselItems = demos.map(demo => {
    const finalUrl =
      demo.url && (demo.url.startsWith("http://") || demo.url.startsWith("https://"))
        ? demo.url
        : `${API_BASE}${demo.url}`;

    return {
      name: demo.name,
      description: demo.description || "Add a short summary for this demo in the admin workspace.",
      category: demo.category || "Demo",
      previewUrl: finalUrl,
    };
  });

  const categoryChips = [
    "All",
    ...Array.from(new Set(carouselItems.map(item => item.category).filter(Boolean))).sort(),
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const filteredCarouselItems = carouselItems.filter(item => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    if (!matchesCategory) return false;

    if (queryTokens.length === 0) return true;

    const normalizedName = item.name.toLowerCase();
    return queryTokens.every(token => normalizedName.includes(token));
  });

  const safeActivePoc =
    filteredCarouselItems.length === 0
      ? 0
      : Math.min(activePoc, filteredCarouselItems.length - 1);

  useEffect(() => {
    if (filteredCarouselItems.length === 0) return;

    const initialIndex = Math.floor(filteredCarouselItems.length / 2);
    const roller = pocRollerRef.current;
    const targetCard = pocCardRefs.current[initialIndex];
    if (!roller || !targetCard) return;

    const targetLeft = targetCard.offsetLeft - (roller.clientWidth - targetCard.clientWidth) / 2;
    roller.scrollTo({ left: targetLeft, behavior: "auto" });

    const frame = window.requestAnimationFrame(() => {
      setActivePoc(initialIndex);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [filteredCarouselItems.length]);

  useEffect(() => {
    const roller = pocRollerRef.current;
    if (!roller || filteredCarouselItems.length === 0 || isCarouselPaused || isNavPaused) return;

    let frameId;
    let lastTime = performance.now();
    const speedPixelsPerSecond = 26;

    const tick = now => {
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;

      const maxScroll = Math.max(0, roller.scrollWidth - roller.clientWidth);
      if (maxScroll > 0) {
        const nextLeft = roller.scrollLeft - speedPixelsPerSecond * deltaSeconds;
        roller.scrollLeft = nextLeft <= 0 ? maxScroll : nextLeft;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [filteredCarouselItems.length, isCarouselPaused, isNavPaused]);

  useEffect(() => {
    return () => {
      if (navPauseTimerRef.current) {
        window.clearTimeout(navPauseTimerRef.current);
      }
    };
  }, []);

  const scrollToPoc = index => {
    const total = filteredCarouselItems.length;
    if (total === 0) return;

    const normalized = ((index % total) + total) % total;
    const roller = pocRollerRef.current;
    const targetCard = pocCardRefs.current[normalized];
    if (!targetCard || !roller) return;

    const targetLeft = targetCard.offsetLeft - (roller.clientWidth - targetCard.clientWidth) / 2;
    roller.scrollTo({ left: targetLeft, behavior: "smooth" });
    setActivePoc(normalized);
  };

  const navigatePoc = delta => {
    if (navPauseTimerRef.current) {
      window.clearTimeout(navPauseTimerRef.current);
    }

    setIsNavPaused(true);
    scrollToPoc(safeActivePoc + delta);

    navPauseTimerRef.current = window.setTimeout(() => {
      setIsNavPaused(false);
      navPauseTimerRef.current = null;
    }, 2200);
  };

  const scrollToShowcase = () => {
    const showcase = document.getElementById("showcase-carousel");
    if (!showcase) return;
    showcase.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container home-container">
      <header className="landing-hero">
        <div className="landing-hero-auth">
          <Link className="explore-btn explore-btn-secondary" to="/admin">
            Admin
          </Link>
        </div>
        <h1 className="hero-title">FirstSource RelAi Demo Hub</h1>
        <div className="hero-actions">
          <button type="button" className="explore-btn" onClick={scrollToShowcase}>
            View Demos
          </button>
        </div>
      </header>

      <section id="showcase-carousel" className="template-section showcase-section">
        <div className="showcase-grid">
          <h2 className="showcase-title">Published Demos</h2>

          <div className="demo-search-wrap">
            <input
              type="search"
              className="demo-search-input"
              placeholder="Search by demo name"
              aria-label="Search demos by name"
              value={searchQuery}
              onChange={event => {
                pocCardRefs.current = [];
                setActivePoc(0);
                setSearchQuery(event.target.value);
              }}
            />
          </div>

          <aside
            className="category-chip-row"
            role="tablist"
            aria-label="Filter demos by category"
          >
            {categoryChips.map(category => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={selectedCategory === category}
                className={`category-chip ${selectedCategory === category ? "active" : ""}`}
                onClick={() => {
                  pocCardRefs.current = [];
                  setActivePoc(0);
                  setSelectedCategory(category);
                }}
              >
                {category}
              </button>
            ))}
          </aside>

          <div className="showcase-content">
            {loading ? <p className="carousel-status">Loading published demos...</p> : null}

            <div className="poc-roller-shell">
              <button
                type="button"
                className="poc-nav-btn"
                aria-label="Scroll demos left"
                onClick={() => navigatePoc(-1)}
                disabled={filteredCarouselItems.length === 0}
              >
                &#8249;
              </button>

              <div
                className="template-grid"
              ref={pocRollerRef}
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
              onFocusCapture={() => setIsCarouselPaused(true)}
              onBlurCapture={() => setIsCarouselPaused(false)}
            >
              {filteredCarouselItems.map((item, index) => {
                const total = filteredCarouselItems.length;
                const rawDistance = Math.abs(index - safeActivePoc);
                const distance = Math.min(rawDistance, total - rawDistance);
                const cardStateClass = distance === 0 ? "is-center" : distance === 1 ? "is-near" : "is-far";

                return (
                  <article
                    key={`${item.name}-${index}`}
                    className={`template-card ${cardStateClass}`}
                    ref={el => {
                      pocCardRefs.current[index] = el;
                    }}
                  >
                    <div className="showcase-meta">
                      <span className="template-badge">{item.category}</span>
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <a
                      className="poc-link"
                      href={item.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Demo
                    </a>
                  </article>
                );
              })}

              {filteredCarouselItems.length === 0 ? (
                <div className="no-search-results">
                  {demos.length === 0
                    ? "No demos published yet. Use the admin workspace to add the first one."
                    : "No demos found for this search."}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="poc-nav-btn"
              aria-label="Scroll demos right"
              onClick={() => navigatePoc(1)}
              disabled={filteredCarouselItems.length === 0}
            >
              &#8250;
            </button>
          </div>
        </div>
        </div>
      </section>


      <section className="lyzr-story" aria-label="What is Lyzr">
        <div className="lyzr-story-image-panel">
          <h2 className="lyzr-story-image-title">Agentic AI – Centre of Excellence</h2>
        </div>
        <div className="lyzr-story-content">
          <p className="lyzr-story-kicker">What is Opus</p>
          <h2>Enterprise AI products, built and shipped faster.</h2>
          <p>
            Opus is an enterprise AI platform for designing, orchestrating, and
            launching production-ready assistants and workflows. It helps teams move
            from idea to business impact with governance, automation, and reusable
            building blocks.
          </p>
          <p>
            In this showcase, Firstsource solutions demonstrate how Opus powers real
            business outcomes across customer support, operations, lending, compliance,
            and intelligent decisioning.
          </p>
        </div>
      </section>

      <section className="industries-section" aria-label="Template capabilities">
        <div className="industries-shell">
          <h2>Industries We Serve</h2>
          <div className="industries-grid">
            {templateHighlights.map(highlight => (
              <article className="industry-tile" key={highlight.title}>
                <h3>{highlight.title}</h3>
                <p>{highlight.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand-block">
            <span className="footer-brand">OPUS</span>
            <p className="footer-tagline">Build, evaluate, and launch enterprise-grade AI assistants faster.</p>
          </div>

          <div className="footer-links-group">
            <h4>Quick Links</h4>
            <a href="#showcase-carousel">Unified Demo Carousel</a>
            <Link to="/admin">Admin</Link>
          </div>

          <div className="footer-links-group">
            <h4>Resources</h4>
            <a href="https://app.opus.com/" target="_blank" rel="noopener noreferrer">Opus Platform</a>
            <span>Website</span>
            <a href="mailto:support@opus.com">Contact</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {currentYear} OPUS. All rights reserved.</span>
          <div className="footer-bottom-links">
            <a href="https://www.lyzr.ai/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
            <a href="https://www.lyzr.ai/terms" target="_blank" rel="noopener noreferrer">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
