alter table app.documents
  add column if not exists rendered_body_html text not null default '';

notify pgrst, 'reload schema';
