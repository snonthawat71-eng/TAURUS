-- ============================================================
-- TAURUS — ถอนสิทธิ์การเข้าทริปให้ครบวงจร (รันใน Supabase > SQL Editor)
--
-- ปัญหาเดิม: การลบ "คำเชิญ" (trip_invites) ไม่ได้ลบสมาชิกที่ตอบรับไปแล้ว
-- (trip_members) ออก — สมาชิกจึงยังเข้าทริปได้ และถ้าคำเชิญยัง pending อยู่
-- accept_my_invites() ก็จะดึงกลับเข้ามาใหม่ตอน login ครั้งถัดไป
--
-- ฟังก์ชันนี้ลบทั้งสองตารางพร้อมกันแบบ atomic โดยจับคู่ผ่านอีเมลใน auth.users
-- เฉพาะ "เจ้าของทริป" เท่านั้นที่เรียกได้ — รันซ้ำได้ปลอดภัย
-- ============================================================

create or replace function revoke_trip_access(p_trip uuid, p_user uuid default null, p_email text default null)
returns void language plpgsql security definer set search_path = public as $$
declare target_email text;
begin
  -- เฉพาะเจ้าของทริปเท่านั้น
  if not exists (select 1 from trips where id = p_trip and owner_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  -- หาอีเมลจาก user id เมื่อส่งมาแต่ id (เพื่อล้างคำเชิญที่ผูกกับอีเมลด้วย)
  if p_email is null and p_user is not null then
    select email into target_email from auth.users where id = p_user;
  else
    target_email := p_email;
  end if;

  -- ลบ membership (ครอบทั้งกรณีส่ง id มาตรงๆ และกรณีหา id จากอีเมล)
  delete from trip_members
   where trip_id = p_trip
     and (user_id = p_user
          or (target_email is not null
              and user_id in (select id from auth.users where lower(email) = lower(target_email))));

  -- ลบคำเชิญทุกใบของอีเมลนี้ เพื่อกัน accept_my_invites() ดึงกลับ
  if target_email is not null then
    delete from trip_invites where trip_id = p_trip and lower(email) = lower(target_email);
  end if;
end;
$$;
