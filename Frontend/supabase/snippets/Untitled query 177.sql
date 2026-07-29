-- Buat bucket
insert into storage.buckets (id, name, public) values ('attendance', 'attendance', true);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('leave-requests', 'leave-requests', true);

-- Beri akses (Policies) agar dapat diakses dari aplikasi
create policy "Public Access" on storage.objects for select using ( bucket_id in ('attendance', 'avatars', 'leave-requests') );
create policy "Upload Access" on storage.objects for insert with check ( bucket_id in ('attendance', 'avatars', 'leave-requests') );
create policy "Update Access" on storage.objects for update using ( bucket_id in ('attendance', 'avatars', 'leave-requests') );