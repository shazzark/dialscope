# DialScope architecture

## Shared core and entry points

`src/lookup.ts` owns phone parsing, validity, formatting, and offline numbering metadata lookup. `src/summary.ts` counts batch outcomes and identities. `src/batch.ts` owns the existing bounded CSV file workflow, including formula-safe serialization, collision checks, and atomic writes. The command-line entry point composes those modules; it does not start a network listener.

`src/api.ts` is a Fastify transport adapter over the same lookup and summary functions. It validates request bodies and serializes responses at the HTTP boundary. It does not read or write files, persist phone data, or create a database. `src/server.ts` is the explicit process entry point; only running `dialscope-api` or `npm run start:api` binds a socket. The package root remains a side-effect-free library entry. The optional `dialscope/api` export exposes the injection-friendly API factory without starting it.

## API resource controls

The API limits request bodies to 32 KiB, batches to 100 entries, each number to 64 characters, lookup concurrency to four, and request/handler timeouts to ten seconds. Fastify's JSON schema validation rejects unknown fields. Rate limiting uses a local in-memory per-IP store; multiple server processes do not share counters. The default bind address is loopback, and CORS stays disabled unless exact origins are configured. No authentication is included. Public hosting needs an explicit authentication layer and deployment-specific shared rate limiting and abuse controls.

Request payloads and phone values are not emitted in logs; API logging is disabled by default. Validation and number-type results describe numbering metadata and do not prove that a line is active or belongs to a caller.
