# Forsthaus Korleput — Sleep + Food App (v3)

What's new in v3:
- **"Rooms" → "Sleep"**: now handles house rooms + tents + cars
- **Drag-and-drop + tap-tap** for guests to move themselves
- **Plan lock** for host: freeze the plan once it's set
- **"I'm…" identity** stored in localStorage so guests can only move themselves
- "Book" tab removed — host enters everyone via Supabase table editor or the optimizer

## Deploying v3 over an existing v2 deploy

1. **Supabase**: paste the new `supabase-schema.sql` into the SQL editor. It's idempotent — safe to re-run. It will add the new `outdoor_spots` and `settings` tables, plus add the `sleep_type` column to `assignments` if missing.
2. **GitHub**: replace all files with v3 contents. Commit and push.
3. **Vercel**: auto-redeploys on push. The new `@dnd-kit/core` dependency is added to package.json so it'll be installed automatically.

## How the sleep tab now works

**Guest view (map sub-tab):**
- Floor plan at top (house rooms)
- "Outside the house" section below (tents + cars)
- Mini-cards under each section show occupants as draggable chips
- Tap the "I'm…" button at the top to claim a name — your name then becomes a blue chip you can grab
- **Drag your blue chip** to another room/tent/car, OR **tap your chip then tap a destination**
- Other people's chips are visible but greyed-out (can't move them)

**Host view:**
- All the above + can drag/move anyone
- New "🔓 lock plan" button — freezes the plan, guests get locked out of edits
- New "Add an outdoor spot" form — create tents and cars
- "Run optimizer" still works — only handles house assignments, doesn't touch outdoor people

## When the party is over

Just delete the Vercel project + Supabase project. Both take 30 sec.
