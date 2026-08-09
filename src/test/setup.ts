import "@testing-library/jest-dom";

// jsdom 20 under vitest 3 does not expose localStorage on this window; several
// hooks (theme, identity) read it during render. Provide a minimal in-memory
// implementation so component tests exercise the real code paths.
if (!("localStorage" in window) || window.localStorage == null) {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
