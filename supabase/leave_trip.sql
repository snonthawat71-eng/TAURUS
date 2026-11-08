-- ============================================================
-- TAURUS — "ออกจากทริป" สำหรับสมาชิกที่ถูกแชร์มา (รันใน Supabase > SQL Editor)
--
-- ปัญหาเดิม: คนที่ไม่ได้เป็นเจ้าของทริปเอาทริปที่คนอื่นแชร์มาออกจากหน้ารวม
-- ทริปของตัวเองไม่ได้ — มันค้างอยู่ในแท็บ "ทริปที่ผ่านมา" ตลอด
--
-- ฟังก์ชันนี้ให้ "ตัวผู้เรียกเอง" ถอนตัวออกจากทริปได้ โดยลบทั้ง
--   · trip_members  (สมาชิกภาพ → ทริปหายจากหน้ารวมทริป)
--   · trip_invites  (คำเชิญของอีเมลตัวเอง → กัน accept_my_invites() ดึงกลับ)
-- เจ้าของทริปเรียกไม่ได้ (ต้องใช้ "ลบทริป" แทน) · รันซ้ำได้ปลอดภัย
-- ============================================================

create or replace function public.leave_trip(p_trip uuid)
returns void language plpgsql security definer set search_path = public as $$
declare my_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- เจ้าของทริปออกจากทริปตัวเองไม่ได้ (จะกลายเป็นทริปไร้เจ้าของ)
  if exists (select 1 from trips where id = p_trip and owner_id = auth.uid()) then
    raise exception 'owner cannot leave own trip';
  end if;

  delete from trip_members where trip_id = p_trip and user_id = auth.uid();

  -- ล้างคำเชิญของอีเมลตัวเองในทริปนี้ ไม่งั้น accept_my_invites() จะดึงกลับ
  select email into my_email from auth.users where id = auth.uid();
  if my_email is not null then
    delete from trip_invites where trip_id = p_trip and lower(email) = lower(my_email);
  end if;

  -- ปลดการ์ดผู้เดินทางที่ผูกกับบัญชีเราไว้ในทริปนี้ (การ์ดยังอยู่ให้เจ้าของทริป)
  update travelers set user_id = null where trip_id = p_trip and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_trip(uuid) to authenticated;
