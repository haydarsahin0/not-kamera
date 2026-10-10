-- One authenticated user's selected answer and physical display acknowledgement.
create table if not exists public.not_kamera_device (
 id integer primary key check(id=1),
 job_id uuid references public.not_kamera_jobs(id) on delete set null,
 delivery_id uuid,
 ack_id uuid,
 seen_at timestamptz,
 acked_at timestamptz,
 pages integer not null default 0
);
insert into public.not_kamera_device(id) values(1) on conflict(id) do nothing;
alter table public.not_kamera_device enable row level security;
revoke all on public.not_kamera_device from public,anon,authenticated;
grant select,update on public.not_kamera_device to service_role;
