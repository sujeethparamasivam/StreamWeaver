# StreamWeaver — No-Code ETL Pipeline

## What was fixed / completed in this pass

1. **Sandboxed custom transforms** (`server/src/services/sandboxService.ts`)
   Mapping fields can now carry an optional `transformCode` (e.g.
   `return value.toUpperCase();`), executed in an isolated V8 context with
   a 50ms timeout. The spec called for `isolated-vm`, which requires a
   native module download — unavailable with no network access in this
   environment, so it uses Node's built-in `vm` module instead (same
   function signature; swap it in later if you have network access for a
   stronger security boundary).

2. **Real streaming ETL pipeline** (`server/src/streams/batchTransformStream.ts`)
   Three reusable `stream.Transform` classes — `RowNumberingStream`,
   `BatchTransformStream`, `ByteCounterStream` — replace the inline
   per-route logic. CSV files are parsed record-by-record and never fully
   buffered in memory.

3. **Live progress over WebSockets.** The upload route now emits
   `import-progress` (percent, rows processed, rows/sec) as it streams the
   file, throttled to ~150ms. The client joins a room *before* the upload
   starts (`client/src/services/socket.ts`) so no early events are missed,
   and `UploadPage` renders a live progress bar.

4. **MongoDB `bulkWrite` in batches of 1,000** (was `insertMany` in
   batches of 500) for `UploadRow`, `ValidationRecord`, and
   `TransformedRow`.

5. **JWT auth middleware** (`server/src/middleware/authMiddleware.ts`)
   now actually protects `/api/uploads`, `/api/imports`,
   `/api/validations`, `/api/transformed`, `/api/debug` — previously only
   `/api/auth` checked tokens.

6. **Virtualized grids** using `react-window` on both the upload preview
   and the transformed-data preview, so only visible rows are ever
   mounted in the DOM.

## Running it

```bash
npm install        # from the repo root (installs client + server workspaces)
npm run dev         # runs client (Vite, :5173) and server (:5000) together
```

No `MONGO_URI` needed for local dev — the server auto-starts an in-memory
MongoDB. Set `MONGO_URI` in `server/.env` (copy `.env.example`) to point
at a real database instead.

For a single-process production build:

```bash
npm run build
npm start            # serves the built client from the Express server on :5000
```

## Known environment caveat (not a code bug)

Running `vite build` inside *this* sandbox fails with
`Cannot find module @rollup/rollup-linux-x64-gnu` — that's npm's
well-documented optional-dependency bug
(https://github.com/npm/cli/issues/4828), tied to how `node_modules` was
installed in this container, not to any code here. A plain `npm install`
on your own machine resolves it (regenerates the correct platform-specific
binary). TypeScript compiles clean for both client and server in this
environment, and the sandbox/stream logic was verified standalone (see
below) — the only thing not exercised end-to-end here is the production
Vite bundling step and a live MongoDB.

## What was verified in this environment

- `tsc` — zero errors, client and server.
- Sandbox service — tested standalone: valid transforms, multi-arg row
  access, and an infinite-loop script correctly times out and is caught.
- Streaming batch pipeline — tested standalone: 2,500 synthetic rows
  through `RowNumberingStream` → `BatchTransformStream(1000)` produced
  exactly 3 batches (1000 / 1000 / 500), matching expected bulk-write
  batching.
