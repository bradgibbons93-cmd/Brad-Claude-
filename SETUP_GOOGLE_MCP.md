# Setting Up Google MCP Server for Gmail & Calendar

This guide walks you through connecting Claude Code to Gmail and Google Calendar using your existing Google Cloud API credentials.

## Prerequisites

- Google Cloud project with APIs enabled
- OAuth 2.0 credentials (Client ID and Client Secret)

## Step 1: Enable Required APIs

In your Google Cloud Console (https://console.cloud.google.com), ensure these APIs are enabled:

1. **Gmail API**
2. **Google Calendar API**

Go to: APIs & Services → Library → Search and enable each one.

## Step 2: Configure OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. Select "External" (or "Internal" if using Google Workspace)
3. Add required scopes:
   - `https://www.googleapis.com/auth/gmail.readonly` (read emails)
   - `https://www.googleapis.com/auth/gmail.send` (send emails)
   - `https://www.googleapis.com/auth/gmail.modify` (modify emails)
   - `https://www.googleapis.com/auth/calendar` (full calendar access)
   - `https://www.googleapis.com/auth/calendar.events` (manage events)

## Step 3: Create OAuth Credentials

1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Desktop app"
4. Download the JSON file (save as `credentials.json`)

## Step 4: Install the Google MCP Server

Run this in your terminal:

```bash
npm install -g @anthropic-ai/google-mcp
```

Or if using a local installation:

```bash
npm install @anthropic-ai/google-mcp
```

## Step 5: Configure Claude Code Settings

Add the MCP server to your Claude Code settings. 

### Option A: User Settings (applies to all projects)
Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "google": {
      "command": "npx",
      "args": ["@anthropic-ai/google-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth/callback"
      }
    }
  }
}
```

### Option B: Project Settings (this repo only)
Create `.claude/settings.json` in this repo:

```json
{
  "mcpServers": {
    "google": {
      "command": "npx",
      "args": ["@anthropic-ai/google-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

## Step 6: First-Time Authentication

When you first use the Google tools in Claude Code:

1. Claude will prompt you to authenticate
2. A browser window will open for Google OAuth
3. Sign in and grant the requested permissions
4. The token will be saved for future sessions

## Available Tools After Setup

Once configured, you'll have access to:

### Gmail Tools
- `google_gmail_list` - List emails
- `google_gmail_read` - Read specific email
- `google_gmail_send` - Send email
- `google_gmail_search` - Search emails

### Calendar Tools
- `google_calendar_list` - List calendars
- `google_calendar_events` - Get events
- `google_calendar_create_event` - Create new event
- `google_calendar_update_event` - Modify event

## Security Notes

- Never commit your `credentials.json` or secrets to git
- Add to `.gitignore`:
  ```
  credentials.json
  token.json
  .env
  ```
- Use environment variables for production

## Troubleshooting

**"Access blocked" error**: Add your email as a test user in OAuth consent screen

**"Invalid client" error**: Verify client ID/secret are correct

**Scopes error**: Re-authorize after adding new scopes

## Alternative: Community MCP Servers

There are also community-maintained Google MCP servers:
- https://github.com/anthropics/mcp-servers (official examples)
- Search npm for `mcp-google` packages

---

Need help? Let me know which step you're on and I can guide you through it!
