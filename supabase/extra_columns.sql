-- ============================================================
-- TRIP — คอลัมน์เสริม + ระบบเชิญ (รันใน Supabase > SQL Editor)
-- ปลอดภัย/รันซ้ำได้: ใช้ IF NOT EXISTS / OR REPLACE ทั้งหมด
-- ============================================================

-- สี avatar ของผู้เดินทาง (ของเดิมที่ยัง NULL จะใช้สีตามลำดับอัตโนมัติ)
alter table travelers add column if not exists avatar_color text;

-- รายละเอียดไฟล์ต: ชั้นโดยสาร / จำนวนที่นั่ง / สถานะ
alter table flights add column if not exists seat_class text;
alter table flights add column if not exists seats int;
alter table flights add column if not exists status text;

-- รูปภาพโรงแรม (เก็บ path ใน private bucket 'trip-files')
alter table hotels add column if not exists photo_path text;

-- ธงประจำทริป (อิโมจิ)
alter table trips add column if not exists flag text;

-- ============================================================
-- ระบบเชิญ: เจ้าของทริปเชิญด้วยอีเมล → ผู้ถูกเชิญพอ login จะถูกเพิ่มเป็นสมาชิก
-- ฟังก์ชันนี้ทำงานแทนผู้ใช้ (security definer) จึงอ่าน trip_invites ได้
-- ============================================================
create or replace function accept_my_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare inv record;
begin
  for inv in
    select ti.* from trip_invites ti
    where lower(ti.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and ti.status = 'pending'
  loop
    insert into trip_members (trip_id, user_id, role)
    values (inv.trip_id, auth.uid(), 'member')
    on conflict (trip_id, user_id) do nothing;
    update trip_invites set status = 'accepted' where id = inv.id;
  end loop;
end;
$$;

grant execute on function accept_my_invites() to authenticated;
