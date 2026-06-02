# Forsthaus Korleput — Rooms + Food App (v2)

Same app as before, but now with food planning bolted on. Same Supabase project, same Vercel deploy.

## What it does
- **Rooms**: interactive floor plan, per-night booking, optimizer (private vs share, families together)
- **Food**: diet survey, "what I'm bringing" sign-up, host-defined menu, quantity calculator that subtracts what guests bring

## Quick setup (if you've never deployed it)

### 1. Supabase (5 min)
- New project → SQL Editor → paste `supabase-schema.sql` → Run
- Settings → API → copy Project URL + anon key

### 2. GitHub
- New repo → push this folder

### 3. Vercel
- Import repo, add env vars before deploy:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploy → share the URL

## How to use food planning (host workflow)

1. **Send the link to guests**. They fill in their diet under `food → diet survey` (one entry per person, can update later).
2. **You build the menu** under `food → menu` (host mode). For each dish, mark which diets it covers (a meat main only covers omni; a green salad covers everyone).
3. **Guests sign up** to bring dishes under `food → what to bring`. Their items get matched (loosely, by name) to your menu dishes.
4. **You read off the plan** under `food → plan`. Each dish shows total quantity needed, who's bringing what, and warnings if any diet has no main course.

## How the quantity math works

- Headcount: pulled from the diet survey. If no survey data yet, falls back to defaults (Fri: 22 adults + 12 kids; Sat+Sun: 28 adults + 17 kids — all assumed omnivore).
- Kids count as 0.6 adult-equivalents (detected by parentheses in the name, e.g. "Lucia (8)").
- **Mains**: each eater is assigned to the most-restrictive main they can eat (vegan first, then veg, etc.). So if a vegan main and an omni main both exist, vegans go to the vegan one, omnis go to the omni one.
- **Non-mains** (sides, salads, bread): every eater whose diet is covered gets a full portion.
- **Bring-items**: matched by string-containment in the dish name. So a guest bringing "potato salad" matches a menu dish called "Potato salad".

## Diet/portion defaults — adjust to taste
Defaults seeded in `lib/data.ts`:
- Adult portions (grams per person, edit per dish in the UI):
  - Main: 200g
  - Side: 150g
  - Salad: 80g
  - Bread: 80g
  - Dessert: 120g
- Headcounts per meal: in `lib/data.ts` → `MEAL_DEFAULT_HEADS`
- Host PIN: `1234` — change in `lib/data.ts` → `HOST_PIN`

## What's NOT in this app (deliberate)
- Cost tracking / splitting
- Recipes / cooking instructions
- Per-meal drink modeling (drinks are one weekend-wide list)
- Auth (it's a PIN, not a password — fine for a birthday)
