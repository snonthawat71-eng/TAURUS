-- ============================================================
-- TAURUS — รูปภาพหลายรูปต่อสถานที่ (สูงสุด 4 รูป)
--   รูปแรกยังเก็บที่ photo_url/photo_path เหมือนเดิม (โชว์บนการ์ด)
--   รูปที่ 2–4 เก็บเป็น array ใน photos (โชว์ตอนเปิดดูรายละเอียด)
--   รันใน Supabase > SQL Editor — รันซ้ำได้ปลอดภัย
-- ============================================================

-- places: เก็บ path (private bucket) หรือ URL ก็ได้
alter table places add column if not exists photos text[];

-- explore_places: เก็บเป็น public URL (pool สาธารณะ)
alter table explore_places add column if not exists photos text[];
