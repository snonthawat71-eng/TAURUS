// Guangzhou Metro network (lines, official VI colours, stations in order) for
// transit suggestions. English only, following the same shape as Beijing /
// Shanghai / Shenzhen — no geometry, so there is no tappable map for this city
// yet; the data only powers the line/station autocomplete.
//
// Station names follow the signage, which is NOT a plain translation: a road or
// direction in the name is romanised, not translated — 体育西路 is "Tiyu Xilu",
// not "Tiyu West Road"; 天河南 is "Tianhenan"; 江南西 "Jiangnanxi"; 新港东
// "Xingangdong"; 一德路 "Yide Lu"; 宝岗大道 "Baogang Dadao". The newer lines
// (10, 11, 18, 21, 22 and the recent extensions) do translate — "Binjiang East
// Road", "Longkou West" — which is why the two styles sit side by side here.
//
// Stations that exist but are not served are left out, so a counted leg between
// two stations stays honest:
//   Line 3  — Airport South (closed with Baiyun T1 since 7 May 2026)
//   Line 4  — Guanqiao (under construction)
//   Line 7  — Hongshengsha (under construction)
//   Line 11 — Guangzhou Railway Station (built, trains pass through)
// Trams (THZ1 Haizhu, THP1/THP2 Huangpu) are deliberately not included.
interface GuangzhouLine { name: string; color: string; stations: string[] }

export const GUANGZHOU: { match: string[]; lines: GuangzhouLine[] } = {
  match: ['guangzhou', 'กว่างโจว', 'กวางเจา', 'กวางโจว', 'canton', '广州'],
  lines: [
    { name: 'Line 1', color: '#F3D03E', stations: ["Xilang", "Kengkou", "Huadiwan", "Fangcun", "Huangsha", "Changshou Lu", "Chen Clan Academy", "Ximenkou", "Gongyuanqian", "Peasant Movement Institute", "Martyrs' Park", "Dongshankou", "Yangji", "Tiyu Xilu", "Tianhe Sports Center", "Guangzhou East Railway Station"] },
    { name: 'Line 2', color: '#00629B', stations: ["Guangzhou South Railway Station", "Shibi", "Huijiang", "Nanpu", "Luoxi", "Nanzhou", "Dongxiao South", "Jiangtai Road", "Changgang", "Jiangnanxi", "The 2nd Workers' Cultural Palace", "Haizhu Square", "Gongyuanqian", "Sun Yat-sen Memorial Hall", "Yuexiu Park", "Guangzhou Railway Station", "Sanyuanli", "Feixiang Park", "Baiyun Park", "Baiyun Culture Square", "Xiao-gang", "Jiangxia", "Huangbian", "Jiahewanggang"] },
    { name: 'Line 3', color: '#ECA154', stations: ["Airport North", "Gaozeng", "Renhe", "Longgui", "Jiahewanggang", "Baiyundadaobei", "Yongtai", "Tonghe", "Jingxi Nanfang Hospital", "Meihuayuan", "Yantang", "Guangzhou East Railway Station", "Linhexi", "Tiyu Xilu", "Zhujiang New Town", "Canton Tower", "Kecun", "Datang", "Lijiao", "Xiajiao", "Dashi", "Hanxi Changlong", "Shiqiao", "Panyu Square", "Bangjiang", "Shiqinan", "Haichong Lu", "Haibang"] },
    { name: 'Line 3 Branch', color: '#ECA154', stations: ["Tianhe Coach Terminal", "Wushan", "South China Normal University", "Gangding", "Shipaiqiao", "Tiyu Xilu"] },
    { name: 'Line 4', color: '#00843D', stations: ["Huangcun", "Chebei", "Chebeinan", "Wanshengwei", "Guanzhou", "Higher Education Mega Center North", "Higher Education Mega Center South", "Xinzao", "Shiqi", "Haibang", "Dichong", "Dongchong", "Qingsheng", "Huangge Auto Town", "Huangge", "Jiaomen", "Jinzhou", "Feishajiao", "Guanglong", "Dachong", "Tangkeng", "Nanheng", "Nansha Passenger Port"] },
    { name: 'Line 5', color: '#C5003E', stations: ["Jiaokou", "Tanwei", "Zhongshanba", "Xichang", "Xicun", "Guangzhou Railway Station", "Xiaobei", "Taojin", "Ouzhuang", "Zoo", "Yangji", "Wuyangcun", "Zhujiang New Town", "Liede", "Tancun", "Yuancun", "Keyun Lu", "Chebeinan", "Dongpu", "Sanxi", "Yuzhu", "Dashadi", "Dashadong", "Wenchong", "Shuangsha", "Miaotou", "Xiayuan", "Baoying Dadao", "Xiagang", "Huangpu New Port"] },
    { name: 'Line 6', color: '#80225F', stations: ["Xunfenggang", "Hengsha", "Shabei", "Hesha", "Tanwei", "Ruyifang", "Huangsha", "Cultural Park", "Yide Lu", "Haizhu Square", "Beijing Lu", "Tuanyida Square", "Donghu", "Dongshankou", "Ouzhuang", "Huanghuagang", "Shaheding", "Shahe", "Tianpingjia", "Yantang", "Tianhe Coach Terminal", "Changban", "Botanical Garden", "Longdong", "Kemulang", "Gaotangshi", "Huangbei", "Jinfeng", "Xiangang", "Suyuan", "Luogang", "Xiangxue"] },
    { name: 'Line 7', color: '#97D700', stations: ["Meidi Dadao", "Beijiao Park", "Midea", "Nanchong", "Jinlong", "Chencun", "Chencunbei", "Dazhou", "Guangzhou South Railway Station", "Shibi", "Xiecun", "Zhongcun", "Hanxi Changlong", "Nancun Wanbo", "Yuangang", "Banqiao", "Higher Education Mega Center South", "Shenjing", "Changzhou", "Yufengwei", "Dashadong", "Jitang", "Jiazhuang", "Kefeng Lu", "Luogang", "Shuixi", "Yanshan"] },
    { name: 'Line 8', color: '#008C95', stations: ["Jiaoxin", "Tinggang", "Shijing", "Xiaoping", "Shitan", "Julong", "Shangbu", "Tongde", "Ezhangtan", "Xicun", "Caihong Bridge", "Chen Clan Academy", "Hualinsi Buddhist Temple", "Cultural Park", "Tongfuxi", "Fenghuang Xincun", "Shayuan", "Baogang Dadao", "Changgang", "Xiaogang", "Sun Yat-sen University", "Lujiang", "Kecun", "Chigang", "Modiesha", "Xingangdong", "Pazhou", "Wanshengwei"] },
    { name: 'Line 9', color: '#71CC98', stations: ["Fei'eling", "Huadu Auto City", "Guangzhou North Railway Station", "Huachenglu", "Huaguoshan Park", "Huadu Square", "Ma'anshan Park", "Liantang", "Qingbu", "Qingtang", "Gaozeng"] },
    { name: 'Line 10', color: '#7D9CC0', stations: ["Xilang", "Huawei", "Dongsha", "Daganwei", "Gongye Avenue South", "Dongxiao South", "Wufeng", "Sun Yat-sen University South Gate", "Binjiang East Road", "Donghu", "Wuyangcun", "Yangji East"] },
    // วงแหวน — เดินรถทั้งตามเข็ม (inner) และทวนเข็ม (outer) ครบรอบ ~75 นาที
    { name: 'Line 11 (Loop)', color: '#FFB00A', stations: ["Guangzhou East Railway Station", "Longkou West", "South China Normal University", "Huajing Road", "Tianhe Park", "Yuancun", "Pazhou", "Chisha", "Longtan", "Datang", "Shangchong", "Yijing Road", "Wufeng", "Jiangtai Road", "Yangang", "Diyuan", "Hedong East", "Shachong", "Dachongkou", "Fangcun", "Shiweitang", "Ruyifang", "Zhongshanba", "Caihong Bridge", "Liuhua", "Ziyuangang", "Guangzhou University of Chinese Medicine", "Dajinzhong Road", "Yuntai Garden", "Shahe"] },
    // ยังเปิดไม่ครบ: ช่วงกลาง (Guangzhou Gymnasium ↔ Ersha Island) กำลังก่อสร้าง
    { name: 'Line 12', color: '#59621D', stations: ["Xunfenggang", "Xunfenggang North", "Xizhou", "Julong", "Guangzhou Baiyun Railway Station", "Tangchong", "Xinshixu", "Baiyun Culture Square", "Guangzhou Gymnasium", "Ersha Island", "Chigang Pagoda", "Chigang", "Chisha North", "Chisha", "Beishan", "Guanzhou", "Higher Education Mega Center North", "Higher Education Mega Center South"] },
    { name: 'Line 13', color: '#8E8C13', stations: ["Tianhe Park", "Tangxia", "Chebei", "Tianhe Zhucun", "Yuzhu", "Yufengwei", "Shuanggang", "Nanhai God Temple", "Xiayuan", "Nangang", "Shacun", "Baijiang", "Xintang", "Guanhu", "Xinsha"] },
    { name: 'Line 14', color: '#81312F', stations: ["Lejia Road", "Yunxiao Road", "Xinshixu", "Mawu", "Hebian", "Helong", "Pengbian", "Jiahewanggang", "Baiyun Dongping", "Xialiang", "Taihe", "Zhuliao", "Zhongluotan", "Mali", "Xinhe", "Taiping", "Shengang", "Chicao", "Conghua Coach Terminal", "Dongfeng"] },
    { name: 'Line 14 Branch (Knowledge City)', color: '#81312F', stations: ["Xinhe", "Hongwei", "Xinnan", "Fengxia", "Sino-Singapore Guangzhou Knowledge City", "Hetangxia", "Wangcun", "Tangcun", "Zhenlongbei", "Zhenlong"] },
    { name: 'Line 18', color: '#3040B6', stations: ["Xiancun", "Modiesha", "Longtan", "Shaxi", "Nancun Wanbo", "Panyu Square", "Hengli", "Wanqingsha"] },
    { name: 'Line 21', color: '#211747', stations: ["Tianhe Park", "Tangdong", "Huangcun", "Daguannanlu", "Tianhe Smart City", "Shenzhoulu", "Science City", "Suyuan", "Shuixi", "Changping", "Jinkeng", "Zhenlongxi", "Zhenlong", "Zhongxin", "Kengbei", "Fenggang", "Zhucun", "Shantian", "Zhonggang", "Zengcheng Square"] },
    { name: 'Line 22', color: '#D24C1E', stations: ["Panyu Square", "Shiguanglu", "Guangzhou South Railway Station", "Chentougang", "Nanpu West", "Nanjiao", "Xilang", "Fangcun"] },
    // สายเชื่อมเมือง กว่างโจว ↔ ฝอซาน (ช่วงในฝอซานนับเป็น Foshan Metro Line 1 ด้วย)
    { name: 'Guangfo Line', color: '#C4D600', stations: ["Xincheng Dong", "Dongping", "Shijilian", "Lanshi", "Kuiqi Lu", "Jihua Park", "Tongji Lu", "Zumiao", "Pujun Beilu", "Chao'an", "Guicheng", "Nangui Lu", "Leigang", "Qiandeng Lake", "Financial Hi-Tech Zone", "Longxi", "Jushu", "Xilang", "Hedong", "Shachong", "Shayuan", "Yangang", "Shixi", "Nanzhou", "Lijiao"] },
    { name: 'APM Line', color: '#00B5E2', stations: ["Canton Tower", "Haixinsha", "Guangzhou Opera House", "Huacheng Dadao", "Guangzhou Women and Children's Medical Center", "Huangpu Dadao", "Tianhenan", "Tianhe Sports Center South", "Linhexi"] },
  ],
}
