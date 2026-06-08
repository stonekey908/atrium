# Atrium Cockpit — Setup

The cockpit works out of the box with **no setup** — it reads a committed
snapshot of the Linear board (`src/atrium-board.json`). Everything below is
**optional**: it switches the cockpit to pull the board **live** from Linear so
the Refresh button shows up-to-the-second data without anyone regenerating the
snapshot.

## Live Linear data (optional)

You need a Linear **personal API key**. This is a one-time setup.

### 1. Create a Linear API key (do once)

1. Open **https://linear.app/settings/api** in your browser (or in Linear:
   click your avatar → **Settings** → **Security & access** → **Personal API keys**).
2. Click **Create key** (or **New API key**).
3. Give it a label like `Atrium cockpit` and click **Create**.
4. Linear shows the key **once** — a long string starting with `lin_api_…`.
   **Copy it now** (you can't see it again later).

### 2. Paste the key into VS Code (do once)

1. In VS Code, open the Command Palette: **Cmd+Shift+P** (Mac) / **Ctrl+Shift+P**.
2. Type **Preferences: Open Settings (UI)** and press Enter.
3. In the settings search box at the top, type **atrium**.
4. Find **Atrium › Linear: Api Key** and paste your `lin_api_…` key into the box.
   - *You should see the field now contains your key.* It's stored in your
     machine's VS Code settings (application scope) — it is **not** committed to
     git and **not** shared.
5. (Only if your project isn't named "Atrium") set **Atrium › Linear: Project
   Name** to your exact Linear project name.

### 3. Refresh (every time you want fresh data)

- Click the **↻ Refresh** button in the cockpit header (or the refresh icon in
  the Atrium view's title bar, or run **Atrium: Refresh Board** from the
  Command Palette).
- The cockpit re-queries Linear and re-renders in place — no relaunch.

### Optional: auto-refresh

By default the cockpit only refreshes when you ask it to. To auto-refresh on a
timer, set **Atrium › Linear: Poll Seconds** (in the same settings screen) to a
number of seconds — e.g. `120`. `0` (the default) keeps it **off**. This only
does useful work when a live API key is set.

### What happens if something's wrong

- **No key set** → the cockpit silently uses the committed snapshot. Nothing breaks.
- **Key invalid / project name wrong / offline** → the cockpit falls back to the
  snapshot and shows a yellow banner explaining the live fetch failed. Fix the
  setting and Refresh again.

### Notes

- The key lives only in your VS Code settings — there's no `.env` file for this
  extension, and nothing secret is committed.
- Live mode currently brings waves, tickets, priorities, states, and acceptance
  criteria. Per-ticket **activity timelines** still come from the snapshot only
  (live activity is a follow-up); the Tests tab shows "not discovered yet" until
  test discovery lands.
