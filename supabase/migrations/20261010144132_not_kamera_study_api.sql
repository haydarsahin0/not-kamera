-- Isolated study data. No game/payment objects are modified.
create table if not exists public.not_kamera_access (
 id integer primary key check (id=1), token_hash text not null check(length(token_hash)=64)
);
create table if not exists public.not_kamera_jobs (
 id uuid primary key default gen_random_uuid(), created timestamptz not null default now(),
 status text not null check(status in ('processing','done','error')),
 answer text not null default '', error text not null default '', digest text not null
);
create index if not exists not_kamera_jobs_created_idx on public.not_kamera_jobs(created desc);
alter table public.not_kamera_access enable row level security;
alter table public.not_kamera_jobs enable row level security;
revoke all on public.not_kamera_access,public.not_kamera_jobs from public,anon,authenticated;
grant select on public.not_kamera_access to service_role;
grant select,insert,update,delete on public.not_kamera_jobs to service_role;

create or replace function public.not_kamera_claim(p_digest text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare found_id uuid; recent_count int; latest_time timestamptz;
begin
 perform pg_advisory_xact_lock(186930478);
 delete from public.not_kamera_jobs where created < now()-interval '24 hours';
 update public.not_kamera_jobs set status='error',error='Analiz zaman aşımına uğradı. Fotoğrafı yeniden gönder.' where status='processing' and created < now()-interval '3 minutes';
 select id into found_id from public.not_kamera_jobs where digest=p_digest and status='done' order by created desc limit 1;
 if found_id is not null then return jsonb_build_object('id',found_id,'duplicate',true);end if;
 if exists(select 1 from public.not_kamera_jobs where status='processing') then return jsonb_build_object('detail','Önceki fotoğraf hâlâ işleniyor.','code',429);end if;
 select count(*),max(created) into recent_count,latest_time from public.not_kamera_jobs where created > now()-interval '1 hour';
 if recent_count>=60 then return jsonb_build_object('detail','Saatlik 60 analiz sınırına ulaşıldı.','code',429);end if;
 if latest_time > now()-interval '10 seconds' then return jsonb_build_object('detail','Yeni analiz için 10 saniye bekle.','code',429);end if;
 insert into public.not_kamera_jobs(status,digest) values('processing',p_digest) returning id into found_id;
 return jsonb_build_object('id',found_id);
end $$;
revoke all on function public.not_kamera_claim(text) from public,anon,authenticated;
grant execute on function public.not_kamera_claim(text) to service_role;

create or replace function public.not_kamera_clear()
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(186930478);
 if exists(select 1 from public.not_kamera_jobs where status='processing' and created > now()-interval '3 minutes') then return jsonb_build_object('detail','Devam eden analizin bitmesini bekle.','code',409);end if;
 delete from public.not_kamera_jobs;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.not_kamera_clear() from public,anon,authenticated;
grant execute on function public.not_kamera_clear() to service_role;
