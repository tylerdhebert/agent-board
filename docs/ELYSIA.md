# Elysia

Elysia is a TypeScript web framework built for Bun. Think of it as the Bun equivalent of Express or Fastify, but with end-to-end type safety baked in.

## How routes are defined

Elysia uses a chained builder API:

```ts
const app = new Elysia()
  .get("/hello", () => "world")
  .post("/cards", ({ body }) => createCard(body), {
    body: t.Object({
      title: t.String(),
      statusId: t.String(),
    }),
  });
```

The `body`, `params`, and `query` schemas are defined using Elysia's `t` validator (built on TypeBox). If a request doesn't match the schema, Elysia rejects it automatically before your handler runs.

## Route grouping

Routes are split into separate files and mounted with `.use()`:

```ts
const app = new Elysia()
  .use(cardRoutes)     // prefix: /cards
  .use(statusRoutes)   // prefix: /statuses
```

Each file exports an `Elysia` instance with its own `prefix`:

```ts
export const cardRoutes = new Elysia({ prefix: "/cards" })
  .get("/", ...)
  .get("/:id", ...)
```

## WebSocket

Elysia has first-class WebSocket support using Bun's native WS server under the hood:

```ts
app.ws("/ws", {
  open(ws) { ... },
  message(ws, data) { ... },
  close(ws) { ... },
});
```

## How it's used here

All API routes live in `server/src/routes/` and are mounted under the `/api` prefix in `server/src/index.ts`. The `t` validator schemas double as runtime validation and TypeScript types, so the handler's `body` parameter is fully typed with no extra work.
