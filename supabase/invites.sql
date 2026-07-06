-- invites.sql — ลิงก์เชิญรายคน (สร้างทริปแบบ wizard + หน้า /join/<token>)
-- รันใน Supabase SQL Editor ครั้งเดียว · รันซ้ำได้ปลอดภัย
--
-- แนวคิด: การ์ดผู้เดินทางทุกใบมี "รหัสลับ" (invite_token) — เจ้าของทริปแชร์ลิงก์
-- ของใครให้คนนั้น เพื่อนเปิดลิงก์ → ล็อกอิน → กดยืนยัน = ผูกบัญชีกับการ์ด +
-- เข้าเป็นสมาชิกทริป + ตั้งความเป็นส่วนตัวเอกสาร จบในคลิกเดียว

alter table public.travelers add column if not exists invite_token uuid not null default gen_random_uuid();
create index if not exists travelers_invite_token_idx on public.travelers(invite_token);

-- ช่วงเมืองของทริป (wizard เก็บไว้ ใช้ต่อกับฟีเจอร์สลับค่าเงิน/ไทม์โซนตามเมือง)
-- [{"city":"Hongkong","flag":"🇭🇰","currency":"HKD","tz":"Asia/Hong_Kong","until":"2026-07-04T11:00"}, …]
alter table public.trips add column if not exists segments jsonb;

-- ── หน้า welcome อ่านข้อมูลผ่าน token (เปิดได้ก่อนล็อกอิน จึงให้ anon เรียกได้) ──
create or replace function public.get_invite(tok uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip_id', tr.id,
    'trip_name', tr.name,
    'flag', tr.flag,
    'start_date', tr.start_date,
    'end_date', tr.end_date,
    'traveler_id', t.id,
    'nickname', t.nickname,
    'claimed', t.user_id is not null,
    'owner_name', p.nickname,
    'traveler_count', (select count(*) from travelers x where x.trip_id = tr.id)
  )
  from travelers t
  join trips tr on tr.id = t.trip_id
  left join profiles p on p.id = tr.owner_id
  where t.invite_token = tok;
$$;
grant execute on function public.get_invite(uuid) to anon, authenticated;

-- ── กดยืนยันร่วมเดินทาง: ผูกการ์ด + สมัครสมาชิกทริป + ตั้งความเป็นส่วนตัว ──
create or replace function public.accept_invite(tok uuid, privacy_choice text default 'private')
returns uuid language plpgsql security definer set search_path = public as $$
declare t travelers%rowtype;
begin
  select * into t from travelers where invite_token = tok;
  if t.id is null then
    raise exception 'ลิงก์ไม่ถูกต้องหรือถูกยกเลิกแล้ว';
  end if;
  if t.user_id is not null and t.user_id <> auth.uid() then
    raise exception 'การ์ดนี้มีเจ้าของแล้ว — ขอลิงก์ของคุณจากเจ้าของทริป';
  end if;

  update travelers
     set user_id = auth.uid(),
         privacy = case when privacy_choice = 'trip' then 'trip' else 'private' end
   where id = t.id;

  if not exists (select 1 from trip_members m where m.trip_id = t.trip_id and m.user_id = auth.uid()) then
    insert into trip_members (trip_id, user_id, role, permission)
    values (t.trip_id, auth.uid(), 'member', 'edit');
  end if;

  -- โปรไฟล์ใหม่ → ใช้ชื่อบนการ์ดเป็นชื่อเล่นเริ่มต้น (ไม่ทับของเดิม)
  insert into profiles (id, nickname)
  values (auth.uid(), coalesce(t.nickname, 'me'))
  on conflict (id) do nothing;

  return t.trip_id;
end $$;
grant execute on function public.accept_invite(uuid, text) to authenticated;
