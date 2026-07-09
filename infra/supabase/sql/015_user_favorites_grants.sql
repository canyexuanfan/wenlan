grant select, insert, update, delete
  on table app.user_favorites
  to authenticated;

grant delete, insert, references, select, trigger, truncate, update
  on table app.user_favorites
  to service_role;
