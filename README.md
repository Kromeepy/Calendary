# ChronoSync — Collaborative Calendar

A real-time, multi-user time management calendar with urgency tracking, color coding, labels, and event authorship.

## Features

- **Month / Week / Day views** — switch with buttons or keyboard shortcuts
- **Event author** — every event shows who created it (avatar + name)
- **User switcher** — click your avatar in the header to switch the "current user"; new events are attributed to whoever is active
- **Urgency levels** — Critical / High / Medium / Low with color badges
- **Countdown timers** — shows time until event starts, or live progress bar if in progress
- **Color coding** — 10 color options per event
- **Labels / tags** — add multiple labels to any event
- **Category system** — Work, Personal, Health, Social, Focus, Urgent
- **Real-time simulation** — user statuses cycle and toast notifications simulate teammates adding events
- **Persistent storage** — events saved to `localStorage`; survive page refresh
- **Delete events** — trash any event from the edit modal
- **Keyboard shortcuts** — `N` new event, `M/W/D` views, `T` today, `←/→` navigate, `Esc` close

## File Structure

```
/
├── index.html   ← HTML structure + CSS styles
├── app.js       ← All JavaScript logic (46 functions)
└── README.md
```

## Deploy to GitHub Pages

### Option A — Upload files (no git required)

1. Create a new repository at [github.com/new](https://github.com/new)
2. Name it `chronosync` (or anything you like)
3. Click **"uploading an existing file"** on the empty repo page
4. Drag and drop `index.html`, `app.js`, and `README.md`
5. Commit directly to `main`
6. Go to **Settings → Pages → Source → Deploy from branch → main / root**
7. Click **Save** — your site will be live at `https://<your-username>.github.io/<repo-name>/`

### Option B — Git CLI

```bash
git init
git add index.html app.js README.md
git commit -m "Initial commit — ChronoSync calendar"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
git push -u origin main
```

Then enable GitHub Pages in **Settings → Pages**.

## Keyboard Shortcuts

| Key      | Action       |
|----------|--------------|
| `N`      | New event    |
| `M`      | Month view   |
| `W`      | Week view    |
| `D`      | Day view     |
| `T`      | Go to today  |
| `←` `→`  | Navigate     |
| `Esc`    | Close modal  |

## Customisation

All configuration is at the top of `app.js`:

- **`USERS`** — edit names, initials, and colors for your actual team
- **`CATEGORIES`** — rename or recolor categories
- **`COLORS`** — the 10 event color swatches
- **`URGENCY`** — rename urgency levels or change their colors
- **`STORAGE_KEY`** — change the localStorage key if needed

## Real-Time Collaboration

The current version uses `localStorage` for persistence (single-browser). To enable true multi-user real-time sync, replace the `loadEvents()` / `saveEvents()` functions in `app.js` with calls to a backend (e.g. Firebase Realtime Database, Supabase, or your own REST API). The UI layer requires no changes.
