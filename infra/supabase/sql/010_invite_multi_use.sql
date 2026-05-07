alter table app.invite_tokens
  add column if not exists invite_token text,
  add column if not exists max_uses integer not null default 1,
  add column if not exists use_count integer not null default 0;

update app.invite_tokens
set
  max_uses = greatest(1, coalesce(max_uses, 1)),
  use_count = case
    when used_at is not null then greatest(coalesce(use_count, 0), 1)
    else coalesce(use_count, 0)
  end;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invite_tokens_max_uses_range'
      and conrelid = 'app.invite_tokens'::regclass
  ) then
    alter table app.invite_tokens
      add constraint invite_tokens_max_uses_range check (max_uses between 1 and 999);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invite_tokens_use_count_valid'
      and conrelid = 'app.invite_tokens'::regclass
  ) then
    alter table app.invite_tokens
      add constraint invite_tokens_use_count_valid check (use_count >= 0 and use_count <= max_uses);
  end if;
end $$;
