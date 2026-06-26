"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { HeaderUser } from "./Header";
import type { UIConfig } from "@/lib/siteConfig";
import cities from "@/data/cities.json";

const districtStateMap: Record<string, { stateSlug: string; stateName: string }> = {};
for (const c of cities as { slug: string; stateSlug: string; stateName: string }[]) {
  districtStateMap[c.slug] = { stateSlug: c.stateSlug, stateName: c.stateName };
}

// ── Section configs per page context ────────────────────────────────────────

const HOME_SECTIONS = [
  { id: "sec-hero",       icon: "🏠", label: "Overview" },
  { id: "sec-nfhs",       icon: "📊", label: "NFHS-5 vs 6" },
  { id: "sec-doctors",    icon: "👨‍⚕️", label: "Find a Doctor" },
  { id: "sec-idsp",       icon: "📊", label: "IDSP Weekly" },
  { id: "sec-leaders",    icon: "🏆", label: "Leaders" },
  { id: "sec-states",     icon: "📋", label: "All States" },
  { id: "sec-ncd",        icon: "🫀", label: "NCD Burden" },
  { id: "sec-contribute", icon: "📎", label: "Contribute" },
  { id: "sec-join",       icon: "🚀", label: "Join Vyasa" },
];

const STATE_PAGE_SECTIONS = [
  { id: "overview",       icon: "🏛️", label: "Overview" },
  { id: "ai-analysis",    icon: "🤖", label: "AI Analysis" },
  { id: "mortality",      icon: "📉", label: "Mortality" },
  { id: "disease",        icon: "🦠", label: "Disease" },
  { id: "vaccination",    icon: "💉", label: "Vaccination" },
  { id: "nutrition",      icon: "🥗", label: "Nutrition" },
  { id: "infrastructure", icon: "🏥", label: "Infrastructure" },
  { id: "environment",    icon: "🌫️", label: "Environment" },
  { id: "facilities",     icon: "📍", label: "PHC/CHC" },
  { id: "districts",      icon: "🗺️", label: "Districts" },
  { id: "trends",         icon: "📈", label: "Trends" },
  { id: "sources",        icon: "📄", label: "Data Sources" },
];

const DISTRICT_PAGE_SECTIONS = [
  { id: "overview",    icon: "🏛️", label: "Overview" },
  { id: "ai-analysis", icon: "🤖", label: "AI Analysis" },
  { id: "disease",     icon: "🦠", label: "Outbreaks" },
  { id: "environment", icon: "🌫️", label: "Air Quality" },
  { id: "facilities",  icon: "📍", label: "Facilities" },
  { id: "sources",     icon: "📄", label: "Data Sources" },
];

const ADMIN_LINKS = [
  { href: "/admin",              icon: "🏠", label: "Dashboard" },
  { href: "/admin/analytics",    icon: "📈", label: "Site Analytics" },
  { href: "/admin/ui-settings",  icon: "🎛️", label: "UI Settings" },
  { href: "/admin/sources",      icon: "🗂️", label: "Data Sources" },
  { href: "/admin/intelligence", icon: "🛰️", label: "Intelligence" },
  { href: "/admin/feedback",     icon: "💬", label: "Feedback" },
  { href: "/admin/hospitals",    icon: "🏥", label: "Health Centres" },
  { href: "/admin/data",         icon: "📊", label: "Upload Data" },
  { href: "/admin/contributors", icon: "👥", label: "Contributors" },
  { href: "/admin/team",         icon: "👤", label: "Team Editor" },
];

const CITIZENS_LINKS = [
  { href: "/citizens?tab=hospitals", icon: "🏥", label: "Find Hospital" },
  { href: "/citizens?tab=ayushman",  icon: "🛡️", label: "Ayushman Card" },
  { href: "/citizens?tab=locker",    icon: "🔐", label: "Health Locker" },
];

const PROFILE_LINKS = [
  { href: "/profile",                icon: "👤", label: "My Profile" },
  { href: "/citizens?tab=locker",    icon: "🏥", label: "Health Locker" },
  { href: "/dashboard",              icon: "📊", label: "My States" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugToTitle(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type PageCtx =
  | { kind: "home" }
  | { kind: "state";    label: string; slug: string }
  | { kind: "district"; label: string; slug: string; parentStateSlug: string; parentStateName: string }
  | { kind: "citizens" }
  | { kind: "admin" }
  | { kind: "profile" }
  | { kind: "none" };

function getPageCtx(pathname: string): PageCtx {
  if (pathname === "/") return { kind: "home" };
  if (pathname.startsWith("/citizens"))  return { kind: "citizens" };
  if (pathname.startsWith("/dashboard")) return { kind: "citizens" };
  if (pathname.startsWith("/admin"))     return { kind: "admin" };
  if (pathname.startsWith("/profile"))   return { kind: "profile" };
  const stateMatch = pathname.match(/^\/state\/([^/]+)/);
  if (stateMatch) return { kind: "state", label: slugToTitle(stateMatch[1]), slug: stateMatch[1] };
  const distMatch  = pathname.match(/^\/district\/([^/]+)/);
  if (distMatch) {
    const distSlug = distMatch[1];
    const parent   = districtStateMap[distSlug];
    return {
      kind: "district",
      label: slugToTitle(distSlug),
      slug: distSlug,
      parentStateSlug: parent?.stateSlug ?? "",
      parentStateName: parent?.stateName ?? "State",
    };
  }
  return { kind: "none" };
}

// Generic IntersectionObserver-based active section hook
function useActiveSection(sectionIds: string[]): string {
  const [active, setActive] = useState("");
  const key = sectionIds.join(",");
  useEffect(() => {
    if (!sectionIds.length) return;
    const obs = new IntersectionObserver(
      entries => {
        const vis = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis.length > 0) setActive(vis[0].target.id);
      },
      { threshold: 0.1, rootMargin: "-5% 0px -55% 0px" }
    );
    sectionIds.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

// ── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ href, icon, label, active, onClick }: { href: string; icon: string; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={`gsidebar-link${active ? " gsidebar-link--active" : ""}`}>
      <span style={{ fontSize: "1rem", flexShrink: 0 }}>{icon}</span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </Link>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GlobalSidebar({ user, uiConfig }: { user?: HeaderUser | null; uiConfig?: UIConfig | null }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const activeTab    = searchParams.get("tab") ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Track facility drawer open/close for mobile nav active state
  useEffect(() => {
    const onOpen  = () => setDrawerOpen(true);
    const onClose = () => setDrawerOpen(false);
    window.addEventListener("open-facility-drawer",  onOpen);
    window.addEventListener("close-facility-drawer", onClose);
    return () => {
      window.removeEventListener("open-facility-drawer",  onOpen);
      window.removeEventListener("close-facility-drawer", onClose);
    };
  }, []);

  const pageCtx = useMemo(() => getPageCtx(pathname), [pathname]);

  // Determine which section IDs to observe based on context
  const scrollIds = useMemo(() => {
    if (pageCtx.kind === "home")     return HOME_SECTIONS.map(s => s.id);
    if (pageCtx.kind === "state")    return STATE_PAGE_SECTIONS.map(s => s.id);
    if (pageCtx.kind === "district") return DISTRICT_PAGE_SECTIONS.map(s => s.id);
    return [];
  }, [pageCtx.kind]);

  const activeSection = useActiveSection(scrollIds);

  // UIConfig guards
  const showFindNearby       = uiConfig?.sidebar.showFindNearby       ?? true;
  const showSignInCTA        = uiConfig?.sidebar.showSignInCTA        ?? true;
  const showJoinProfessional = uiConfig?.sidebar.showJoinProfessional ?? true;
  const showAbout            = uiConfig?.sidebar.showAbout            ?? true;
  const showFAB              = uiConfig?.mobile.showFAB               ?? true;

  // Admin pages have their own dedicated layout — sidebar is not needed there
  if (pageCtx.kind === "admin") return null;

  function openFacilityDrawer() {
    window.dispatchEvent(new Event("open-facility-drawer"));
    setMobileOpen(false);
  }
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  }

  // ── Adaptive context section ─────────────────────────────────────────────
  function renderContextSection() {
    // Home — scroll shortcuts with active indicator
    if (pageCtx.kind === "home") {
      return (
        <ContextSection label="Page Sections">
          {HOME_SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => scrollTo(s.id)} className={`gsidebar-link gsidebar-btn${isActive ? " gsidebar-link--active" : " gsidebar-link--muted"}`}>
                <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{s.label}</span>
                {isActive && <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", backgroundColor: "#2dd4bf", flexShrink: 0 }} />}
              </button>
            );
          })}
        </ContextSection>
      );
    }

    // State page — scroll shortcuts with active indicator
    if (pageCtx.kind === "state") {
      return (
        <ContextSection label={pageCtx.label} backHref="/" backLabel="All States">
          {STATE_PAGE_SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => scrollTo(s.id)} className={`gsidebar-link gsidebar-btn${isActive ? " gsidebar-link--active" : " gsidebar-link--muted"}`}>
                <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{s.label}</span>
                {isActive && <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", backgroundColor: "#2dd4bf", flexShrink: 0 }} />}
              </button>
            );
          })}
        </ContextSection>
      );
    }

    // District page — scroll shortcuts
    if (pageCtx.kind === "district") {
      const backHref  = pageCtx.parentStateSlug ? `/state/${pageCtx.parentStateSlug}` : "/";
      const backLabel = pageCtx.parentStateName  ?? "All States";
      return (
        <ContextSection label={pageCtx.label} backHref={backHref} backLabel={backLabel}>
          {DISTRICT_PAGE_SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => scrollTo(s.id)} className={`gsidebar-link gsidebar-btn${isActive ? " gsidebar-link--active" : " gsidebar-link--muted"}`}>
                <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{s.label}</span>
                {isActive && <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", backgroundColor: "#2dd4bf", flexShrink: 0 }} />}
              </button>
            );
          })}
        </ContextSection>
      );
    }

    // Citizens — tab links
    if (pageCtx.kind === "citizens") {
      return (
        <ContextSection label="Citizens Centre">
          {CITIZENS_LINKS.map(l => {
            const tabParam = new URL(l.href, "http://x").searchParams.get("tab");
            const isActive = pathname.startsWith("/citizens") && activeTab === tabParam;
            return (
              <NavLink key={l.href} href={l.href} icon={l.icon} label={l.label} active={isActive} onClick={() => setMobileOpen(false)} />
            );
          })}
        </ContextSection>
      );
    }

    // Profile
    if (pageCtx.kind === "profile") {
      return (
        <ContextSection label="My Account">
          {PROFILE_LINKS.map(l => (
            <NavLink key={l.href} href={l.href} icon={l.icon} label={l.label} active={pathname === l.href} onClick={() => setMobileOpen(false)} />
          ))}
        </ContextSection>
      );
    }

    return null;
  }

  const navContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", scrollbarWidth: "none" }}>

      {/* ── Fixed nav ────────────────────────────────── */}
      <div style={{ padding: "1rem 0 0.75rem", borderBottom: "1px solid #1e3a5f" }}>
        <div style={{ fontSize: "0.55rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.65rem", paddingLeft: "1.1rem" }}>
          Navigation
        </div>
        <NavLink href="/"         icon="🏠" label="Home"            active={pathname === "/"}               onClick={() => setMobileOpen(false)} />
        <NavLink href="/citizens" icon="🏥" label="Citizens Centre" active={pathname.startsWith("/citizens")} onClick={() => setMobileOpen(false)} />
        {user && (
          <NavLink href="/dashboard" icon="📊" label="My Dashboard" active={pathname.startsWith("/dashboard")} onClick={() => setMobileOpen(false)} />
        )}
        {showFindNearby && (
          <button onClick={openFacilityDrawer} className="gsidebar-link gsidebar-btn">
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>📍</span>
            <span style={{ whiteSpace: "nowrap" }}>Find Nearby</span>
          </button>
        )}
        {user ? (
          <NavLink href="/profile" icon="👤" label={user.name.split(" ")[0]} active={pathname === "/profile"} onClick={() => setMobileOpen(false)} />
        ) : (
          <NavLink href="/auth" icon="🔑" label="Sign In" active={pathname === "/auth"} onClick={() => setMobileOpen(false)} />
        )}
      </div>

      {/* ── Adaptive context section ──────────────────── */}
      {renderContextSection()}

      {/* ── About section ───────────────────────────── */}
      {showAbout && (
        <div style={{ padding: "0.75rem 0" }}>
          <div style={{ fontSize: "0.55rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: "0.5rem", paddingLeft: "1.1rem" }}>
            About
          </div>
          <NavLink href="/team"    icon="👥" label="Our Team"     active={pathname === "/team"}    onClick={() => setMobileOpen(false)} />
          <NavLink href="/sources" icon="📊" label="Data Sources" active={pathname === "/sources"} onClick={() => setMobileOpen(false)} />
          <NavLink href="/contact" icon="✉️"  label="Contact"      active={pathname === "/contact"} onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* ── CTA block ────────────────────────────────── */}
      {(
        <div style={{ padding: "0 0.85rem 1rem", marginTop: "auto", borderTop: "1px solid #1e3a5f", paddingTop: "0.85rem" }}>
          {!user && showSignInCTA && (
            <Link
              href="/auth"
              onClick={() => setMobileOpen(false)}
              style={{ display: "block", textAlign: "center", backgroundColor: "#0d9488", color: "#fff", padding: "0.65rem 1rem", borderRadius: "8px", textDecoration: "none", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem" }}
            >
              Sign In — See Your State →
            </Link>
          )}
          {showJoinProfessional && (
            <Link
              href="/join#join-form"
              onClick={() => setMobileOpen(false)}
              style={{ display: "block", textAlign: "center", backgroundColor: "transparent", border: "1px solid #1e3a5f", color: "#475569", padding: "0.5rem 1rem", borderRadius: "8px", textDecoration: "none", fontSize: "0.75rem", fontWeight: 500 }}
            >
              Join as Professional (Doctors)
            </Link>
          )}
          <div style={{ fontSize: "0.56rem", color: "#1e3a5f", lineHeight: 1.5, marginTop: "0.65rem", textAlign: "center" }}>
            IDSP · NFHS-6 · SRS 2023 · MoHFW
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="global-sidebar-desktop">
        <div className="global-sidebar-inner">{navContent}</div>
      </aside>

      {showFAB && (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          <button className={`mobile-bottom-nav-item${pathname === "/" ? " active" : ""}`} onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <span>☰</span>
            <span>Menu</span>
          </button>
          {user ? (
            <Link href="/dashboard" className={`mobile-bottom-nav-item${pathname.startsWith("/dashboard") ? " active" : ""}`} style={{ textDecoration: "none" }}>
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
          ) : (
            <Link href="/citizens" className={`mobile-bottom-nav-item${pathname.startsWith("/citizens") ? " active" : ""}`} style={{ textDecoration: "none" }}>
              <span>🏥</span>
              <span>Citizens</span>
            </Link>
          )}
          <button className={`mobile-bottom-nav-item${drawerOpen ? " active" : ""}`} onClick={openFacilityDrawer} aria-label="Find nearby">
            <span>📍</span>
            <span>Find Nearby</span>
          </button>
          <Link href={user ? "/profile" : "/auth"} className={`mobile-bottom-nav-item${(pathname === "/profile" || pathname === "/auth") ? " active" : ""}`} style={{ textDecoration: "none" }}>
            <span>👤</span>
            <span>{user ? (user.name.split(" ")[0]) : "Sign Up"}</span>
          </Link>
        </nav>
      )}

      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#00000088" }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "relative", width: "260px", backgroundColor: "#060d1a", borderRight: "1px solid #1e3a5f", zIndex: 1, paddingTop: "64px", height: "100vh", overflowY: "auto", scrollbarWidth: "none" }}
          >
            <button onClick={() => setMobileOpen(false)} style={{ position: "absolute", top: "0.85rem", right: "0.85rem", background: "none", border: "none", color: "#94a3b8", fontSize: "1.25rem", cursor: "pointer", padding: "0.25rem" }} aria-label="Close navigation">✕</button>
            {navContent}
          </div>
        </div>
      )}

      <style>{`
        .global-sidebar-desktop {
          width: 240px; flex-shrink: 0;
        }
        .global-sidebar-inner {
          position: fixed; top: 64px; left: 0;
          height: calc(100vh - 64px); width: 240px;
          background-color: #060d1a; border-right: 1px solid #1e3a5f;
          display: flex; flex-direction: column; overflow: hidden; z-index: 10;
        }
        .global-sidebar-inner::-webkit-scrollbar { display: none; }
        .global-sidebar-fab { display: none !important; }
        .gsidebar-link {
          display: flex; align-items: center; gap: 0.7rem;
          padding: 0.5rem 0.85rem 0.5rem 1.1rem;
          background: transparent; border: none; border-left: 3px solid transparent;
          color: #94a3b8; text-decoration: none; font-family: inherit;
          font-size: 0.82rem; font-weight: 500; cursor: pointer; text-align: left;
          width: 100%; border-radius: 0 8px 8px 0; min-height: 40px;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .gsidebar-link:hover { background: #0f2040; color: #e2e8f0; }
        .gsidebar-link--active { background: #0f2040 !important; border-left-color: #2dd4bf !important; color: #e2e8f0 !important; font-weight: 600; }
        .gsidebar-link--muted { color: #475569; }
        .gsidebar-link--muted:hover { color: #94a3b8; }
        .gsidebar-btn { font-family: inherit; }
        .mobile-bottom-nav {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
          background: rgba(6, 14, 30, 0.82);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border-top: 1px solid rgba(45, 212, 191, 0.12);
          box-shadow: 0 -1px 0 rgba(0,0,0,0.4), 0 -8px 24px rgba(0,0,0,0.3);
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
        .mobile-bottom-nav-item {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.18rem; flex: 1; padding: 0.6rem 0 0.55rem;
          color: #4a6180; font-size: 0.6rem; font-family: inherit; font-weight: 600;
          background: none; border: none; cursor: pointer;
          position: relative; transition: color 0.15s;
          letter-spacing: 0.01em;
        }
        .mobile-bottom-nav-item:hover { color: #94a3b8; }
        .mobile-bottom-nav-item.active { color: #2dd4bf; }
        .mobile-bottom-nav-item.active::after {
          content: ""; position: absolute; top: 0; left: 20%; right: 20%;
          height: 2px; background: #2dd4bf;
          border-radius: 0 0 3px 3px;
        }
        .mobile-bottom-nav-item span:first-child { font-size: 1.2rem; line-height: 1; }
        @media (max-width: 900px) {
          .global-sidebar-desktop { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
          body { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </>
  );
}

// ── ContextSection wrapper ───────────────────────────────────────────────────

function ContextSection({ label, backHref, backLabel, children }: { label: string; backHref?: string; backLabel?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "0.75rem 0", borderBottom: "1px solid #1e3a5f" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "1.1rem", paddingRight: "0.85rem", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.55rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
          {label}
        </div>
        {backHref && (
          <Link href={backHref} style={{ fontSize: "0.6rem", color: "#475569", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.2rem" }}>
            ← {backLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
