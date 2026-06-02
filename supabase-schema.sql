-- Forsthaus Korleput — combined schema (rooms + food)
-- Run this once in Supabase SQL Editor (it's idempotent)

-- ============ ROOMS ============
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  lead text not null,
  type text not null,
  members jsonb not null,
  priv text not null,
  nights jsonb not null,
  created_at timestamptz default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  night text not null,
  room_id text not null,
  person_name text not null,
  created_at timestamptz default now()
);

create index if not exists assignments_night_idx on assignments(night);
create index if not exists assignments_room_idx on assignments(room_id);

-- ============ FOOD ============

-- One row per guest: their diet + which meals they're attending
create table if not exists diets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  diet text not null,           -- omni | veg | vegan | pescatarian | other
  allergies text,
  attending jsonb not null,     -- array of meal ids: ["fri_dinner","sat_breakfast",...]
  notes text,
  created_at timestamptz default now()
);

-- Host-defined dishes per meal
create table if not exists dishes (
  id uuid primary key default gen_random_uuid(),
  meal text not null,           -- fri_dinner, sat_breakfast, sat_lunch, sat_dinner, sun_brunch
  name text not null,
  category text not null,       -- main | side | salad | bread | dessert | drink | other
  covers jsonb not null,        -- array of diet tags this dish is suitable for
  portion_g int not null default 150,
  unit text not null default 'g', -- g | piece | ml | L
  notes text,
  created_at timestamptz default now()
);

-- Who brings what (per dish, optional)
create table if not exists bring_items (
  id uuid primary key default gen_random_uuid(),
  meal text not null,
  description text not null,    -- "potato salad", "2 bottles white wine"
  brought_by text not null,
  quantity text,                -- "2kg", "1 tray for 10"
  created_at timestamptz default now()
);

-- Drinks for the whole weekend (simpler model than per-meal)
create table if not exists drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qty_target text not null,     -- "20 bottles", "50L"
  notes text,
  created_at timestamptz default now()
);

create index if not exists diets_name_idx on diets(name);
create index if not exists dishes_meal_idx on dishes(meal);
create index if not exists bring_meal_idx on bring_items(meal);

-- ============ RLS ============
alter table requests enable row level security;
alter table assignments enable row level security;
alter table diets enable row level security;
alter table dishes enable row level security;
alter table bring_items enable row level security;
alter table drinks enable row level security;

do $$ begin
  create policy "all read requests" on requests for select using (true);
  create policy "all insert requests" on requests for insert with check (true);
  create policy "all delete requests" on requests for delete using (true);
  create policy "all update requests" on requests for update using (true);

  create policy "all read assignments" on assignments for select using (true);
  create policy "all insert assignments" on assignments for insert with check (true);
  create policy "all delete assignments" on assignments for delete using (true);
  create policy "all update assignments" on assignments for update using (true);

  create policy "all read diets" on diets for select using (true);
  create policy "all insert diets" on diets for insert with check (true);
  create policy "all update diets" on diets for update using (true);
  create policy "all delete diets" on diets for delete using (true);

  create policy "all read dishes" on dishes for select using (true);
  create policy "all insert dishes" on dishes for insert with check (true);
  create policy "all update dishes" on dishes for update using (true);
  create policy "all delete dishes" on dishes for delete using (true);

  create policy "all read bring_items" on bring_items for select using (true);
  create policy "all insert bring_items" on bring_items for insert with check (true);
  create policy "all delete bring_items" on bring_items for delete using (true);
  create policy "all update bring_items" on bring_items for update using (true);

  create policy "all read drinks" on drinks for select using (true);
  create policy "all insert drinks" on drinks for insert with check (true);
  create policy "all update drinks" on drinks for update using (true);
  create policy "all delete drinks" on drinks for delete using (true);
exception when duplicate_object then null;
end $$;

-- Real-time subscriptions
do $$ begin
  alter publication supabase_realtime add table requests;
  alter publication supabase_realtime add table assignments;
  alter publication supabase_realtime add table diets;
  alter publication supabase_realtime add table dishes;
  alter publication supabase_realtime add table bring_items;
  alter publication supabase_realtime add table drinks;
exception when duplicate_object then null;
end $$;

-- ============ SEED DEFAULT MENU ============
-- Only seeds if dishes table is empty (safe to re-run)
insert into dishes (meal, name, category, covers, portion_g, unit, notes)
select * from (values
  -- Friday dinner: pasta night
  ('fri_dinner', 'Pasta (mixed shapes)', 'main', '["omni","veg","vegan","pesc"]'::jsonb, 120, 'g', 'dry weight; adults 120g, kids ~80g (averaged)'),
  ('fri_dinner', 'Tomato / veggie sauce', 'side', '["omni","veg","vegan","pesc"]'::jsonb, 200, 'g', 'covers everyone'),
  ('fri_dinner', 'Meat sauce (bolognese)', 'side', '["omni"]'::jsonb, 200, 'g', 'optional second sauce for omnivores'),
  ('fri_dinner', 'Parmesan', 'side', '["omni","veg","pesc"]'::jsonb, 30, 'g', 'on the table'),
  ('fri_dinner', 'Bread', 'bread', '["omni","veg","vegan","pesc"]'::jsonb, 60, 'g', null),
  ('fri_dinner', 'Salad (guest-brought)', 'salad', '["omni","veg","vegan","pesc"]'::jsonb, 80, 'g', 'guests will bring'),

  -- Saturday breakfast
  ('sat_breakfast', 'Bread / rolls', 'bread', '["omni","veg","vegan","pesc"]'::jsonb, 80, 'g', null),
  ('sat_breakfast', 'Butter', 'side', '["omni","veg","pesc"]'::jsonb, 15, 'g', null),
  ('sat_breakfast', 'Mixed cheese', 'side', '["omni","veg","pesc"]'::jsonb, 40, 'g', null),
  ('sat_breakfast', 'Cold cuts', 'side', '["omni"]'::jsonb, 40, 'g', null),
  ('sat_breakfast', 'Eggs', 'main', '["omni","veg","pesc"]'::jsonb, 1, 'piece', null),
  ('sat_breakfast', 'Jam / honey', 'side', '["omni","veg","vegan","pesc"]'::jsonb, 20, 'g', null),
  ('sat_breakfast', 'Fruit', 'side', '["omni","veg","vegan","pesc"]'::jsonb, 100, 'g', null),
  ('sat_breakfast', 'Coffee (beans)', 'drink', '["omni","veg","vegan","pesc"]'::jsonb, 10, 'g', '~10g beans per cup'),
  ('sat_breakfast', 'Milk', 'drink', '["omni","veg","pesc"]'::jsonb, 100, 'ml', null),
  ('sat_breakfast', 'Juice (kids)', 'drink', '["omni","veg","vegan","pesc"]'::jsonb, 100, 'ml', null),

  -- Saturday lunch: light, leftover-style
  ('sat_lunch', 'Light snacks / leftovers', 'main', '["omni","veg","vegan","pesc"]'::jsonb, 150, 'g', 'covered by Fri leftovers + bread'),
  ('sat_lunch', 'Bread', 'bread', '["omni","veg","vegan","pesc"]'::jsonb, 60, 'g', null),

  -- Saturday dinner: BBQ with Spanferkel as centerpiece
  ('sat_dinner', 'Spanferkel (suckling pig)', 'main', '["omni"]'::jsonb, 250, 'g', 'cooked weight per omni eater; raw weight ~2x'),
  ('sat_dinner', 'BBQ veg / halloumi (guest-brought)', 'main', '["veg","vegan","pesc"]'::jsonb, 200, 'g', 'guests will bring their own veg/veggie skewers'),
  ('sat_dinner', 'Burger / sausages (guest-brought)', 'side', '["omni"]'::jsonb, 150, 'g', 'guests bring their own meat'),
  ('sat_dinner', 'Bread / buns', 'bread', '["omni","veg","vegan","pesc"]'::jsonb, 80, 'g', null),
  ('sat_dinner', 'Salads (guest-brought)', 'salad', '["omni","veg","vegan","pesc"]'::jsonb, 150, 'g', 'guests will bring 4-5 salads'),

  -- Sunday brunch: leftovers + minimal
  ('sun_brunch', 'Leftovers', 'main', '["omni","veg","vegan","pesc"]'::jsonb, 150, 'g', 'from Fri + Sat'),
  ('sun_brunch', 'Fresh bread', 'bread', '["omni","veg","vegan","pesc"]'::jsonb, 80, 'g', 'buy Sun morning'),
  ('sun_brunch', 'Scrambled eggs', 'main', '["omni","veg","pesc"]'::jsonb, 1, 'piece', 'top-up if leftovers run low'),
  ('sun_brunch', 'Coffee (beans)', 'drink', '["omni","veg","vegan","pesc"]'::jsonb, 10, 'g', null),
  ('sun_brunch', 'Fruit', 'side', '["omni","veg","vegan","pesc"]'::jsonb, 100, 'g', null)
) as v(meal, name, category, covers, portion_g, unit, notes)
where not exists (select 1 from dishes limit 1);

-- Seed drinks (whole weekend)
insert into drinks (name, qty_target, notes)
select * from (values
  ('Beer', '4-5 crates (80-100 bottles)', '2-3 per adult per evening'),
  ('Red wine', '8-10 bottles', null),
  ('White wine', '8-10 bottles', null),
  ('Sparkling wine', '4-6 bottles', 'for birthday toast'),
  ('Still water', '25 L', null),
  ('Sparkling water', '25 L', null),
  ('Soft drinks (cola/fanta)', '15 L', null),
  ('Juice (kids)', '6 L', null),
  ('Coffee beans (weekend total)', '500 g', null),
  ('Milk', '5 L', null)
) as v(name, qty_target, notes)
where not exists (select 1 from drinks limit 1);
