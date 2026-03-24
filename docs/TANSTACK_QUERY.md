# TanStack Query (React Query)

TanStack Query is a server state library for React. It handles fetching, caching, and synchronizing data from the API so your components don't have to manage loading states, stale data, or refetch logic manually.

## The core idea

`useQuery` fetches data and caches it under a key. Any component that uses the same key shares the same cached data — only one network request is made no matter how many components subscribe:

```ts
const { data: cards = [] } = useQuery<Card[]>({
  queryKey: ["cards"],
  queryFn: async () => {
    const res = await fetch(`${API_BASE}/cards`);
    return res.json();
  },
  staleTime: 5_000, // treat cached data as fresh for 5 seconds
});
```

## Cache invalidation

When data changes (e.g. a card is updated), you tell React Query the cache is stale and it refetches in the background:

```ts
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ["cards"] });
```

In this project, invalidation is driven by WebSocket events — when the server broadcasts `card:updated`, the WebSocket hook invalidates `["cards"]` and any open card detail query, so every component sees fresh data without polling.

## Mutations

`useMutation` handles write operations (POST, PATCH, DELETE):

```ts
const createMutation = useMutation({
  mutationFn: async (title: string) => {
    const res = await fetch(`${API_BASE}/cards`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  },
});

// Trigger it
createMutation.mutate("New card title");
```

`isPending` on the mutation gives you loading state for free.

## staleTime

`staleTime` controls how long cached data is considered fresh before React Query will refetch it in the background. In this project:
- Cards: `5_000` (5s) — changes frequently due to agent activity
- Statuses, epics, features: `30_000` (30s) — changes rarely
- Input requests: `Infinity` — seeded once on load, then kept live via WebSocket

## Why not fetch in useEffect

`useEffect` + `useState` for data fetching means reinventing loading states, error handling, deduplication, and caching from scratch. TanStack Query gives all of that plus background refetching, window focus refetching, and shared cache across components.
