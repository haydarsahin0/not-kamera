-- Idempotent provisioning for private lecture assets. Import originals separately.
create table if not exists public.not_kamera_course_pages (
 course text not null, id integer not null, file text not null,
 page integer not null, text text not null, image_base64 text not null,
 primary key(course,id)
);
alter table public.not_kamera_course_pages enable row level security;
revoke all on public.not_kamera_course_pages from anon,authenticated;
grant select on public.not_kamera_course_pages to service_role;
alter table public.not_kamera_jobs add column if not exists source_refs jsonb not null default '[]'::jsonb;
