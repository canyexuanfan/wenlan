create extension if not exists pgcrypto;

create schema if not exists app;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'access_mode') then
    create type app.access_mode as enum (
      'inherit',
      'draft',
      'public',
      'login',
      'private',
      'specific_users',
      'group'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'publish_status') then
    create type app.publish_status as enum ('draft', 'published', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'site_role') then
    create type app.site_role as enum ('owner', 'admin', 'editor', 'publisher', 'viewer');
  end if;

  if not exists (select 1 from pg_type where typname = 'target_type') then
    create type app.target_type as enum ('folder', 'document');
  end if;
end
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists app.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text,
  site_role app.site_role not null default 'viewer',
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_title text not null default '文览',
  site_subtitle text not null default '把各种文档做成可阅读的在线展台。',
  hero_description text,
  contact_label text not null default '联系我',
  contact_url text not null default 'https://www.hnwen17.top',
  seed_message text default '首页优先呈现有阅读价值的种子内容，而不是空壳后台。',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  email text,
  token_hash text not null unique,
  site_role app.site_role not null default 'viewer',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references app.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references app.folders (id) on delete cascade,
  name text not null,
  slug text not null,
  route_path text not null unique,
  description text,
  hero_note text,
  cover_image_path text,
  access_mode app.access_mode not null default 'inherit',
  order_index integer not null default 1000,
  accent text not null default 'clay' check (accent in ('clay', 'sage', 'sky', 'rose')),
  created_by uuid references app.profiles (id) on delete set null,
  updated_by uuid references app.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists folders_parent_slug_key
  on app.folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create table if not exists app.documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references app.folders (id) on delete cascade,
  title text not null,
  slug text not null,
  route_path text not null unique,
  summary text,
  thumbnail_path text,
  source_type text not null default 'html',
  render_mode text not null default 'site' check (render_mode in ('site', 'source')),
  publish_status app.publish_status not null default 'draft',
  access_mode app.access_mode not null default 'inherit',
  order_index integer not null default 1000,
  version integer not null default 1,
  body_html text not null default '',
  rendered_body_html text not null default '',
  author_name text,
  reading_time text,
  is_featured boolean not null default false,
  created_by uuid references app.profiles (id) on delete set null,
  updated_by uuid references app.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists documents_folder_slug_key
  on app.documents (folder_id, slug);

create table if not exists app.document_assets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references app.documents (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  storage_bucket text not null default 'document-assets',
  storage_path text not null unique,
  public_url text,
  checksum text,
  size_bytes bigint,
  is_entry boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.document_tags (
  document_id uuid not null references app.documents (id) on delete cascade,
  tag_id uuid not null references app.tags (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (document_id, tag_id)
);

create table if not exists app.document_outlines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references app.documents (id) on delete cascade,
  level integer not null check (level between 1 and 6),
  text text not null,
  anchor text not null,
  order_index integer not null default 1000,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.access_grants (
  id uuid primary key default gen_random_uuid(),
  target_type app.target_type not null,
  target_id uuid not null,
  subject_type text not null check (subject_type in ('user', 'group')),
  subject_id uuid not null,
  access_level text not null default 'view',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references app.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  before_payload jsonb,
  after_payload jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.user_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists app.group_members (
  group_id uuid not null references app.user_groups (id) on delete cascade,
  user_id uuid not null references app.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (group_id, user_id)
);

create table if not exists app.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  target_type app.target_type not null,
  target_id uuid not null,
  suggestion_type text not null,
  payload jsonb not null default '{}'::jsonb,
  confidence numeric(5,2),
  status text not null default 'pending',
  reviewed_by uuid references app.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_profiles_updated_at on app.profiles;
create trigger set_profiles_updated_at
before update on app.profiles
for each row execute procedure app.set_updated_at();

drop trigger if exists set_site_settings_updated_at on app.site_settings;
create trigger set_site_settings_updated_at
before update on app.site_settings
for each row execute procedure app.set_updated_at();

drop trigger if exists set_folders_updated_at on app.folders;
create trigger set_folders_updated_at
before update on app.folders
for each row execute procedure app.set_updated_at();

drop trigger if exists set_documents_updated_at on app.documents;
create trigger set_documents_updated_at
before update on app.documents
for each row execute procedure app.set_updated_at();

alter table app.profiles enable row level security;
alter table app.site_settings enable row level security;
alter table app.invite_tokens enable row level security;
alter table app.folders enable row level security;
alter table app.documents enable row level security;
alter table app.document_assets enable row level security;
alter table app.tags enable row level security;
alter table app.document_tags enable row level security;
alter table app.document_outlines enable row level security;
alter table app.access_grants enable row level security;
alter table app.audit_logs enable row level security;
alter table app.user_groups enable row level security;
alter table app.group_members enable row level security;
alter table app.ai_suggestions enable row level security;

create policy "profiles_select_self"
  on app.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_self"
  on app.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "public_site_settings_select"
  on app.site_settings
  for select
  to anon, authenticated
  using (true);

create policy "public_folders_select"
  on app.folders
  for select
  to anon, authenticated
  using (access_mode = 'public');

create policy "public_documents_select"
  on app.documents
  for select
  to anon, authenticated
  using (publish_status = 'published' and access_mode = 'public');

create policy "public_assets_select"
  on app.document_assets
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_assets.document_id
        and d.publish_status = 'published'
        and d.access_mode = 'public'
    )
  );

create policy "public_document_tags_select"
  on app.document_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_tags.document_id
        and d.publish_status = 'published'
        and d.access_mode = 'public'
    )
  );

create policy "public_outlines_select"
  on app.document_outlines
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_outlines.document_id
        and d.publish_status = 'published'
        and d.access_mode = 'public'
    )
  );

create policy "public_tags_select"
  on app.tags
  for select
  to anon, authenticated
  using (true);

insert into app.site_settings (
  site_title,
  site_subtitle,
  hero_description,
  contact_label,
  contact_url,
  seed_message
)
select
  '文览',
  '把各种文档做成可阅读的在线展台。',
  '当前以 SOP 知识库为核心，同时容纳教程、手册、报告、案例与长期维护资料。',
  '联系我',
  'https://www.hnwen17.top',
  '首页优先呈现有阅读价值的种子内容，而不是空壳后台。'
where not exists (select 1 from app.site_settings);
