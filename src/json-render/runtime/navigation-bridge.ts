/**
 * Navigation bridge.
 *
 * Action handlers are plain functions created outside the React tree, so they
 * cannot call `useNavigate()`. `RouterBridge` publishes the router's navigate
 * function here once, and the `navigate` action reads it.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

let navigateFn: ((route: string) => void) | null = null;

/** Called by the shell; replaces any previously published navigate function. */
export function publishNavigate(fn: (route: string) => void): void {
  navigateFn = fn;
}

/** Used by the `navigate` action. No-op when no router is mounted. */
export function navigateTo(route: string): void {
  navigateFn?.(route);
}

/** Mount inside a Router to wire `navigateTo` to the live router. */
export function RouterBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    publishNavigate((route) => navigate(route));
  }, [navigate]);
  return null;
}
