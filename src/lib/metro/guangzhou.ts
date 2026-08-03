// Guangzhou Metro network (lines, official VI colours, stations in order) for
// transit suggestions. English only, following the same shape as Beijing /
// Shanghai / Shenzhen — no geometry, so there is no tappable map for this city
// yet; the data only powers the line/station autocomplete.
//
// Stations that exist on the map but are not served yet are left out, so a
// counted leg between two stations stays honest:
//   Line 3  — Airport South (service suspended)
//   Line 4  — Guanqiao (under construction)
//   Line 7  — Hongshengsha (under construction)
//   Line 11 — Guangzhou Railway Station (built, trains do not stop)
// Trams (THZ1 Haizhu, THP1/THP2 Huangpu) are deliberately not included.
interface GuangzhouLine { name: string; color: string; stations: string[] }

export const GUANGZHOU: { match: string[]; lines: GuangzhouLine[] } = {
  match: ['guangzhou', 'กว่างโจว', 'กวางเจา', 'กวางโจว', 'canton', '广州'],
  lines: [
    { name: 'Line 1', color: '#F3D03E', stations: ["Guangzhou East Railway Station", "Tianhe Sports Center", "Tiyu West Road", "Yangji", "Dongshankou", "Martyr's Cemetery", "Peasant Movement Institute", "Gongyuanqian", "Ximenkou", "Chen Clan Academy", "Changshou Road", "Huangsha", "Fangcun", "Huadiwan", "Kengkou", "Xilang"] },
    { name: 'Line 2', color: '#00629B', stations: ["Guangzhou South Railway Station", "Shibi", "Huijiang", "Nanpu", "Luoxi", "Nanzhou", "Dongxiao South", "Jiangtai Road", "Changgang", "Jiangnan West", "The 2nd Worker's Cultural Palace", "Haizhu Square", "Gongyuanqian", "Sun Yat-sen Memorial Hall", "Yuexiu Park", "Guangzhou Railway Station", "Sanyuanli", "Feixiang Park", "Baiyun Park", "Baiyun Culture Square", "Xiaogang", "Jiangxia", "Huangbian", "Jiahewanggang"] },
    { name: 'Line 3', color: '#ECA154', stations: ["Airport North", "Gaozeng", "Renhe", "Longgui", "Jiahewanggang", "Baiyun Avenue North", "Yongtai", "Tonghe", "Jingxi Nanfang Hospital", "Meihuayuan", "Yantang", "Guangzhou East Railway Station", "Linhe West", "Tiyu West Road", "Zhujiang New Town", "Canton Tower", "Kecun", "Datang", "Lijiao", "Xiajiao", "Dashi", "Hanxi Changlong", "Shiqiao", "Panyu Square", "Shiqi South", "Haichong Road", "Bangjiang", "Haibang"] },
    { name: 'Line 3 Branch', color: '#ECA154', stations: ["Tianhe Coach Terminal", "Wushan", "South China Normal University", "Gangding", "Shipaiqiao", "Tiyu West Road"] },
    { name: 'Line 4', color: '#00843D', stations: ["Huangcun", "Chebei", "Chebei South", "Wanshengwei", "Guanzhou", "Higher Education Mega Center North", "Higher Education Mega Center South", "Xinzao", "Shiqi", "Haibang", "Dichong", "Dongchong", "Qingsheng", "Nansha North Railway Station", "Huangge Auto Town", "Huangge", "Jiaomen", "Jinzhou", "Feishajiao", "Guanglong", "Dachong", "Tangkeng", "Nanheng", "Nansha Passenger Port"] },
    { name: 'Line 5', color: '#C5003E', stations: ["Jiaokou", "Tanwei", "Zhongshanba", "Xichang", "Xicun", "Guangzhou Railway Station", "Xiaobei", "Taojin", "Ouzhuang", "Dongwuyuan (Zoo)", "Yangji", "Wuyangcun", "Zhujiang New Town", "Liede", "Tancun", "Yuancun", "Keyun Road", "Chebei South", "Dongpu", "Sanxi", "Yuzhu", "Dashadi", "Dasha East", "Wenchong", "Shuangsha", "Miaotou", "Xiagang", "Baoying Dadao", "Huangpu New Port"] },
    { name: 'Line 6', color: '#80225F', stations: ["Xunfenggang", "Hengsha", "Shabei", "Hesha", "Tanwei", "Ruyifang", "Huangsha", "Cultural Park", "Yide Road", "Haizhu Square", "Beijing Road", "Tuanyida Square", "Donghu", "Dongshankou", "Ouzhuang", "Huanghuagang", "Shaheding", "Shahe", "Tianpingjia", "Yantang", "Tianhe Coach Terminal", "Changban", "Botanical Garden", "Longdong", "Kemulang", "Gaotangshi", "Huangbei", "Jinfeng", "Xiangang", "Suyuan", "Luogang", "Xiangxue"] },
    { name: 'Line 7', color: '#97D700', stations: ["Meidi Avenue", "Beijiao Park", "Midea", "Nanchong", "Jinlong", "Chencun", "Chencun North", "Dazhou", "Guangzhou South Railway Station", "Shibi", "Xiecun", "Zhongcun", "Hanxi Changlong", "Nancun Wanbo", "Yuangang", "Banqiao", "Higher Education Mega Center South", "Shenjing", "Changzhou", "Yufengwei", "Dasha East", "Jitang", "Jiazhuang", "Kefeng Road", "Luogang", "Shuixi", "Yanshan"] },
    { name: 'Line 8', color: '#008C95', stations: ["Jiaoxin", "Tinggang", "Shijing", "Xiaoping", "Shitan", "Julong", "Shangbu", "Tongde", "Ezhangtan", "Xicun", "Caihongqiao", "Chen Clan Academy", "Hualinsi Buddhist Temple", "Cultural Park", "Tongfu West", "Fenghuang Xincun", "Shayuan", "Baogang Avenue", "Changgang", "Xiaogang", "Sun Yat-sen University", "Lujiang", "Kecun", "Chigang", "Modiesha", "Xingang East", "Pazhou", "Wanshengwei"] },
    { name: 'Line 9', color: '#71CC98', stations: ["Fei'eling", "Huadu Auto City", "Guangzhou North Railway Station", "Huacheng Road", "Huaguoshan Park", "Huadu Square", "Ma'anshan Park", "Liantang", "Qingbu", "Qingtang", "Gaozeng"] },
    { name: 'Line 10', color: '#7D9BC1', stations: ["Xilang", "Huawei", "Dongsha", "Daganwei", "Gongye Avenue South", "Dongxiao South", "Wufeng", "Sun Yat-sen University South Gate", "Binjiang East Road", "Donghu", "Wuyangcun", "Yangji East"] },
    // วงแหวน — เดินรถทั้งตามเข็ม (inner) และทวนเข็ม (outer) ครบรอบ ~75 นาที
    { name: 'Line 11 (Loop)', color: '#470A68', stations: ["Chisha", "Pazhou", "Yuancun", "Tianhe Park", "Huajing Road", "South China Normal University", "Longkou West", "Guangzhou East Railway Station", "Shahe", "Yuntai Garden", "Dajinzhong Road", "Guangzhou University of Chinese Medicine", "Ziyuangang", "Liuhua Road", "Caihongqiao", "Zhongshanba", "Ruyifang", "Shiweitang", "Fangcun", "Dachongkou", "Shachong", "Hedong East", "Diyuan", "Yangang", "Jiangtai Road", "Wufeng", "Yijing Road", "Shangchong", "Datang", "Longtan"] },
    // ยังเปิดไม่ครบ: ช่วงกลาง (Guangzhou Gymnasium ↔ Ersha Island) กำลังก่อสร้าง
    { name: 'Line 12', color: '#59621D', stations: ["Xunfenggang", "Xunfenggang North", "Xizhou", "Julong", "Guangzhou Baiyun Railway Station", "Yunxiao Road", "Tangchong", "Xinshixu", "Guangzhou Gymnasium", "Ersha Island", "Chigang", "Chisha", "Chisha North", "Beishan", "Higher Education Mega Center South"] },
    { name: 'Line 13', color: '#8E8C13', stations: ["Tianhe Park", "Tangxia", "Tianhe Zhucun", "Yuzhu", "Yufengwei", "Shuanggang", "South Sea God Temple", "Xiayuan", "Nangang", "Shacun", "Baijiang", "Xintang", "Guanhu", "Xinsha"] },
    { name: 'Line 14', color: '#81312F', stations: ["Lejia Road", "Jiahewanggang", "Baiyun Dongping", "Xialiang", "Taihe", "Zhuliao", "Zhongluotan", "Mali", "Xinhe", "Taiping", "Shengang", "Chicao", "Conghua Coach Terminal", "Dongfeng"] },
    { name: 'Line 14 Branch (Knowledge City)', color: '#81312F', stations: ["Xinhe", "Hongwei", "Xinnan", "Fengxia", "Sino-Singapore Guangzhou Knowledge City", "Hetangxia", "Wangcun", "Tangcun", "Zhenlong North", "Zhenlong"] },
    { name: 'Line 18', color: '#D48BC8', stations: ["Xiancun", "Chisha North", "Longtan", "Shaxi", "Nancun Wanbo", "Panyu Square", "Hengli", "Wanqingsha"] },
    { name: 'Line 21', color: '#201747', stations: ["Tianhe Park", "Tangdong", "Huangcun", "South Daguan Road", "Tianhe Smart City", "Shenzhou Road", "Science City", "Suyuan", "Shuixi", "Changping", "Jinkeng", "Zhenlong West", "Zhenlong", "Zhongxin", "Kengbei", "Fenggang", "Zhucun", "Shantian", "Zhonggang", "Zengcheng Square"] },
    { name: 'Line 22', color: '#041E42', stations: ["Fangcun", "Nanjiao", "Nanpu West", "Chentougang", "Guangzhou South Railway Station", "Shiguang Road", "Panyu Square"] },
    // สายเชื่อมเมือง กว่างโจว ↔ ฝอซาน (ช่วงในฝอซานนับเป็น Foshan Metro Line 1 ด้วย)
    { name: 'Guangfo Line', color: '#C4D600', stations: ["Xincheng East", "Dongping", "Shijilian", "Leigang", "Nangui Road", "Qiandeng Lake", "Financial Hi-Tech Zone", "Guicheng", "Chao'an", "North Pujun Road", "Zumiao", "Tongji Road", "Jihua Park", "Kuiqi Road", "Lanshi", "Shiwan", "Longxi", "Jushu", "Xilang", "Hedong", "Shachong", "Yangang", "Shixi", "Lijiao"] },
    { name: 'APM Line', color: '#00B5E2', stations: ["Canton Tower", "Haixinsha", "Guangzhou Opera House", "Huacheng Avenue", "Women and Children's Medical Center", "Huangpu Avenue", "Tianhe South", "Tianhe Sports Center South", "Linhe West"] },
  ],
}
