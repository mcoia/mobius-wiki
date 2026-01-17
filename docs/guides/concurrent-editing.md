# Concurrent Editing Awareness

This guide explains how MOBIUS Wiki handles situations where multiple users edit the same page simultaneously.

> **Terminology Note:** This document refers to "edit sessions" - temporary records that track who is actively editing a page. These are separate from "auth sessions" (login/authentication). Your login session can last for days; an edit session only exists while you're in edit mode on a specific page.

## Overview

The system provides **awareness, not blocking**. Users are informed when others are editing the same page, but no one is prevented from making changes. Version history serves as the safety net for reconciling conflicts.

## Features

### 1. Edit Presence Detection

When you enter edit mode on a page, you'll see a notification if other users are also editing:

```
⚠️ Also editing: Jane Doe, Bob Smith
```

**How it works:**
- When you click "Edit", the system records your edit session
- Every 30 seconds, your browser sends a "heartbeat" to keep the session active
- The system polls for other active editors every 30 seconds
- Sessions expire after **1 hour** of no heartbeats (e.g., if you close the tab)

### 2. Save Conflict Detection

If someone else saves the page while you're editing, you'll see a conflict dialog when you try to save:

```
┌─────────────────────────────────────────────────────┐
│  ⚠️ Save Conflict                                   │
├─────────────────────────────────────────────────────┤
│  This page was modified while you were editing.     │
│                                                     │
│  Last saved by: Jane Doe                            │
│  Saved at: January 16, 2026 at 2:34 PM              │
│                                                     │
│  Your changes will overwrite their work.            │
├─────────────────────────────────────────────────────┤
│  [View Their Changes]  [Save Anyway]  [Cancel]      │
└─────────────────────────────────────────────────────┘
```

**Options:**
- **View Their Changes**: Opens version history to see what they changed
- **Save Anyway**: Overwrites their changes with yours (your choice)
- **Cancel**: Go back to editing, keep your content in the editor

## Design Philosophy

### Why No Locking?

We intentionally chose **not** to lock pages when someone is editing because:

1. **Users walk away** - Staff often start editing, get pulled into a meeting, and come back hours or days later. Locking would block others indefinitely.

2. **Version history is the safety net** - If two people save conflicting changes, both versions are preserved in history and can be reconciled.

3. **Awareness is sufficient** - Knowing "Jane is also editing" is usually enough to coordinate ("Hey Jane, are you still working on that page?")

### The "Walked Away" Scenario

If someone starts editing and closes their browser without saving:
- Their session remains "active" for up to **1 hour**
- Other editors will see them listed as "Also editing"
- After 1 hour with no heartbeats, the session expires automatically
- This is intentional - it's better to over-warn than to miss a potential conflict

## Technical Details

### Timing Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Heartbeat interval | 30 seconds | Keeps edit session alive |
| Polling interval | 30 seconds | Checks for other active editors |
| Stale threshold | 60 minutes | Time before abandoned sessions expire |

### Database Table

Edit sessions are tracked in `wiki.page_edit_sessions`:

```sql
CREATE TABLE wiki.page_edit_sessions (
  id SERIAL PRIMARY KEY,
  page_id INTEGER REFERENCES wiki.pages(id),
  user_id INTEGER REFERENCES wiki.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pages/:id/edit-session` | POST | Start or refresh edit session |
| `/pages/:id/edit-session` | DELETE | End edit session |
| `/pages/:id/edit-session/active` | GET | Get list of active editors |

### Conflict Detection

When saving, the frontend sends the version number it started editing from:

```typescript
updatePage(pageId, {
  content: html,
  expectedVersion: 5  // "I started editing version 5"
})
```

If the current version is now 6 (someone else saved), the backend returns HTTP 409 Conflict with details about who made the change.

## Troubleshooting

### "Ghost" editors showing as active
If you see someone listed as "Also editing" but they're not actually there, their session will automatically expire within 1 hour. This happens when users close their browser without exiting edit mode.

### Conflict dialog keeps appearing
This means someone else is actively saving changes to the same page. Coordinate with them directly, or use "View Their Changes" to see what's being modified.

### Session not starting
Check browser console for errors. The edit session requires authentication - make sure you're logged in.
