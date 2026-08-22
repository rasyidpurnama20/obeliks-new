insert into storage.buckets (id, name, public, file_size_limit)
values ('rps-source', 'rps-source', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;
