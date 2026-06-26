"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Progressive scroll-reveal. No-JS safe: content is fully visible unless this
 * component mounts and adds `.js-reveal` to <html> (see globals.css). Reveals
 * `.home-section`, `.home-hero` and any `[data-reveal]` block as it enters the
 * viewport. Re-scans on route change. Respects prefers-reduced-motion.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js-reveal");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(".home-section, .home-hero, [data-reveal]")
    );

    // Reduced motion or no observer support → show everything immediately.
    if (reduce || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach((el) => io.observe(el));

    // Reveal anything already in/near the viewport on load so the hero never
    // sits blank waiting for a scroll.
    requestAnimationFrame(() => {
      targets.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
          el.classList.add("in-view");
        }
      });
    });

    return () => io.disconnect();
  }, [pathname]);

  return null;
}
