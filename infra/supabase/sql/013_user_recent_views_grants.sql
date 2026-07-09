grant select, insert, update
  on table app.user_recent_views
  to authenticated;

grant delete, insert, references, select, trigger, truncate, update
  on table app.user_recent_views
  to service_role;
