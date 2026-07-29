-- Create storage bucket for face samples
insert into storage.buckets (id, name, public)
values ('face-samples', 'face-samples', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket
create policy "Anyone can read face samples"
on storage.objects for select
using ( bucket_id = 'face-samples' );

create policy "Users can upload their own face samples"
on storage.objects for insert
with check ( bucket_id = 'face-samples' and auth.uid() = owner );

create policy "Users can update their own face samples"
on storage.objects for update
using ( bucket_id = 'face-samples' and auth.uid() = owner );
