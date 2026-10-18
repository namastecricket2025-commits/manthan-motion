-- Manthan testimonials
-- Real user feedback only. Nothing is ever seeded at runtime from this file;
-- the six early-tester rows are inserted by the Convex seed path so app code
-- and DB stay in one place.

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                                 -- nullable: early testers have no account
  rating integer not null check (rating between 1 and 5),
  text text not null,
  display_name text,
  class_label text,
  consent_to_publish boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  source text not null default 'user',         -- 'user' or 'early_tester'
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;

-- Owners/admins can do everything (Convex service role reads/writes here).
-- Day-to-day client work goes through Convex, so we do not grant anon/auth
-- broad access to this table.

revoke all on table testimonials from anon, authenticated;

-- Public read: only approved + consented rows.
create policy "public reads approved consented testimonials"
  on testimonials for select
  to anon, authenticated
  using (status = 'approved' and consent_to_publish = true);

-- Authenticated users can insert their own feedback.
create policy "authenticated users insert own feedback"
  on testimonials for insert
  to authenticated
  with check (user_id = auth.uid());

-- Authenticated users can read their own rows (so they can see what they submitted).
create policy "authenticated users read own rows"
  on testimonials for select
  to authenticated
  using (user_id = auth.uid());

-- Owner-only mutation path is handled in Convex, where we can check the
-- owner email and use the service role. No SQL function is exposed to clients.

comment on table testimonials is 'User and early-tester feedback. Public only ever sees approved + consented rows.';
comment on column testimonials.user_id is 'Nullable: set for signed-in users, null for early testers';
comment on column testimonials.source is ''user'' for in-app submissions, ''early_tester'' for seeded rows';
