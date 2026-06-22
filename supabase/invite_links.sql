-- ============================================================
-- TAURUS — ลิงก์เชิญเข้าทริป (copy-link invites)
--   เจ้าของสร้างลิงก์ → ส่งให้เพื่อนเอง (LINE/แชท) → เพื่อนเปิดลิงก์ + login
--   แล้วถูกเพิ่มเป็นสมาชิกทันที ด้วยสิทธิ์ที่ฝังในลิงก์ (ไม่ต้องส่งอีเมล)
--   รันใน Supabase > SQL Editor — รันซ้ำได้ปลอดภัย
-- ============================================================

-- โทเคนของลิงก์ + อีเมลให้เป็น null ได้ (ลิงก์เชิญไม่ผูกกับอีเมลใคร)
alter table trip_invites add column if not exists token text;
alter table trip_invites alter column email drop not null;
create unique index if not exists trip_invites_token_key on trip_invites(token) where token is not null;

-- รับเชิญด้วยลิงก์: เพิ่มผู้ใช้ปัจจุบันเข้าทริปตามสิทธิ์ในคำเชิญ
-- security definer → คนที่ยังไม่เป็นสมาชิกก็ insert ลง trip_members ได้
create or replace function accept_invite_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare inv trip_invites;
begin
  select * into inv from trip_invites where token = p_token limit 1;
  if inv.id is null then
    raise exception 'invite not found';
  end if;

  insert into trip_members (trip_id, user_id, role, permission)
  values (inv.trip_id, auth.uid(), 'member', coalesce(inv.permission, 'edit'))
  on conflict (trip_id, user_id) do update set permission = excluded.permission;

  update trip_invites set status = 'accepted' where id = inv.id;
  return inv.trip_id;
end;
$$;

grant execute on function accept_invite_token(text) to authenticated;
