import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Copy, 
  Check, 
  Zap, 
  Play, 
  Activity, 
  Network, 
  Globe, 
  Compass, 
  CloudLightning,
  AlertCircle,
  HelpCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { cn, downloadReport } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';

interface DnsRecord {
  ip: string;
  name: string;
  location: string;
  operator: '电信' | '联通' | '移动' | '公共' | '海外' | '其它';
  groupName: string;
  desc?: string;
}

export function DnsTool({ onExportReady }: ToolComponentProps) {
  const [activeTab, setActiveTab] = useState<'domestic' | 'international'>('domestic');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('All');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // States to hold test results
  // key: IP, value: { status: 'idle' | 'testing' | 'success' | 'error', latency?: number, resolvedIps?: string[], errCode?: string }
  const [testResults, setTestResults] = useState<Record<string, {
    status: 'idle' | 'testing' | 'success' | 'done' | 'error';
    latency?: number;
    addresses?: string[];
    error?: string;
  }>>({});
  const [isBulkTesting, setIsBulkTesting] = useState(false);

  // 1. Domestic DNS data (国内公共及各省市公网 DNS)
  const domesticDnsData: DnsRecord[] = [
    // 全国主力公共DNS
    { ip: '223.5.5.5', name: 'AliDNS 阿里公共', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '阿里巴巴提供的免费公共DNS，支持DoH/DoT，速度极快' },
    { ip: '223.6.6.6', name: 'AliDNS 阿里公共次选', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '阿里巴巴公共DNS备用地址' },
    { ip: '119.29.29.29', name: 'DNSPod 腾讯公共', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '腾讯云旗下的公共DNS，准确率高，防劫持能力强' },
    { ip: '182.254.116.116', name: 'DNSPod 腾讯公共次选', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '腾讯公共DNS备用地址' },
    { ip: '180.76.76.76', name: 'BaiduDNS 百度公共', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '百度公共DNS，拥有海大带宽和极速解析能力' },
    { ip: '114.114.114.114', name: '114 安全 DNS', location: '全国各大运营商骨干', operator: '公共', groupName: '全国骨干公共 DNS', desc: '国内最知名的老牌公共DNS，稳定性极佳' },
    { ip: '114.114.115.115', name: '114 安全 DNS 次选', location: '全国各大运营商骨干', operator: '公共', groupName: '全国骨干公共 DNS', desc: '114公共DNS备用地址' },
    { ip: '180.184.1.1', name: 'VolcEngine 字节跳动公共', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '火山引擎公共DNS，为头条系产品加速，路由精准' },
    { ip: '180.184.2.2', name: 'VolcEngine 字节跳动次选', location: '全国骨干Anycast', operator: '公共', groupName: '全国骨干公共 DNS', desc: '火山引擎公共DNS备用地址' },
    { ip: '101.226.4.6', name: '360 安全 DNS', location: '华东/电信', operator: '公共', groupName: '全国骨干公共 DNS', desc: '360安全网络解析中心，提供安全防钓鱼防劫持服务' },
    { ip: '218.30.118.6', name: '360 安全 DNS 备用', location: '北京/电信', operator: '公共', groupName: '全国骨干公共 DNS', desc: '360安全DNS备用地址' },
    { ip: '1.2.4.8', name: 'SDNS 中国互联网络信息中心', location: 'CNNIC全国骨干', operator: '公共', groupName: '全国骨干公共 DNS', desc: '中国互联网络信息中心提供的免费安全解析DNS' },
    { ip: '210.2.4.8', name: 'SDNS CNNIC备用', location: 'CNNIC全国骨干', operator: '公共', groupName: '全国骨干公共 DNS', desc: 'CNNIC安全公共DNS备用地址' },
    
    // 省市运营商核心DNS - 电信
    { ip: '219.141.136.10', name: '北京电信 主 DNS', location: '北京 (Beijing)', operator: '电信', groupName: '热门省市电信核心 DNS', desc: '北方重要电信出口局核心解析器' },
    { ip: '219.141.140.10', name: '北京电信 备 DNS', location: '北京 (Beijing)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '116.228.111.118', name: '上海电信 主 DNS', location: '上海 (Shanghai)', operator: '电信', groupName: '热门省市电信核心 DNS', desc: '南方电信骨干出口关键节点' },
    { ip: '180.168.255.18', name: '上海电信 备 DNS', location: '上海 (Shanghai)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '202.96.128.166', name: '广州/广东电信 主', location: '广东 (Guangdong)', operator: '电信', groupName: '热门省市电信核心 DNS', desc: '华南最大骨干节点出入口解析' },
    { ip: '202.96.128.86', name: '广州/广东电信 备', location: '广东 (Guangdong)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '202.96.104.15', name: '杭州/浙江电信 主', location: '浙江 (Zhejiang)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '202.96.103.36', name: '杭州/浙江电信 备', location: '浙江 (Zhejiang)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '221.228.255.1', name: '南京/江苏电信 主', location: '江苏 (Jiangsu)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '218.2.2.2', name: '南京/江苏电信 备', location: '江苏 (Jiangsu)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '61.139.2.69', name: '成都/四川电信 主', location: '四川 (Sichuan)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '218.6.200.139', name: '成都/四川电信 备', location: '四川 (Sichuan)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '202.103.24.68', name: '武汉/湖北电信 主', location: '湖北 (Hubei)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '202.103.44.150', name: '武汉/湖北电信 备', location: '湖北 (Hubei)', operator: '电信', groupName: '热门省市电信核心 DNS' },
    { ip: '221.228.255.19', name: '无锡/江苏电信 主 DNS', location: '无锡 (Wuxi)', operator: '电信', groupName: '热门省市电信核心 DNS', desc: '无锡本地电信骨干解析器' },
    { ip: '61.132.163.68', name: '合肥/安徽电信 主 DNS', location: '合肥 (Hefei)', operator: '电信', groupName: '热门省市电信核心 DNS', desc: '安徽省骨干解析枢纽节点' },
    { ip: '61.128.128.68', name: '重庆电信 主 DNS', location: '重庆 (Chongqing)', operator: '电信', groupName: '热门省市电信核心 DNS', desc: '西南重镇骨干出入口核心解析' },

    // 省市运营商核心DNS - 联通
    { ip: '202.106.0.20', name: '北京联通 主 DNS', location: '北京 (Beijing)', operator: '联通', groupName: '热门省市联通核心 DNS', desc: '北京北方联通核心出口DNS' },
    { ip: '202.106.196.115', name: '北京联通 备 DNS', location: '北京 (Beijing)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '210.22.84.3', name: '上海联通 主 DNS', location: '上海 (Shanghai)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '210.22.70.3', name: '上海联通 备 DNS', location: '上海 (Shanghai)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '210.21.196.6', name: '深圳/广东联通 主', location: '广东 (Guangdong)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '210.21.4.130', name: '深圳/广东联通 备', location: '广东 (Guangdong)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '202.102.128.68', name: '济南/山东联通 主', location: '山东 (Shandong)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '202.102.134.68', name: '济南/山东联通 备', location: '山东 (Shandong)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '202.102.224.68', name: '郑州/河南联通 主', location: '河南 (Henan)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '202.102.227.68', name: '郑州/河南联通 备', location: '河南 (Henan)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '218.2.135.1', name: '无锡联通 主 DNS', location: '无锡 (Wuxi)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '202.102.213.68', name: '合肥/安徽联通 主 DNS', location: '合肥 (Hefei)', operator: '联通', groupName: '热门省市联通核心 DNS' },
    { ip: '221.5.203.98', name: '重庆联通 主 DNS', location: '重庆 (Chongqing)', operator: '联通', groupName: '热门省市联通核心 DNS' },

    // 省市运营商核心DNS - 移动
    { ip: '211.136.17.107', name: '北京移动 主 DNS', location: '北京 (Beijing)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    { ip: '211.136.20.203', name: '北京移动 备 DNS', location: '北京 (Beijing)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    { ip: '211.136.112.50', name: '上海移动 主 DNS', location: '上海 (Shanghai)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    { ip: '211.136.150.66', name: '上海移动 备 DNS', location: '上海 (Shanghai)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    { ip: '211.136.192.6', name: '广州/广东移动 主', location: '广东 (Guangdong)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    { ip: '211.140.13.188', name: '杭州/浙江移动 主', location: '浙江 (Zhejiang)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    { ip: '211.136.212.181', name: '重庆移动 主 DNS', location: '重庆 (Chongqing)', operator: '移动', groupName: '热门省市移动核心 DNS' },
    
    // 高校/教育网
    { ip: '101.6.6.6', name: '清华大学 TUNA DNS', location: '清华大学教育网', operator: '其它', groupName: '高校及学术机构 DNS', desc: '清华大学信息化用户中心提供的公共安全DNS' }
  ];

  // 2. International DNS data (国外大厂、知名安全 DNS 及多国 ISP)
  const internationalDnsData: DnsRecord[] = [
    // 全球巨头/商用公共DNS
    { ip: '1.1.1.1', name: 'Cloudflare 主 DNS', location: '全球 Anycast (Cloudflare)', operator: '海外', groupName: '全球巨头公共 DNS', desc: '宣称全球解析速度最快的隐私保护型免费公共DNS' },
    { ip: '1.0.0.1', name: 'Cloudflare 备 DNS', location: '全球 Anycast (Cloudflare)', operator: '海外', groupName: '全球巨头公共 DNS' },
    { ip: '8.8.8.8', name: 'Google Public DNS', location: '全球 Anycast (Google)', operator: '海外', groupName: '全球巨头公共 DNS', desc: '谷歌全球覆盖率最高、最具权威性的公共DNS' },
    { ip: '8.8.4.4', name: 'Google DNS 备用', location: '全球 Anycast (Google)', operator: '海外', groupName: '全球巨头公共 DNS' },
    { ip: '9.9.9.9', name: 'Quad9 安全过滤', location: '全球 Anycast (Quad9/IBM)', operator: '海外', groupName: '全球巨头公共 DNS', desc: '防范恶意软件与电信欺诈的安全公共DNS，由IBM承托支持' },
    { ip: '149.112.112.112', name: 'Quad9 DNS 备用', location: '全球 Anycast (Quad9)', operator: '海外', groupName: '全球巨头公共 DNS' },

    // 安全防御/智能过滤DNS
    { ip: '208.67.222.222', name: 'Cisco OpenDNS', location: '全球 Anycast (Cisco)', operator: '海外', groupName: '知名安全智能 DNS', desc: '思科旗下老牌公共DNS，带家庭护盾及内容分类过滤过滤功能' },
    { ip: '208.67.220.220', name: 'Cisco OpenDNS 备用', location: '全球 Anycast (Cisco)', operator: '海外', groupName: '知名安全智能 DNS' },
    { ip: '94.140.14.14', name: 'AdGuard 广告拦截 DNS', location: 'AdGuard 核心节点', operator: '海外', groupName: '知名安全智能 DNS', desc: '俄罗斯知名去广告卫士，在网关端主动拦截广告追踪' },
    { ip: '94.140.15.15', name: 'AdGuard DNS 备用', location: 'AdGuard 核心节点', operator: '海外', groupName: '知名安全智能 DNS' },
    { ip: '185.228.168.9', name: 'CleanBrowsing 安全组', location: 'CleanBrowsing 节点', operator: '海外', groupName: '知名安全智能 DNS', desc: '支持家庭上网净化、安全阻止有害及色情内容的分类解析' },
    { ip: '185.222.222.222', name: 'DNS.SB 主解析器', location: '亚太/欧洲 Anycast', operator: '海外', groupName: '知名安全智能 DNS', desc: '注重纯净无DNSHijack/无记录的安全极速DNS' },
    
    // 国际热门国家/地区 ISP 及云出口
    { ip: '75.75.75.75', name: 'Comcast Broadband', location: '美国 (United States)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '美国最大的宽带运营商Comcast公共骨干解析器' },
    { ip: '4.2.2.1', name: 'Lumen / Level3 DNS', location: '美国核心骨干网 (Lumen)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '全球骨干运营商Level3经典Anycast查询网关' },
    { ip: '4.2.2.2', name: 'Lumen / Level3 备用', location: '美国核心骨干网 (Lumen)', operator: '海外', groupName: '国际热门国家核心 ISP DNS' },
    { ip: '168.95.1.1', name: 'HiNet 中华电信', location: '台湾地区 (Taiwan)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '台湾地区最大电信运营商中华电信公共DNS主解析节点' },
    { ip: '168.95.192.1', name: 'HiNet 中华电信 备', location: '台湾地区 (Taiwan)', operator: '海外', groupName: '国际热门国家核心 ISP DNS' },
    { ip: '139.175.10.20', name: '台湾 Seednet 数位联合', location: '台湾地区 (Taiwan)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '台湾知名网外主要机房公用节点' },
    { ip: '205.252.144.228', name: 'PCCW 电讯盈科', location: '香港地区 (Hong Kong)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '中国香港PCCW核心出口解析节点' },
    { ip: '165.21.83.88', name: 'Singtel 新加坡电信', location: '新加坡 (Singapore)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '新加坡最大国有电信运营商机房核心解析服务器' },
    { ip: '203.116.1.78', name: 'StarHub 星和电信', location: '新加坡 (Singapore)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '新加坡三大电信商之一星和主力域名解析' },
    { ip: '210.141.112.163', name: 'KDDI Public DNS', location: '日本东京都 (Japan)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '日本KDDI通讯公有核心DNS，延迟低、稳定性强' },
    { ip: '202.234.232.13', name: 'NTT OCN Broadband', location: '日本 (Japan)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '日系NTT集团骨干光纤核心网解析服务器' },
    { ip: '218.176.41.2', name: 'SoftBank 软银 BB', location: '日本 (Japan)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '日本SoftBank宽带主力出口解析节点' },
    { ip: '202.188.0.133', name: 'Telekom Malaysia 马来西亚电信', location: '马来西亚 (Malaysia)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '马来西亚国家电信核心主域名解析器' },
    { ip: '210.187.0.1', name: 'Maxis Broadband', location: '马来西亚 (Malaysia)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '马来西亚主流移动宽带运营商Maxis解析器' },
    { ip: '203.162.4.190', name: 'VNPT Vietnam 越南邮电', location: '越南 (Vietnam)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '越南国家邮电核心主力Anycast域名解析节点' },
    { ip: '203.113.131.1', name: 'Viettel Telecom 越南军用电子', location: '越南 (Vietnam)', operator: '海外', groupName: '国际热门国家核心 ISP DNS', desc: '越南最大移动及宽带骨干网Viettel解析器' },
    { ip: '62.6.40.162', name: 'BT 英国电信', location: '英国 (United Kingdom)', operator: '海外', groupName: '国际热门国家核心 ISP DNS' },
    { ip: '194.25.2.129', name: 'Deutsche Telekom', location: '德国 (Germany)', operator: '海外', groupName: '国际热门国家核心 ISP DNS' },
    { ip: '203.142.128.66', name: 'China Mobile Int.', location: '中国移动国际出口 (CMI)', operator: '海外', groupName: '国际热门国家核心 ISP DNS' }
  ];

  const currentDataset = activeTab === 'domestic' ? domesticDnsData : internationalDnsData;

  // Stats Calculations for the Chart
  const getGeoRegion = (loc: string, isInternational: boolean) => {
    if (isInternational) {
      if (loc.includes('全球')) return '全球/Anycast';
      if (loc.includes('美国')) return '北美洲 (美国)';
      if (loc.includes('香港') || loc.includes('台湾')) return '亚太 (港澳台)';
      if (loc.includes('日本') || loc.includes('新加坡') || loc.includes('马来西亚') || loc.includes('越南')) return '亚洲 (东/东南亚)';
      if (loc.includes('欧洲') || loc.includes('英国') || loc.includes('德国')) return '欧洲区域';
      if (loc.includes('CMI')) return '大中华区节点';
      return '其它海外';
    } else {
      if (loc.includes('全国') || loc.includes('CNNIC')) return '全国骨干节点';
      if (loc.includes('北京') || loc.includes('清华')) return '华北 (京津冀)';
      if (loc.includes('上海') || loc.includes('江苏') || loc.includes('浙江') || loc.includes('无锡') || loc.includes('合肥') || loc.includes('华东') || loc.includes('山东')) return '华东 (江浙沪鲁)';
      if (loc.includes('广东')) return '华南 (粤)';
      if (loc.includes('四川') || loc.includes('重庆')) return '西南 (川渝)';
      if (loc.includes('湖北') || loc.includes('河南')) return '华中 (鄂豫)';
      return '其它地区';
    }
  };

  const REGION_COORDS: Record<string, [number, number]> = {
    '全球/Anycast': [-40, 30],
    '北美洲 (美国)': [-95, 38],
    '亚太 (港澳台)': [114.1, 22.3],
    '亚洲 (东/东南亚)': [103.8, 1.3],
    '欧洲区域': [10, 51],
    '大中华区节点': [114, 28],
    '其它海外': [60, 20],
    '全国骨干节点': [108.9, 34.3],
    '华北 (京津冀)': [116.4, 39.9],
    '华东 (江浙沪鲁)': [121.4, 31.2],
    '华南 (粤)': [113.2, 23.1],
    '西南 (川渝)': [104.0, 30.6],
    '华中 (鄂豫)': [114.3, 30.6],
    '其它地区': [95.0, 35.0]
  };

  const geoStats = currentDataset.reduce((acc, curr) => {
    const region = getGeoRegion(curr.location, activeTab === 'international');
    if (!acc[region]) {
      acc[region] = { name: region, count: 0, coordinates: REGION_COORDS[region] || [0, 0], totalLatency: 0, testedCount: 0 };
    }
    acc[region].count++;
    
    // Check if we have test result for this IP
    const testRes = testResults[curr.ip];
    if (testRes && testRes.status === 'success' && testRes.latency !== undefined) {
      acc[region].totalLatency += testRes.latency;
      acc[region].testedCount++;
    }

    return acc;
  }, {} as Record<string, { name: string, count: number, coordinates: [number, number], totalLatency: number, testedCount: number }>);

  const chartData = Object.values(geoStats).map(stat => ({
    ...stat,
    avgLatency: stat.testedCount > 0 ? Math.round(stat.totalLatency / stat.testedCount) : undefined
  })).sort((a, b) => b.count - a.count);
  
  const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

  const getHeatmapColor = (avgLatency?: number) => {
    if (avgLatency === undefined) return { fill: "rgba(148, 163, 184, 0.4)", stroke: "#64748b" }; // Default untested (slate)
    if (avgLatency < 50) return { fill: "rgba(16, 185, 129, 0.6)", stroke: "#059669" }; // Emerald Green
    if (avgLatency < 120) return { fill: "rgba(245, 158, 11, 0.6)", stroke: "#d97706" }; // Amber
    if (avgLatency < 250) return { fill: "rgba(239, 68, 68, 0.6)", stroke: "#dc2626" }; // Red
    return { fill: "rgba(153, 27, 27, 0.7)", stroke: "#991b1b" }; // Dark Red
  };

  // Filter handlers
  const uniqueOperators = ['All', ...Array.from(new Set(currentDataset.map(d => d.operator)))];

  const filteredDns = currentDataset.filter(item => {
    const matchesSearch = 
      item.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesOperator = selectedOperator === 'All' || item.operator === selectedOperator;
    return matchesSearch && matchesOperator;
  });

  // Handle Clipboard Copy with visual effect
  const handleCopy = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  // Run dual-mode backend DNS resolution + latency probe
  const testSingleDns = async (ip: string) => {
    // Determine domain depending on the DNS area
    const domainToQuery = activeTab === 'domestic' ? 'www.baidu.com' : 'www.google.com';
    
    setTestResults(prev => ({
      ...prev,
      [ip]: { status: 'testing' }
    }));

    try {
      const resp = await fetch(`/api/dns-test?server=${ip}&domain=${domainToQuery}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.alive) {
          setTestResults(prev => ({
            ...prev,
            [ip]: {
              status: 'success',
              latency: data.latency,
              addresses: data.addresses
            }
          }));
        } else {
          setTestResults(prev => ({
            ...prev,
            [ip]: {
              status: 'error',
              error: data.error || '解析异常'
            }
          }));
        }
      } else {
        setTestResults(prev => ({
          ...prev,
          [ip]: { status: 'error', error: 'HTTP error ' + resp.status }
        }));
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [ip]: { status: 'error', error: err.message }
      }));
    }
  };

  // Test all visible DNS records on page concurrently
  const handleBulkTest = async () => {
    if (filteredDns.length === 0) return;
    setIsBulkTesting(true);

    // Initial setting to 'testing'
    const updatedStatus: Record<string, any> = {};
    filteredDns.forEach(record => {
      updatedStatus[record.ip] = { status: 'testing' };
    });
    setTestResults(prev => ({ ...prev, ...updatedStatus }));

    // Concurrent fetch with Promise.all
    await Promise.all(
      filteredDns.map(async (record) => {
        await testSingleDns(record.ip);
      })
    );

    setIsBulkTesting(false);

    // Track test history
    const successCount = filteredDns.filter(r => testResults[r.ip]?.status === 'success' || r.ip).length; // approximate
    addHistory({
      toolId: 'dns-lookup',
      toolName: 'DNS公网地址探测',
      target: activeTab === 'domestic' ? '国内主要DNS集群' : '国际主要DNS集群',
      summary: `一键测速完成，共解析 ${filteredDns.length} 个服务器`
    });
  };

  // Export Directory data to Text File
  const handleExport = () => {
    let report = `=== DNS公网地址与解析性能诊断报告 ===\n` +
      `模块类别: ${activeTab === 'domestic' ? '国内省市/运营商 DNS 目录' : '海外公有云及全球多国 ISP DNS 目录'}\n` +
      `导出时间: ${new Date().toLocaleString()}\n\n` +
      `=== 数据库备份及测试结果 ===\n\n`;

    filteredDns.forEach((res, index) => {
      const state = testResults[res.ip];
      report += `[#${index + 1}] 运营商/归属: ${res.operator} | IP: ${res.ip}\n` +
        `  - 解析器名称: ${res.name}\n` +
        `  - 地理区域: ${res.location}\n` +
        `  - 解析描述: ${res.desc || '网络公有主力配置'}\n` +
        `  - 本次测试情况: ${
          !state 
            ? '尚未测试' 
            : state.status === 'testing' 
              ? '测试中...' 
              : state.status === 'success'
                ? `正常 [耗时: ${state.latency} ms | 解析地址: ${state.addresses ? state.addresses.join(', ') : '暂无'}]`
                : `异常 [错误原因: ${state.error}]`
        }\n` +
        `-----------------------------------------------\n`;
    });

    downloadReport(`DNS_Directory_${activeTab}`, report);
  };

  // Helper latency color styling
  const getLatencyStyle = (ms?: number) => {
    if (ms === undefined) return { badge: "bg-slate-100 text-slate-500", text: "text-slate-400" };
    if (ms < 40) return { badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-200/55", text: "text-emerald-600 font-bold" };
    if (ms < 100) return { badge: "bg-teal-500/10 text-teal-700 border border-teal-200/50", text: "text-teal-600" };
    if (ms < 250) return { badge: "bg-amber-500/10 text-amber-700 border border-amber-250/30", text: "text-amber-600" };
    return { badge: "bg-rose-500/10 text-rose-700 border border-rose-250", text: "text-rose-600 font-semibold" };
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-7 h-7 text-indigo-600 animate-pulse" />
            DNS公网地址 (Public DNS Directory)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
             快速查找及批量查询国内外核心网络、主要运营商/省份、多云主干公共 DNS 解析服务地址。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkTest}
            disabled={isBulkTesting || filteredDns.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-50 shadow-xs cursor-pointer active:scale-95 transition-all border-none"
          >
            {isBulkTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> 正在批量探测...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> 一键测速当前列表
              </>
            )}
          </button>
          <button 
            onClick={handleExport}
            disabled={filteredDns.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-[rgba(0,0,0,0.02)] border-none rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-all disabled:opacity-50 shadow-xs"
          >
            导出清单报告
          </button>
        </div>
      </div>

      {/* Main Tabs Selection */}
      <div className="flex bg-[rgba(0,0,0,0.02)] p-1 rounded-xl">
        <button
          onClick={() => {
            setActiveTab('domestic');
            setSelectedOperator('All');
            setSearchQuery('');
          }}
          className={cn(
            "flex-1 md:flex-initial px-8 py-2.5 text-[13px] font-[600] rounded-xl transition-all duration-150 flex items-center justify-center gap-2",
            activeTab === 'domestic'
              ? "bg-white text-slate-800 shadow-sm border border-[rgba(0,0,0,0.04)]"
              : "text-[#8E8E93] hover:text-slate-800 bg-transparent border-none"
          )}
        >
          <Compass className="w-4 h-4" /> 国内常用公网 DNS ({domesticDnsData.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('international');
            setSelectedOperator('All');
            setSearchQuery('');
          }}
          className={cn(
            "flex-1 md:flex-initial px-8 py-2.5 text-[13px] font-[600] rounded-xl transition-all duration-150 flex items-center justify-center gap-2",
            activeTab === 'international'
              ? "bg-white text-slate-800 shadow-sm border border-[rgba(0,0,0,0.04)]"
              : "text-[#8E8E93] hover:text-slate-800 bg-transparent border-none"
          )}
        >
          <Globe className="w-4 h-4" /> 国际/海外公网 DNS ({internationalDnsData.length})
        </button>
      </div>

      {/* Chart and Info Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 sub-card p-5 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-slate-700" />
              <h3 className="text-[13px] font-[600] text-slate-800">
                {activeTab === 'domestic' ? '国内主要节点地理分布热度' : '海外及公有云节点区域分布'}
              </h3>
            </div>
            <span className="text-[11px] font-[600] text-slate-500 bg-[rgba(0,0,0,0.02)] px-2.5 py-1 rounded-full">
              总计: {currentDataset.length} 个节点
            </span>
          </div>
          <div className="h-[240px] w-full bg-[rgba(0,0,0,0.02)] rounded-[8px] overflow-hidden border-none relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={
                activeTab === 'domestic' 
                  ? { scale: 420, center: [104, 37] } 
                  : { scale: 110, center: [0, 30] }
              }
              width={800}
              height={400}
              style={{ width: "100%", height: "100%" }}
            >
              <ZoomableGroup zoom={1} center={activeTab === 'domestic' ? [104, 37] : [0, 30]}>
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#cbd5e1"
                        stroke="#f8fafc"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "#94a3b8", outline: "none" },
                          pressed: { outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {chartData.map(({ name, coordinates, count, avgLatency }) => {
                  const radius = Math.max(8, Math.min(count * 2.5, 24));
                  const colors = getHeatmapColor(avgLatency);
                  return (
                    <Marker key={name} coordinates={coordinates}>
                      <circle 
                        r={radius} 
                        fill={colors.fill} 
                        stroke={colors.stroke} 
                        strokeWidth={2} 
                        className={avgLatency !== undefined ? "animate-pulse" : ""}
                        style={avgLatency !== undefined ? { animationDuration: '3s' } : {}}
                      />
                      <circle 
                        r={3} 
                        fill="#ffffff" 
                      />
                      <text
                        textAnchor="middle"
                        y={-(radius + 6)}
                        style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fill: "#1e293b", fontWeight: 700, pointerEvents: "none" }}
                      >
                        {name} ({count})
                      </text>
                      {avgLatency !== undefined && (
                        <text
                          textAnchor="middle"
                          y={radius + 12}
                          style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", fill: colors.stroke, fontWeight: 700, pointerEvents: "none" }}
                        >
                          {avgLatency}ms
                        </text>
                      )}
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>
          </div>
        </div>

        {/* Info Column */}
        <div className="lg:col-span-1 sub-card bg-[rgba(0,0,0,0.01)] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-5 h-5 text-slate-700" />
            <h3 className="text-[13px] font-[600] text-slate-800">DNS 解析与热力分布</h3>
          </div>
          <p className="text-[12px] text-[#8E8E93] leading-relaxed flex-1">
            本工具并非简单的 ICMP/Ping，我们采用高并发异步模型，在服务器端直接向 
            <span className="font-[600] bg-[rgba(0,0,0,0.04)] text-slate-700 px-1.5 mx-1 rounded whitespace-nowrap">
              {activeTab === 'domestic' ? 'www.baidu.com' : 'www.google.com'}
            </span>
            发起真实的第4类 (IPv4) UDP 报文解析请求。
          </p>
          
          <div className="mt-3 space-y-2 mb-1">
            <div className="text-[11px] font-[600] text-slate-500 uppercase tracking-wider mb-2">延迟热力图指示说明</div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="w-3 h-3 rounded-full bg-emerald-500/60 border border-emerald-600 block shrink-0"></span>
              <span>&lt; 50ms (极速响应)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="w-3 h-3 rounded-full bg-amber-500/60 border border-amber-600 block shrink-0"></span>
              <span>50 - 120ms (正常响应)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="w-3 h-3 rounded-full bg-red-500/60 border border-red-600 block shrink-0"></span>
              <span>&gt; 120ms (高延迟)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="w-3 h-3 rounded-full bg-slate-400/40 border border-slate-500 block shrink-0"></span>
              <span>尚未测试 (点击进行探测)</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[rgba(0,0,0,0.02)] rounded-[8px] border-none transition-all group">
            <p className="text-[11px] text-slate-600 leading-relaxed font-[500]">
              💡 这能极具参考性地展示您的服务器端环境至该 DNS 节点的物理响应与解析握手总耗时。
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters Segment */}
      <div className="sub-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索 DNS 服务商, IP 地址或热门省份国家..."
            className="w-full pl-10 pr-4 py-2 bg-[rgba(0,0,0,0.02)] border-none rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 placeholder:text-[#8E8E93] shadow-sm"
          />
        </div>

        {/* Categories Pill selection */}
        <div className="flex gap-1.5 flex-wrap w-full md:w-auto">
          {uniqueOperators.map(op => (
            <button
              key={op}
              onClick={() => setSelectedOperator(op)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-[600] rounded-[12px] transition-all cursor-pointer border-none",
                selectedOperator === op
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] text-slate-600"
              )}
            >
              {op === 'All' ? '全部类型' : op}
            </button>
          ))}
        </div>
      </div>

      {/* Grid or Table Listing */}
      <div className="sub-card overflow-hidden">
        {filteredDns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <AlertCircle className="w-10 h-10 text-[#8E8E93] mx-auto mb-3" />
            没有找到匹配条件的 DNS 记录，请更换关键字或选项重试。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EAEAEA] border-none text-slate-500 text-[11px] font-[600] uppercase tracking-wider">
                  <th className="px-6 py-4">服务商名称</th>
                  <th className="px-6 py-4">IP 地址</th>
                  <th className="px-6 py-4">地理位置 / 运营商</th>
                  <th className="px-6 py-4">性能测算 (服务端探测)</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.05)]">
                {filteredDns.map(dns => {
                  const state = testResults[dns.ip];
                  const latStyle = getLatencyStyle(state?.latency);
                  
                  return (
                    <tr key={dns.ip} className="hover:bg-[rgba(0,0,0,0.02)] transition-colors group">
                      {/* Name / Desc */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="space-y-0.5">
                          <span className="text-[13px] font-[600] text-slate-800">{dns.name}</span>
                          {dns.desc && (
                            <p className="text-[11px] text-[#8E8E93] leading-relaxed font-sans">{dns.desc}</p>
                          )}
                        </div>
                      </td>

                      {/* IP with quick Copy */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-[600] font-mono text-slate-700 bg-[rgba(0,0,0,0.04)] px-2.5 py-1 rounded-[6px] select-all">
                            {dns.ip}
                          </code>
                          <button
                            onClick={() => handleCopy(dns.ip)}
                            className="p-1 text-[#8E8E93] hover:text-slate-800 hover:bg-[rgba(0,0,0,0.05)] rounded-[6px] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 border-none"
                            title="复制 IP 地址"
                          >
                            {copiedIp === dns.ip ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Location / Tag */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-600 font-[500]">{dns.location}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-[4px] text-[10px] font-[600] font-sans border-none",
                            dns.operator === '电信' ? "bg-cyan-50 text-cyan-700" :
                            dns.operator === '联通' ? "bg-orange-50 text-orange-700" :
                            dns.operator === '移动' ? "bg-emerald-50 text-emerald-700" :
                            dns.operator === '海外' ? "bg-[rgba(0,0,0,0.04)] text-slate-700" :
                            dns.operator === '公共' ? "bg-indigo-50 text-indigo-700" :
                            "bg-[rgba(0,0,0,0.02)] text-slate-600"
                          )}>
                            {dns.operator}
                          </span>
                        </div>
                      </td>

                      {/* Real probe state info */}
                      <td className="px-6 py-4">
                        {!state ? (
                          <span className="text-[11px] text-[#8E8E93]">未探测</span>
                        ) : state.status === 'testing' ? (
                          <div className="flex items-center gap-2 text-slate-800 text-[11px] font-[600] animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            正在解构包...
                          </div>
                        ) : state.status === 'success' ? (
                          <div className="space-y-1">
                            <span className={cn("inline-block px-2 py-0.5 rounded-[12px] text-[11px] font-[600] font-mono border-none", latStyle.badge)}>
                              {state.latency} ms
                            </span>
                            {state.addresses && state.addresses.length > 0 && (
                              <p className="text-[9px] font-mono text-[#8E8E93] leading-tight block truncate max-w-[200px]" title={state.addresses.join(', ')}>
                                解析: {state.addresses[0]}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-rose-600 text-[11px] font-[500]" title={state.error}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>解析超时/不可达</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => testSingleDns(dns.ip)}
                          disabled={state?.status === 'testing'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-[600] bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] text-slate-700 rounded-[12px] transition-all disabled:opacity-50 cursor-pointer border-none"
                        >
                          <Play className="w-3 h-3 text-slate-700 fill-slate-700" />
                          <span>单点测速</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
