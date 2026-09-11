"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: "dark",
  setTheme: () => {},
});

/**
 * Theme handling without any React-managed script: the root layout reads the
 * `groovy-theme` cookie server-side and sets the class pre-paint. Toggling
 * updates the DOM class and the cookie, so the next server render matches.
 *
 * Toggle animation (see DESIGN.md → Motion): a top→bottom "wipe" — the new
 * theme is revealed by an animated clip-path on `::view-transition-new(root)`
 * (View Transitions API), with a 2px accent edge riding the reveal line. When
 * View Transitions are unsupported, the document is hidden, or the user
 * prefers reduced motion, the theme switches instantly instead.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const transitioningRef = useRef(false);

  useEffect(() => {
    setThemeState(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  const setTheme = (next: Theme) => {
    if (transitioningRef.current) return; // ignore clicks mid-wipe

    try {
      localStorage.setItem("groovy-theme", next);
    } catch {
      // private mode — ignore
    }
    document.cookie = `groovy-theme=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;

    const apply = () => {
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      setThemeState(next);
    };

    const doc = document as Document & {
      startViewTransition?: (callback: () => void | Promise<void>) => {
        finished: Promise<void>;
      };
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
      typeof doc.startViewTransition !== "function" ||
      reduced ||
      document.visibilityState !== "visible"
    ) {
      apply();
      return;
    }

    transitioningRef.current = true;
    doc.startViewTransition(() => {
      // flushSync forces React to render the new theme INSIDE the transition
      // snapshot — otherwise the render lands after the capture and the page
      // visibly "loads" a second time once the wipe finishes.
      flushSync(() => {
        apply();
      });
    });

    // The accent edge rides exactly at the reveal boundary — a real element
    // animated with the same duration/easing as the clip-path in globals.css.
    const edge = document.createElement("div");
    edge.setAttribute("aria-hidden", "true");
    edge.style.cssText =
      "position:fixed;left:0;right:0;top:0;height:2px;z-index:2147483647;pointer-events:none;background:var(--primary);will-change:top;";
    document.body.appendChild(edge);
    const sweep = edge.animate([{ top: "0%" }, { top: "100%" }], {
      duration: 420,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
    });

    // Release on the sweep's own clock — a WAAPI finish always fires, while
    // `transition.finished` can stay pending in some environments and would
    // dead-lock the toggle.
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      sweep.cancel();
      edge.remove();
      transitioningRef.current = false;
    };
    sweep.finished.then(release, release);
    window.setTimeout(release, 500);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
