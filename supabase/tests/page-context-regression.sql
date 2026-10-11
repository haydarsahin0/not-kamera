-- Isolated test: real job/page/context rows are never modified.
begin;
create temp table not_kamera_jobs (like public.not_kamera_jobs including all);
create temp table not_kamera_context (like public.not_kamera_context including all);
create temp table not_kamera_pages (like public.not_kamera_pages including all);
alter table pg_temp.not_kamera_pages add foreign key(job_id) references pg_temp.not_kamera_jobs(id) on delete cascade;
insert into pg_temp.not_kamera_context(id) values(1);
create or replace function pg_temp.not_kamera_claim_frame(
 p_fingerprint text,p_profile text,p_image text,p_mime text,
 p_request_id uuid default null,p_reset boolean default false,p_preview boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 state pg_temp.not_kamera_context%rowtype; old_job pg_temp.not_kamera_jobs%rowtype;
 found_id uuid; recent_count integer; latest_time timestamptz; prior jsonb:='[]';
begin
 perform pg_advisory_xact_lock(186930478);
 if length(p_fingerprint)<>64 or length(p_profile)<>64 or p_mime not in ('image/jpeg','image/png') or length(p_image) not between 1 and 5592408 then
  return jsonb_build_object('detail','Fotoğraf bağlamı geçersiz.','code',400);
 end if;
 delete from pg_temp.not_kamera_jobs where created < now()-interval '24 hours';
 update pg_temp.not_kamera_jobs set status='error',error='Analiz zaman aşımına uğradı. Fotoğrafı yeniden gönder.' where status='processing' and created < now()-interval '3 minutes';
 if p_request_id is not null then
  select * into old_job from pg_temp.not_kamera_jobs where request_id=p_request_id;
  if found then
   if old_job.frame_fingerprint<>p_fingerprint then return jsonb_build_object('detail','İstek kimliği başka fotoğrafa ait.','code',409);end if;
   return jsonb_build_object('id',old_job.id,'duplicate',true,'context_pages',old_job.context_count);
  end if;
 end if;
 select * into state from pg_temp.not_kamera_context where id=1;
 -- Legacy clients lack a request UUID. Only the last page of this working session
 -- can be reused; a global image cache would return answers from the wrong context.
 if not p_preview and not p_reset and p_request_id is null and state.profile_hash=p_profile and state.touched>now()-interval '2 hours' then
  select j.* into old_job from pg_temp.not_kamera_pages p join pg_temp.not_kamera_jobs j on j.id=p.job_id
   where p.generation=state.generation order by p.ordinal desc limit 1;
  if old_job.frame_fingerprint=p_fingerprint and old_job.status in ('done','processing') then
   return jsonb_build_object('id',old_job.id,'duplicate',true,'context_pages',old_job.context_count);
  end if;
 end if;
 if exists(select 1 from pg_temp.not_kamera_jobs where status='processing') then return jsonb_build_object('detail','Önceki fotoğraf hâlâ işleniyor.','code',429);end if;
 select count(*),max(created) into recent_count,latest_time from pg_temp.not_kamera_jobs where created>now()-interval '1 hour';
 if recent_count>=60 then return jsonb_build_object('detail','Saatlik 60 analiz sınırına ulaşıldı.','code',429);end if;
 if latest_time>now()-interval '10 seconds' then return jsonb_build_object('detail','Yeni analiz için 10 saniye bekle.','code',429);end if;
 if not p_preview then
  if p_reset or state.profile_hash<>p_profile or state.touched<now()-interval '2 hours' then
   delete from pg_temp.not_kamera_pages where generation=state.generation;
   state.generation:=gen_random_uuid();
  end if;
  update pg_temp.not_kamera_context set generation=state.generation,profile_hash=p_profile,touched=now() where id=1;
  -- Failed analyses cannot lend unverifiable data to another task.
  delete from pg_temp.not_kamera_pages p using pg_temp.not_kamera_jobs j where p.job_id=j.id and j.status='error';
  select coalesce(jsonb_agg(jsonb_build_object('job_id',q.job_id,'mime',q.mime,'image_base64',q.image_base64) order by q.ordinal),'[]'::jsonb) into prior
   from (select p.* from pg_temp.not_kamera_pages p join pg_temp.not_kamera_jobs j on j.id=p.job_id
    where p.generation=state.generation and j.status='done' order by p.ordinal desc limit 6) q;
 end if;
 insert into pg_temp.not_kamera_jobs(status,digest,frame_fingerprint,request_id,context_count)
  values('processing',p_fingerprint||':'||state.generation::text||':'||(select coalesce(string_agg(x->>'job_id',','),'') from jsonb_array_elements(prior) x),p_fingerprint,p_request_id,jsonb_array_length(prior)) returning id into found_id;
 if not p_preview then
  insert into pg_temp.not_kamera_pages(job_id,generation,mime,image_base64) values(found_id,state.generation,p_mime,p_image);
  delete from pg_temp.not_kamera_pages where job_id not in (select job_id from pg_temp.not_kamera_pages order by ordinal desc limit 7);
 end if;
 return jsonb_build_object('id',found_id,'previous',prior,'context_pages',jsonb_array_length(prior));
end $$;
revoke all on function pg_temp.not_kamera_claim_frame(text,text,text,text,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function pg_temp.not_kamera_claim_frame(text,text,text,text,uuid,boolean,boolean) to service_role;

create or replace function pg_temp.not_kamera_clear()
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(186930478);
 if exists(select 1 from pg_temp.not_kamera_jobs where status='processing' and created>now()-interval '3 minutes') then return jsonb_build_object('detail','Devam eden analizin bitmesini bekle.','code',409);end if;
 delete from pg_temp.not_kamera_jobs where created<=now();
 update pg_temp.not_kamera_context set generation=gen_random_uuid(),profile_hash='',touched=now() where id=1;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function pg_temp.not_kamera_clear() from public,anon,authenticated;
grant execute on function pg_temp.not_kamera_clear() to service_role;


grant select,insert,update,delete on pg_temp.not_kamera_jobs,pg_temp.not_kamera_pages,pg_temp.not_kamera_context to service_role;
grant usage,select on sequence pg_temp.not_kamera_pages_ordinal_seq to service_role;
set local role service_role;
do $$ declare r jsonb; begin
 r:=pg_temp.not_kamera_claim_frame(repeat('a',64),repeat('b',64),repeat('c',1500000),'image/jpeg','e9b734ed-47be-4e7a-a6dd-dc1c7ac04211',true,false);
 assert (r->>'context_pages')::int=0;
 update pg_temp.not_kamera_jobs set status='done',created=now()-interval '20 seconds' where id=(r->>'id')::uuid;
 r:=pg_temp.not_kamera_claim_frame(repeat('d',64),repeat('b',64),repeat('e',1500000),'image/jpeg','19b734ed-47be-4e7a-a6dd-dc1c7ac04212',false,false);
 assert (r->>'context_pages')::int=1;
 assert length(r->'previous'->0->>'image_base64')=1500000;
 update pg_temp.not_kamera_jobs set status='done',created=now()-interval '20 seconds' where id=(r->>'id')::uuid;
 r:=pg_temp.not_kamera_claim_frame(repeat('d',64),repeat('b',64),repeat('e',1500000),'image/jpeg','19b734ed-47be-4e7a-a6dd-dc1c7ac04212',false,false);
 assert (r->>'duplicate')::bool;
 r:=pg_temp.not_kamera_claim_frame(repeat('f',64),repeat('b',64),repeat('g',1500000),'image/jpeg','29b734ed-47be-4e7a-a6dd-dc1c7ac04213',true,false);
 assert (r->>'context_pages')::int=0;
 assert (select count(*) from pg_temp.not_kamera_pages)=1;
 update pg_temp.not_kamera_jobs set status='done' where id=(r->>'id')::uuid;
 assert (pg_temp.not_kamera_clear()->>'ok')::bool;
 assert not exists(select 1 from pg_temp.not_kamera_pages);
end $$;
select 'PASS first/second 1.5 MB page, duplicate, reset, clear' as result;
rollback;
