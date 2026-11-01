## Context

`@respawn-app/tool-filter-mcp` is a Node.js CLI that exposes an upstream MCP server through a stdio proxy. It filters tool names using a regex deny list and blocks calls to excluded tools. Upstreams use Streamable HTTP, SSE, or a spawned stdio process.

## Commands and workflow

Run commands from the repository root. This is one npm package with a committed `package-lock.json`, using Node.js versions supported by `package.json`, strict TypeScript, and the official MCP SDK.

- Run `npm run build` before testing code changes. Several unit and integration tests spawn `dist/index.js`, so running Vitest alone can exercise stale compiled code.
- Before opening a PR, run `npm run lint`, `npm run build`, `npm test -- --run`, and `npm run format:check`.
- During iteration, target a suite with `npm test -- --run tests/unit/filter.test.ts` or another test path. Rebuild after source edits if that suite launches the CLI.
- Use `npm run format` to format TypeScript under `src/` and `tests/`. It touches both trees, so check the diff for unrelated formatting changes.
- CI runs lint, build, and the full test suite on the Node.js matrix in [.github/workflows/ci.yml](.github/workflows/ci.yml). It runs for pushes and PRs targeting `master`. Run formatting checks locally as well.

For a local CLI smoke test, build and invoke the compiled entry point against a development upstream:

```sh
npm run build
node dist/index.js --upstream http://localhost:3000/mcp --list-tools --format=json
```

For stdio upstreams, put proxy options before `--` and the upstream command and its arguments after it:

```sh
node dist/index.js --upstream-stdio --deny '^admin_' -- node path/to/upstream.js
```

See [README.md](README.md) for the public CLI options and MCP client configuration examples.

## Testing instructions

- Use Vitest in its Node environment. Put parser, validation, filtering, formatting, and error-message tests in `tests/unit/`, with `*.test.ts` filenames.
- Put proxy lifecycle, forwarding, transport, and CLI behavior tests in `tests/integration/`. Use the injectable MCP client and shared fixtures for deterministic connection failures, delays, and tool responses.
- Cover both the advertised tool list and direct calls when changing filtering. Exercise an empty deny list, all tools denied, malformed or unsafe regexes, and unknown or denied tool calls.
- Cover connection failure, timeout, and disconnection paths when changing upstream handling. Test HTTP and stdio configuration separately.
- Restore `process.argv`, environment variables, console spies, and process-exit mocks after CLI tests. Close spawned processes and HTTP servers during teardown.
- Distinguish mock-backed integration tests from process-level tests. The transport suite starts local HTTP servers and launches the compiled CLI. Avoid simultaneous full-suite runs because its servers use fixed ports.
- TypeScript builds only `src/`. Passing Vitest tests is not proof that test code passes TypeScript type checking.

## Project layout and module map

- `src/index.ts`, `src/cli-args.ts`, `src/config.ts`: CLI execution, argument validation, and conversion to typed configuration.
- `src/types.ts`: shared tool and configuration types, including the HTTP/stdio discriminated union.
- `src/proxy.ts`: startup coordination, readiness, and the filtered tool cache.
- `src/upstream-client.ts`: injectable client contract, connection state, timeouts, and upstream tool cache.
- `src/client.ts`: MCP SDK adapters for HTTP/SSE and spawned stdio transports.
- `src/server.ts`: downstream stdio MCP server and tool request handlers.
- `src/filter.ts`, `src/utils/`: filtering, regex safety, header/env parsing, error sanitization, and output formatting.
- `tests/unit/`, `tests/integration/`, `tests/fixtures/`: focused tests, component/process tests, and reusable mock clients and tools.
- `dist/`: generated JavaScript, declarations, and source maps. Edit `src/` and rebuild.
- `package.json`, `server.json`, `publish.sh`: npm package metadata, MCP registry metadata, and release automation.
- `README.md`: user-facing usage. Local `docs/tmp/` and `specs/` directories contain gitignored planning material.

## Architecture notes

- Keep argument parsing and validation in the CLI boundary, configuration construction in `config.ts`, and transport-specific work in the SDK adapters. Branch on `ProxyConfig.mode` to access mode-specific fields.
- Keep filtering independent of transport. `ProxyOrchestrator` accepts an MCP client, connects, fetches tools, and computes the allowed tool list before the downstream server starts.
- Treat the tool list as a startup snapshot. Downstream listing and call authorization use the cached allowed tools. Readiness indicates completed startup, while connection status is checked separately.
- Deny patterns are JavaScript regex sources matched against tool names. Any matching pattern denies the tool. Keep tool ordering and schemas intact through filtering.
- Route allowed calls through the upstream connection. Denied and unknown tool names produce the MCP method-not-found code `-32601`.
- Use SDK request schemas at the protocol boundary. Keep diagnostics on stderr and sanitize user-facing errors through the error utilities.
- For HTTP transport changes, account for URL-dependent selection: `/sse` paths try SSE first, other paths try Streamable HTTP first. Fallback behavior depends on the attempted transport and failure, so test selection and failures together.

## Code style

- Use `.js` extensions in relative TypeScript imports. The package is ESM with Node16 module resolution and an ES2022 target.
- Follow `.prettierrc`: two spaces, semicolons, single quotes, 100-column width, trailing commas where supported by ES5, and parentheses around arrow parameters.
- Use kebab-case filenames and PascalCase types/interfaces. Keep types explicit where inference is unclear.
- Treat `biome.json` as the active lint configuration. Production rules prohibit explicit `any` and floating promises, and warn on missing function return types. Tests use a separate, less restrictive rule set.
- Prefix intentionally unused parameters with `_`. Keep source compatible with strict compilation, unused-local/parameter checks, complete return paths, and switch fallthrough checks.

## Known pitfalls

- Reserve stdout for MCP protocol messages in proxy mode and formatted results in `--list-tools` mode. A diagnostic `console.log` can corrupt the downstream protocol.
- `--list-tools` follows a separate execution and filtering path from proxy startup. When changing filter behavior or regex validation, exercise both modes.
- `server.ts` contains both an `MCPServer` wrapper used in tests and handlers registered by `createMCPServer` for the running CLI. Changes to the wrapper alone do not change the live server.
- `ToolFilterResult.invalidPatterns` means syntactically valid patterns that matched no tools. Malformed and unsafe patterns throw during filter construction.
- Header values expand `$VAR` and `${VAR}` inside the proxy. `--env` values are parsed literally and passed to the stdio transport. Do not assume the two options have identical expansion behavior.
- Keep authentication values out of logs and committed configuration. Header diagnostics should identify header names, not secret values.
- The compiled CLI is the npm executable. `prepublishOnly` builds it, but lint and tests are separate checks.

## PR and release guidance

- Use short, imperative commit subjects scoped to the change. History includes plain subjects and occasional conventional prefixes, so a prefix is optional.
- Include a brief PR summary, verification commands and outcomes, noteworthy behavior changes, and relevant issue links. Screenshots are unnecessary for this CLI-only project.
- Keep `package.json`, `package-lock.json`, and npm package versions in `server.json` aligned during releases.
- Inspect `publish.sh` before release work. It performs validation, version changes, a commit, npm publication, tagging, pushes to `master`, and MCP registry publication. Run it only for an explicitly authorized release.

## Maintain this file

Update this file when project changes affect these instructions. Remove stale guidance and add durable, project-specific knowledge. Keep it concise, factual, and under roughly 400 lines. Use repository-relative paths, and exclude secrets, personal environment assumptions, temporary status, changelogs, one-time setup steps, and generic development advice.
