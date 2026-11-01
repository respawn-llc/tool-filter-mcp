[![npm version](https://badge.fury.io/js/@respawn-app%2Ftool-filter-mcp.svg)](https://www.npmjs.com/package/@respawn-app/tool-filter-mcp)

MCP proxy server that filters tools from upstream MCP servers via regex-based allow and deny lists.

#### Maintained: ✅ Yes (Winter 2027)

## Why use this?

For effective context engineering, we want to minimize useless tokens. Most major agents right now (e.g. Claude Code)
do NOT [remove tool descriptions](https://github.com/anthropics/claude-code/issues/6759) from the context.
Even though the tool is completely denied and unused, the model will still get its entire description and **still**
try to call the tool (and get error messages). For big MCPs, such as github, supabase, jetbrains IDE, atlassian, this 
is catastrophic to the context and leads to context pollution by 40-60k of **useless** tokens. 
You wanted your agent to be able to see jira ticket descriptions?
Please also have these 44 useless tools to edit assignees on confluence pages.

This MCP completely solves the issue without introducing any overhead. Contributions welcome!

## Installation

```bash
# For HTTP/SSE MCP servers
npx @respawn-app/tool-filter-mcp --upstream <url> --deny <patterns>

# For stdio MCP servers
npx @respawn-app/tool-filter-mcp --upstream-stdio --deny <patterns> -- <command> [args...]
```

## Usage

### Basic Example (HTTP/SSE)

Filter tools matching `.*_file$` pattern from an HTTP MCP server:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --deny ".*_file$"
```

### Basic Example (stdio)

Filter tools from a local stdio MCP server:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream-stdio \
  --deny "dangerous_.*" \
  -- npx my-mcp-server
```

### With Environment Variables (stdio)

Pass environment variables to the upstream stdio server:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream-stdio \
  --env "API_KEY=secret123" \
  --env "DEBUG=true" \
  --deny "admin_.*" \
  -- npx my-mcp-server
```

### Multiple Patterns

Use comma-separated patterns:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --deny "get_file_text,create_new_file,replace_text"
```

### Allow specific tools

Use `--allow` (`-a`) with comma-separated regex patterns to expose only matching tools. When both filters are set, deny takes precedence. These rules also apply to `--list-tools`.

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --allow "^read_file$,^search_code$" \
  --list-tools --format=names

npx @respawn-app/tool-filter-mcp \
  --upstream-stdio \
  --allow "^read_.*,^search_.*" \
  --deny "^read_secret$" \
  -- npx my-mcp-server
```

Matching is case-sensitive and can match part of a name. Use `^` and `$` to match a whole name. Blank comma-separated entries are ignored. An omitted or blank allow list leaves tools unrestricted by allow. A nonempty allow list that matches no tools exposes no tools. Invalid regex patterns and patterns rejected by the regex-safety check cause an error in proxy and list modes.

### With Authentication Headers

Add custom headers for authentication:

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --header "Authorization: Bearer your-token-here" \
  --header "X-API-Key: your-api-key"
```

Headers support environment variable expansion (if not yet expanded by your app):

```bash
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --header "Authorization: Bearer $AUTH_TOKEN"
```

### List Available Tools

Discover what tools are available before setting up filters:

```bash
# Default table format
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --list-tools

# Get comma-separated names for copy-paste
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --list-tools --format=names

# Get full JSON with schemas
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --list-tools --format=json

# Preview filtered results
npx @respawn-app/tool-filter-mcp \
  --upstream http://localhost:3000/sse \
  --deny ".*_file$" \
  --list-tools --format=names
```

### With Claude Code

#### HTTP/SSE Upstream Server

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "filtered-http-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream",
        "http://localhost:3000/sse",
        "--deny",
        "dangerous_tool_1,dangerous_tool_2"
      ],
      "type": "stdio"
    }
  }
}
```

With authentication headers (supports environment variable expansion):

```json
{
  "mcpServers": {
    "filtered-http-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream",
        "http://localhost:3000/sse",
        "--header",
        "Authorization: Bearer ${API_TOKEN}",
        "--header",
        "X-Custom-Header: $CUSTOM_VALUE",
        "--deny",
        "sensitive_.*"
      ],
      "type": "stdio"
    }
  }
}
```

#### Stdio Upstream Server

```json
{
  "mcpServers": {
    "filtered-zen": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--deny",
        "dangerous_.*,sensitive_.*",
        "--",
        "npx",
        "my-mcp-server"
      ],
      "type": "stdio"
    }
  }
}
```

With multiple arguments to the upstream server:

```json
{
  "mcpServers": {
    "filtered-stdio-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--deny",
        "admin_.*",
        "--",
        "node",
        "my-mcp-server.js",
        "--config=config.json",
        "--verbose"
      ],
      "type": "stdio"
    }
  }
}
```

With arguments that start with dashes (like uvx):

```json
{
  "mcpServers": {
    "filtered-uvx-server": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--deny",
        "test_.*",
        "--",
        "uvx",
        "--from",
        "git+https://github.com/BeehiveInnovations/zen-mcp-server.git",
        "zen-mcp-server"
      ],
      "type": "stdio"
    }
  }
}
```

With environment variables for the upstream stdio server:

```json
{
  "mcpServers": {
    "filtered-server-with-env": {
      "command": "npx",
      "args": [
        "@respawn-app/tool-filter-mcp",
        "--upstream-stdio",
        "--env",
        "API_KEY=${MY_API_KEY}",
        "--env",
        "DEBUG=true",
        "--deny",
        "admin_.*",
        "--",
        "npx",
        "my-mcp-server"
      ],
      "type": "stdio"
    }
  }
}
```

## CLI Options

### Tool list

Print the list of available tools without starting a proxy server

- `--list-tools`: List available tools from upstream and exit
- `--format <type>`: Output format for `--list-tools` (default: `table`)
    - `table`: Human-readable table with descriptions (truncated to 100 chars)
    - `json`: Full JSON output with complete schemas
    - `names`: Comma-separated tool names for easy copy-paste

### Connection Mode (mutually exclusive)

To start the proxy server, you must specify exactly one of:

- `--upstream <url>`: Connect to upstream HTTP/SSE MCP server
- `--upstream-stdio`: Spawn and connect to upstream stdio MCP server
  - Requires command and arguments after `--` separator
  - Example: `--upstream-stdio -- npx zen-mcp-server`

### Common Options

- `--allow <patterns>`, `-a <patterns>`: Comma-separated regex patterns for tools to allow
- `--deny <patterns>`: Comma-separated regex patterns for tools to filter

### HTTP/SSE Mode Options

Only applicable with `--upstream`:

- `--header <name:value>`: Custom HTTP header to pass to upstream server (can be repeated for multiple headers)
  - Format: `--header "Header-Name: value"`
  - Supports environment variable expansion: `$VAR` or `${VAR}`
  - Example: `--header "Authorization: Bearer $TOKEN"`

### Stdio Mode Options

Only applicable with `--upstream-stdio`:

- `--env <KEY=value>`: Environment variable to pass to the upstream stdio server (can be repeated for multiple variables)
  - Format: `--env "KEY=value"`
  - Example: `--env "API_KEY=secret" --env "DEBUG=true"`
- After the `--` separator, provide the command and all its arguments
  - Everything after `--` is passed to the upstream server
  - Supports arguments starting with dashes (like `--from`, `--config`, etc.)
  - Example: `--upstream-stdio -- uvx --from git+https://... package-name`

## Requirements

- Node.js >= 26.0.0
- Upstream MCP server with:
  - SSE or Streamable HTTP transport (for `--upstream`), OR
  - stdio transport (for `--upstream-stdio`)

## License

MIT

Copyright (c) 2026 Respawn LLC
