# Zustand

Zustand is a small state management library for React. Think of it as a global variable that React knows how to watch — when it changes, any component reading from it re-renders automatically.

## The problem it solves

React's built-in state (`useState`) is local to a component. To share it with another component, you have to lift it up to a common parent and drill it down through props. In a large app this gets painful fast. Zustand gives you a store that any component can read from or write to directly, without threading props through the tree.

## How it works

You define a store with `create()` — it holds state and the functions that update it:

```ts
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

Any component can then subscribe to just the slice it needs:

```ts
// Only re-renders when `count` changes
const count = useStore((s) => s.count);

// Only re-renders when `increment` changes (it never does — stable reference)
const increment = useStore((s) => s.increment);
```

The selector function is how Zustand keeps re-renders surgical. If you select `s.count` and `s.name` changes, your component doesn't re-render.

## In this project

The store lives in `client/src/store/index.ts` and holds UI state that multiple components need to share:

- Which card modal is open
- Pending input requests from agents
- Which cards are pulsing (waiting on input)
- Which cards have unseen comments
- The hierarchy sidebar filter
- WebSocket connection status
- Whether the admin panel is open

The WebSocket hook writes to the store when events arrive; components like `CardTile` and `Board` read from it to update their appearance.

## Why not Redux or Context?

Redux is heavier — more boilerplate, more concepts. React Context re-renders every consumer when anything in the context changes, which causes performance issues if you're not careful. Zustand is minimal, has no boilerplate, and its selector-based subscriptions make it naturally efficient.
