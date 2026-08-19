// Taipei Metro (6 lines) + Taoyuan Airport MRT for transit suggestions —
// lines, official colours, station codes and ordered English station names,
// from the combined Taipei/Taoyuan reference doc (155 station records; no
// R22A Xinbeitou / G03A Xiaobitan; Y07–Y20 open section; Airport MRT A1–A22
// incl. A14a, future A14 Terminal 3 excluded). The O line's Huilong / Luzhou
// branches are listed as two entries (shared O01–O12 section repeated) so
// per-line station order — and stop counts between stations — stay correct.
// Airport MRT is split into Commuter (blue trains, all stops) and Express
// (purple trains, A1·A3·A8·A12·A13); the reference gives train colours only,
// so those two hexes are representative, not official line colours.
interface TaipeiStation { name: string; num: string }
interface TaipeiLine { name: string; color: string; stations: TaipeiStation[] }

const st = (num: string, name: string): TaipeiStation => ({ name, num })

export const TAIPEI: { match: string[]; lines: TaipeiLine[] } = {
  match: ['taipei', 'ไทเป', 'taiwan', 'ไต้หวัน', 'taoyuan', 'เถาหยวน', '台北', '桃園'],
  lines: [
    {
      name: 'BR Wenhu Line', color: '#C48C31',
      stations: [
        st('BR01', 'Taipei Zoo'), st('BR02', 'Muzha'), st('BR03', 'Wanfang Community'), st('BR04', 'Wanfang Hospital'),
        st('BR05', 'Xinhai'), st('BR06', 'Linguang'), st('BR07', 'Liuzhangli'), st('BR08', 'Technology Building'),
        st('BR09', 'Daan'), st('BR10', 'Zhongxiao Fuxing'), st('BR11', 'Nanjing Fuxing'), st('BR12', 'Zhongshan Junior High School'),
        st('BR13', 'Songshan Airport'), st('BR14', 'Dazhi'), st('BR15', 'Jiannan Rd.'), st('BR16', 'Xihu'),
        st('BR17', 'Gangqian'), st('BR18', 'Wende'), st('BR19', 'Neihu'), st('BR20', 'Dahu Park'),
        st('BR21', 'Huzhou'), st('BR22', 'Donghu'), st('BR23', 'Nangang Software Park'), st('BR24', 'Taipei Nangang Exhibition Center'),
      ],
    },
    {
      name: 'R Tamsui-Xinyi Line', color: '#E3002C',
      stations: [
        st('R02', 'Xiangshan'), st('R03', 'Taipei 101 / World Trade Center'), st('R04', 'Xinyi Anhe'), st('R05', 'Daan'),
        st('R06', 'Daan Park'), st('R07', 'Dongmen'), st('R08', 'Chiang Kai-Shek Memorial Hall'), st('R09', 'NTU Hospital'),
        st('R10', 'Taipei Main Station'), st('R11', 'Zhongshan'), st('R12', 'Shuanglian'), st('R13', 'Minquan W. Rd.'),
        st('R14', 'Yuanshan'), st('R15', 'Jiantan'), st('R16', 'Shilin'), st('R17', 'Zhishan'),
        st('R18', 'Mingde'), st('R19', 'Shipai'), st('R20', 'Qilian'), st('R21', 'Qiyan'),
        st('R22', 'Beitou'), st('R23', 'Fuxinggang'), st('R24', 'Zhongyi'), st('R25', 'Guandu'),
        st('R26', 'Zhuwei'), st('R27', 'Hongshulin'), st('R28', 'Tamsui'),
      ],
    },
    {
      name: 'G Songshan-Xindian Line', color: '#008659',
      stations: [
        st('G01', 'Xindian'), st('G02', 'Xindian District Office'), st('G03', 'Qizhang'), st('G04', 'Dapinglin'),
        st('G05', 'Jingmei'), st('G06', 'Wanlong'), st('G07', 'Gongguan'), st('G08', 'Taipower Building'),
        st('G09', 'Guting'), st('G10', 'Chiang Kai-Shek Memorial Hall'), st('G11', 'Xiaonanmen'), st('G12', 'Ximen'),
        st('G13', 'Beimen'), st('G14', 'Zhongshan'), st('G15', 'Songjiang Nanjing'), st('G16', 'Nanjing Fuxing'),
        st('G17', 'Taipei Arena'), st('G18', 'Nanjing Sanmin'), st('G19', 'Songshan'),
      ],
    },
    {
      name: 'O Zhonghe-Xinlu Line (Huilong)', color: '#F8B61C',
      stations: [
        st('O01', 'Nanshijiao'), st('O02', 'Jingan'), st('O03', 'Yongan Market'), st('O04', 'Dingxi'),
        st('O05', 'Guting'), st('O06', 'Dongmen'), st('O07', 'Zhongxiao Xinsheng'), st('O08', 'Songjiang Nanjing'),
        st('O09', 'Xingtian Temple'), st('O10', 'Zhongshan Elementary School'), st('O11', 'Minquan W. Rd.'), st('O12', 'Daqiaotou'),
        st('O13', 'Taipei Bridge'), st('O14', 'Cailiao'), st('O15', 'Sanchong'), st('O16', 'Xianse Temple'),
        st('O17', 'Touqianzhuang'), st('O18', 'Xinzhuang'), st('O19', 'Fu Jen University'), st('O20', 'Danfeng'),
        st('O21', 'Huilong'),
      ],
    },
    {
      name: 'O Zhonghe-Xinlu Line (Luzhou)', color: '#F8B61C',
      stations: [
        st('O01', 'Nanshijiao'), st('O02', 'Jingan'), st('O03', 'Yongan Market'), st('O04', 'Dingxi'),
        st('O05', 'Guting'), st('O06', 'Dongmen'), st('O07', 'Zhongxiao Xinsheng'), st('O08', 'Songjiang Nanjing'),
        st('O09', 'Xingtian Temple'), st('O10', 'Zhongshan Elementary School'), st('O11', 'Minquan W. Rd.'), st('O12', 'Daqiaotou'),
        st('O50', 'Sanchong Elementary School'), st('O51', 'Sanhe Junior High School'), st('O52', 'St. Ignatius High School'),
        st('O53', 'Sanmin Senior High School'), st('O54', 'Luzhou'),
      ],
    },
    {
      name: 'BL Bannan Line', color: '#0070BD',
      stations: [
        st('BL01', 'Dingpu'), st('BL02', 'Yongning'), st('BL03', 'Tucheng'), st('BL04', 'Haishan'),
        st('BL05', 'Far Eastern Hospital'), st('BL06', 'Fuzhong'), st('BL07', 'Banqiao'), st('BL08', 'Xinpu'),
        st('BL09', 'Jiangzicui'), st('BL10', 'Longshan Temple'), st('BL11', 'Ximen'), st('BL12', 'Taipei Main Station'),
        st('BL13', 'Shandao Temple'), st('BL14', 'Zhongxiao Xinsheng'), st('BL15', 'Zhongxiao Fuxing'), st('BL16', 'Zhongxiao Dunhua'),
        st('BL17', 'Sun Yat-Sen Memorial Hall'), st('BL18', 'Taipei City Hall'), st('BL19', 'Yongchun'), st('BL20', 'Houshanpi'),
        st('BL21', 'Kunyang'), st('BL22', 'Nangang'), st('BL23', 'Taipei Nangang Exhibition Center'),
      ],
    },
    {
      name: 'Y Circular Line', color: '#FFDB00',
      stations: [
        st('Y07', 'Dapinglin'), st('Y08', 'Shisizhang'), st('Y09', 'Xiulang Bridge'), st('Y10', 'Jingping'),
        st('Y11', 'Jingan'), st('Y12', 'Zhonghe'), st('Y13', 'Qiaohe'), st('Y14', 'Zhongyuan'),
        st('Y15', 'Banxin'), st('Y16', 'Banqiao'), st('Y17', 'Xinpu Minsheng'), st('Y18', 'Touqianzhuang'),
        st('Y19', 'Xingfu'), st('Y20', 'New Taipei Industrial Park'),
      ],
    },
    {
      name: 'A Taoyuan Airport MRT (Commuter)', color: '#1E6DC2',
      stations: [
        st('A1', 'Taipei Main Station'), st('A2', 'Sanchong'), st('A3', 'New Taipei Industrial Park'), st('A4', 'Xinzhuang Fuduxin'),
        st('A5', 'Taishan'), st('A6', 'Taishan Guihe'), st('A7', 'National Taiwan Sport University'), st('A8', 'Chang Gung Memorial Hospital'),
        st('A9', 'Linkou'), st('A10', 'Shanbi'), st('A11', 'Kengkou'), st('A12', 'Airport Terminal 1'),
        st('A13', 'Airport Terminal 2'), st('A14a', 'Airport Hotel'), st('A15', 'Dayuan'), st('A16', 'Hengshan'),
        st('A17', 'Linghang'), st('A18', 'Taoyuan HSR Station'), st('A19', 'Taoyuan Sports Park'), st('A20', 'Xingnan'),
        st('A21', 'Huanbei'), st('A22', 'Laojie River'),
      ],
    },
    {
      name: 'A Taoyuan Airport MRT (Express)', color: '#8246AF',
      stations: [
        st('A1', 'Taipei Main Station'), st('A3', 'New Taipei Industrial Park'), st('A8', 'Chang Gung Memorial Hospital'),
        st('A12', 'Airport Terminal 1'), st('A13', 'Airport Terminal 2'),
      ],
    },
  ],
}
