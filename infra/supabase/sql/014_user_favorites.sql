create table if not exists app.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.profiles (id) on delete cascade,
  target_type app.target_type not null,
  target_id uuid not null,
  route_path text not null,
  title text not null,
  description text,
  context_title text,
  favorited_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, target_type, target_id)
);

create index if not exists user_favorites_user_favorited_idx
  on app.user_favorites (user_id, favorited_at desc);

drop trigger if exists set_user_favorites_updated_at on app.user_favorites;
create trigger set_user_favorites_updated_at
before update on app.user_favorites
for each row execute procedure app.set_updated_at();

alter table app.user_favorites enable row level security;

create policy "user_favorites_select_self"
  on app.user_favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_favorites_insert_self"
  on app.user_favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_favorites_update_self"
  on app.user_favorites
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_favorites_delete_self"
  on app.user_favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);
