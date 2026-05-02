update app.documents
set publish_status = 'published',
    published_at = coalesce(published_at, now())
where publish_status <> 'published';

drop policy if exists "public_documents_select" on app.documents;
create policy "public_documents_select"
  on app.documents
  for select
  to anon, authenticated
  using (access_mode = 'public');

drop policy if exists "public_assets_select" on app.document_assets;
create policy "public_assets_select"
  on app.document_assets
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_assets.document_id
        and d.access_mode = 'public'
    )
  );

drop policy if exists "public_document_tags_select" on app.document_tags;
create policy "public_document_tags_select"
  on app.document_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_tags.document_id
        and d.access_mode = 'public'
    )
  );

drop policy if exists "public_outlines_select" on app.document_outlines;
create policy "public_outlines_select"
  on app.document_outlines
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_outlines.document_id
        and d.access_mode = 'public'
    )
  );

drop policy if exists "login_documents_select" on app.documents;
create policy "login_documents_select"
  on app.documents
  for select
  to authenticated
  using (access_mode in ('public', 'login'));

drop policy if exists "login_assets_select" on app.document_assets;
create policy "login_assets_select"
  on app.document_assets
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_assets.document_id
        and d.access_mode in ('public', 'login')
    )
  );

drop policy if exists "login_document_tags_select" on app.document_tags;
create policy "login_document_tags_select"
  on app.document_tags
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_tags.document_id
        and d.access_mode in ('public', 'login')
    )
  );

drop policy if exists "login_outlines_select" on app.document_outlines;
create policy "login_outlines_select"
  on app.document_outlines
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.documents d
      where d.id = document_outlines.document_id
        and d.access_mode in ('public', 'login')
    )
  );
