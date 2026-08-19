-- privacy.sql — ความเป็นส่วนตัวของข้อมูลผู้เดินทาง (B+C)
-- รันใน Supabase SQL Editor ครั้งเดียว · รันซ้ำได้ปลอดภัย
--
-- แนวคิด: การ์ดผู้เดินทางแต่ละใบ "มีเจ้าของ" (กดรับด้วยปุ่ม "การ์ดนี้คือฉัน")
-- และมีระดับความเป็นส่วนตัว:
--   'trip'    = ทุกคนในทริปเห็นเอกสาร/QR ได้ (แบบเดิม)
--   'private' = เห็นได้เฉพาะเจ้าของการ์ด + เจ้าของทริป (ค่าเริ่มต้น)
-- เจ้าของทริป (trips.owner_id) เห็นและจัดการของทุกคนได้เสมอ
-- การ์ดที่ยังไม่มีใครกดรับ = ทำงานแบบเดิมทุกอย่าง (ไม่มีอะไรพังหลังรัน)

alter table public.travelers add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.travelers add column if not exists privacy text not null default 'private';

-- ผู้ใช้ปัจจุบันมีสิทธิ์เห็นข้อมูลส่วนตัวของการ์ดนี้ไหม
create or replace function public.can_view_traveler(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from travelers t
    join trips tr on tr.id = t.trip_id
    where t.id = tid
      and (
        coalesce(t.privacy, 'private') = 'trip'  -- เปิดให้ทั้งทริป
        or t.user_id is null                     -- ยังไม่มีเจ้าของ → แบบเดิม
        or t.user_id = auth.uid()                -- เจ้าของการ์ด
        or tr.owner_id = auth.uid()              -- เจ้าของทริปเห็นเสมอ
      )
  );
$$;

-- เจ้าของการ์ดตัวจริง (ใช้เปิดสิทธิ์เขียนของตัวเองแม้ได้รับสิทธิ์ทริปแค่ view)
create or replace function public.is_traveler_owner(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from travelers t where t.id = tid and t.user_id = auth.uid());
$$;

-- ── traveler_files: อ่าน/เขียนต้องผ่านกฎความเป็นส่วนตัวของการ์ดด้วย ──
drop policy if exists "rw_read"  on public.traveler_files;
drop policy if exists "rw_write" on public.traveler_files;
create policy "rw_read" on public.traveler_files for select
  using (can_view_full(trip_id) and can_view_traveler(traveler_id));
create policy "rw_write" on public.traveler_files for all
  using ((can_edit_trip(trip_id) and can_view_traveler(traveler_id)) or is_traveler_owner(traveler_id))
  with check ((can_edit_trip(trip_id) and can_view_traveler(traveler_id)) or is_traveler_owner(traveler_id));

-- ── train_tickets (Quick QR): กฎเดียวกัน (ตั๋วที่ไม่ผูกกับใคร = ระดับทริปเหมือนเดิม) ──
drop policy if exists "rw_read"  on public.train_tickets;
drop policy if exists "rw_write" on public.train_tickets;
create policy "rw_read" on public.train_tickets for select
  using (can_view_full(trip_id) and (traveler_id is null or can_view_traveler(traveler_id)));
create policy "rw_write" on public.train_tickets for all
  using ((can_edit_trip(trip_id) and (traveler_id is null or can_view_traveler(traveler_id))) or is_traveler_owner(traveler_id))
  with check ((can_edit_trip(trip_id) and (traveler_id is null or can_view_traveler(traveler_id))) or is_traveler_owner(traveler_id));

-- ── travelers: ใครก็ตามในทริป "กดรับการ์ดที่ยังว่าง" ได้ และเจ้าของการ์ด
--    ปรับระดับความเป็นส่วนตัวของตัวเองได้ แม้สิทธิ์ทริปเป็นแค่ view ──
drop policy if exists "traveler_self_update" on public.travelers;
create policy "traveler_self_update" on public.travelers for update
  using (is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()))
  with check (is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()));

-- กันสมาชิกอื่น (แม้มีสิทธิ์แก้ไขทริป) เปลี่ยน "เจ้าของการ์ด/ระดับความเป็นส่วนตัว"
-- ของการ์ดที่มีเจ้าของแล้ว — แก้ได้เฉพาะเจ้าของการ์ดหรือเจ้าของทริป
create or replace function public.guard_traveler_privacy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.user_id is distinct from old.user_id or new.privacy is distinct from old.privacy) then
    if not (
      old.user_id is null
      or old.user_id = auth.uid()
      or exists (select 1 from trips tr where tr.id = old.trip_id and tr.owner_id = auth.uid())
    ) then
      raise exception 'ไม่มีสิทธิ์แก้ความเป็นส่วนตัวของการ์ดนี้';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_traveler_privacy on public.travelers;
create trigger trg_guard_traveler_privacy before update on public.travelers
for each row execute function public.guard_traveler_privacy();
