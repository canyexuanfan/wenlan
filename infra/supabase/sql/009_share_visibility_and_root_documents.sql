alter type app.access_mode add value if not exists 'share' after 'public';

alter table app.documents
  alter column folder_id drop not null;
