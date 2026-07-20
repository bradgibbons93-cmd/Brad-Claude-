# Setting Up Google MCP Server for Gmail & Calendar

This guide walks you through connecting Claude to Gmail and Google Calendar.

> **Fix note:** An earlier version of this guide told you to install
> `@anthropic-ai/google-mcp`. That package does not exist on npm — the install
> fails with a 404 error. This version uses packages that actually exist, and
> fixes the Claude Code configuration steps.

## Option 1 (Easiest): claude.ai Connectors — no installation at all

If you use Claude via claude.ai, the desktop app, or Claude Code on the web,
you don't need to install anything:

1. Go to [claude.ai/settings/connectors](https://claude.ai/settings/connectors)
2. Enable the **Gmail** and **Google Calendar** connectors
3. Sign in with your Google account and grant access

That's it — Claude gets Gmail search/read/draft and full Calendar tools in
every conversation. No Google Cloud project, no OAuth credentials, no npm.

Use Option 2 only if you specifically want a self-hosted MCP server for the
Claude Code CLI (e.g. to control scopes yourself or run offline of connectors).

## Option 2: Self-hosted MCP servers for Claude Code CLI

### Prerequisites

- Node.js 18+ and npm
- Google Cloud project with APIs enabled
- OAuth 2.0 credentials (Client ID and Client Secret)

### Step 1: Enable Required APIs

In your Google Cloud Console (https://console.cloud.google.com), ensure these APIs are enabled:

1. **Gmail API**
2. **Google Calendar API**

Go to: APIs & Services → Library → Search and enable each one.

### Step 2: Configure OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. Select "External" (or "Internal" if using Google Workspace)
3. Add required scopes:
   - `https://www.googleapis.com/auth/gmail.readonly` (read emails)
   - `https://www.googleapis.com/auth/gmail.send` (send emails)
   - `https://www.googleapis.com/auth/gmail.modify` (modify emails)
   - `https://www.googleapis.com/auth/calendar` (full calendar access)
   - `https://www.googleapis.com/auth/calendar.events` (manage events)
4. Add your email address as a **test user** (required while the app is in
   "Testing" mode, otherwise you'll get an "Access blocked" error)

### Step 3: Create OAuth Credentials

1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Desktop app"
4. Download the JSON file (save as `credentials.json` — already in `.gitignore`)

### Step 4: Install the MCP Servers

There is no official all-in-one Google MCP package from Anthropic. Use these
community-maintained servers (verified to exist on npm):

**Gmail** — [`@gongrzhe/server-gmail-autoauth-mcp`](https://www.npmjs.com/package/@gongrzhe/server-gmail-autoauth-mcp):

```bash
# Place your OAuth credentials where the server looks for them
mkdir -p ~/.gmail-mcp
cp credentials.json ~/.gmail-mcp/gcp-oauth.keys.json

# Run the one-time auth flow (opens a browser to sign in to Google)
npx @gongrzhe/server-gmail-autoauth-mcp auth
```

**Google Calendar** — [`@cocal/google-calendar-mcp`](https://www.npmjs.com/package/@cocal/google-calendar-mcp):

```bash
# No pre-install needed; it runs via npx and takes the credentials path as an env var
export GOOGLE_OAUTH_CREDENTIALS=/absolute/path/to/credentials.json
```

### Step 5: Register the Servers with Claude Code

MCP servers are **not** configured in `settings.json` — Claude Code reads them
from `.mcp.json` (project scope) or your user config. The easiest way is the
`claude mcp add` command:

```bash
# Gmail (after running the auth step above)
claude mcp add gmail -- npx @gongrzhe/server-gmail-autoauth-mcp

# Google Calendar
claude mcp add google-calendar \
  --env GOOGLE_OAUTH_CREDENTIALS=/absolute/path/to/credentials.json \
  -- npx @cocal/google-calendar-mcp
```

Add `--scope project` to either command to write the config to a shareable
`.mcp.json` in this repo instead of your user config. Equivalent `.mcp.json`:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["@gongrzhe/server-gmail-autoauth-mcp"]
    },
    "google-calendar": {
      "command": "npx",
      "args": ["@cocal/google-calendar-mcp"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/absolute/path/to/credentials.json"
      }
    }
  }
}
```

### Step 6: First-Time Authentication

- **Gmail**: authentication happens in the `auth` step above; the token is
  cached in `~/.gmail-mcp/` for future sessions.
- **Calendar**: the first time Claude uses a calendar tool, a browser window
  opens for Google OAuth. Sign in, grant the permissions, and the token is
  saved for future sessions.

Restart Claude Code (or run `/mcp`) to see the servers connect.

## Available Tools After Setup

Exact tool names vary by server version — run `/mcp` in Claude Code to list
what's connected. Broadly you get:

### Gmail Tools
- Search, list, and read emails
- Send emails and manage drafts
- Manage labels and modify messages

### Calendar Tools
- List calendars and events
- Create, update, and delete events
- Check free/busy availability

## Security Notes

- Never commit your `credentials.json` or tokens to git — this repo's
  `.gitignore` already excludes `credentials.json`, `token.json`,
  `client_secret*.json`, and `.env`
- Use environment variables for production

## Troubleshooting

**`npm error 404` installing `@anthropic-ai/google-mcp`**: that package doesn't
exist — use the packages in Step 4 of Option 2 (or Option 1 connectors) instead

**"Access blocked" error**: Add your email as a test user in OAuth consent screen

**"Invalid client" error**: Verify client ID/secret are correct

**Scopes error**: Re-authorize after adding new scopes

**Server doesn't appear in Claude Code**: MCP servers go in `.mcp.json` or via
`claude mcp add` — not in `settings.json`. Run `claude mcp list` to check.

---

Need help? Let me know which step you're on and I can guide you through it!
