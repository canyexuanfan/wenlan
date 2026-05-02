alter table app.documents
  add column if not exists render_mode text not null default 'site'
  check (render_mode in ('site', 'source'));

notify pgrst, 'reload schema';
