export interface ConfigTemplate {
  id: string;
  title: string;
  category: 'Cisco' | 'HuaWei' | 'H3C' | 'Forti' | 'Rocky' | 'Debug';
  desc: string;
  code: string;
  variables: { name: string; label: string; defaultValue: string; placeholder?: string }[];
  isCustom?: boolean;
}

export const TEMPLATE_CATEGORIES = ['All', 'Cisco', 'HuaWei', 'H3C', 'Forti', 'Rocky', 'Debug'];

export const DEFAULT_TEMPLATES: ConfigTemplate[] = [
  // ================= Cisco =================
  {
    id: 'cisco-port-vlan',
    title: '端口VLAN配置',
    category: 'Cisco',
    desc: '思科交换机接入端口VLAN划分及边缘端口(PortFast)最佳实践配置。',
    code: `interface {{INTERFACE}}
 description {{DESCRIPTION}}
 switchport mode access
 switchport access vlan {{VLAN_ID}}
 spanning-tree portfast
 spanning-tree bpduguard enable
 no shutdown`,
    variables: [
      { name: 'INTERFACE', label: '接口编号', defaultValue: 'GigabitEthernet1/0/1', placeholder: '例如: GigabitEthernet1/0/1' },
      { name: 'DESCRIPTION', label: '接口描述', defaultValue: 'Access_PC', placeholder: '业务描述' },
      { name: 'VLAN_ID', label: 'VLAN ID', defaultValue: '10', placeholder: '例如: 10' }
    ]
  },
  {
    id: 'cisco-routing',
    title: '路由配置',
    category: 'Cisco',
    desc: '思科三层设备静态路由基础最佳实践配置。',
    code: `ip routing
ip route {{DEST_NETWORK}} {{SUBNET_MASK}} {{NEXT_HOP_IP}} {{ADMIN_DISTANCE}}`,
    variables: [
      { name: 'DEST_NETWORK', label: '目的网段', defaultValue: '192.168.20.0', placeholder: '如: 192.168.20.0' },
      { name: 'SUBNET_MASK', label: '子网掩码', defaultValue: '255.255.255.0', placeholder: '如: 255.255.255.0' },
      { name: 'NEXT_HOP_IP', label: '下一跳 IP', defaultValue: '10.0.0.1', placeholder: '下一跳地址' },
      { name: 'ADMIN_DISTANCE', label: '管理距离(可选)', defaultValue: '1', placeholder: '如1, 浮动路由用更大值' }
    ]
  },
  {
    id: 'cisco-snmp',
    title: 'SNMP配置',
    category: 'Cisco',
    desc: '部署带源地址ACL安全访问限制的 SNMPv2c 监控服务策略。',
    code: `ip access-list standard SNMP_ACL
 permit {{NMS_IP}}
snmp-server community {{COMMUNITY_STRING}} RO SNMP_ACL
snmp-server location {{LOCATION}}
snmp-server contact {{CONTACT}}`,
    variables: [
      { name: 'NMS_IP', label: '网管运维机 IP', defaultValue: '10.10.10.100', placeholder: '如: 10.10.10.100' },
      { name: 'COMMUNITY_STRING', label: '团体名', defaultValue: 'public', placeholder: '如: public' },
      { name: 'LOCATION', label: '物理位置', defaultValue: 'DataCenter_Room1', placeholder: '位置描述' },
      { name: 'CONTACT', label: '管理员联系', defaultValue: 'admin@domain.com', placeholder: '邮箱或电话' }
    ]
  },
  {
    id: 'cisco-l3-gateway',
    title: '三层接口Gateway配置',
    category: 'Cisco',
    desc: '网络核心交换机SVI（VLAN虚拟接口）网关防ARP欺骗代理及基础优化。',
    code: `interface Vlan{{VLAN_ID}}
 description {{DESCRIPTION}}
 ip address {{IP_ADDRESS}} {{SUBNET_MASK}}
 no ip redirects
 no ip proxy-arp
 no shutdown`,
    variables: [
      { name: 'VLAN_ID', label: 'VLAN ID', defaultValue: '10', placeholder: '如: 10' },
      { name: 'DESCRIPTION', label: '网关描述', defaultValue: 'GW_For_Office', placeholder: '描述' },
      { name: 'IP_ADDRESS', label: '网关 IP', defaultValue: '192.168.10.254', placeholder: '如: 192.168.10.254' },
      { name: 'SUBNET_MASK', label: '子网掩码', defaultValue: '255.255.255.0', placeholder: '如: 255.255.255.0' }
    ]
  },
  {
    id: 'cisco-remote-management',
    title: '远程管理配置',
    category: 'Cisco',
    desc: '系统 SSH 无口令明文的安全远程访问权限配置最佳实践。',
    code: `ip domain-name {{DOMAIN_NAME}}
crypto key generate rsa modulus 2048
username {{ADMIN_USER}} privilege 15 secret {{ADMIN_PASSWORD}}
line vty 0 4
 transport input ssh
 login local
 exec-timeout 5 0`,
    variables: [
      { name: 'DOMAIN_NAME', label: '设备域名', defaultValue: 'corp.local', placeholder: '如: corp.local' },
      { name: 'ADMIN_USER', label: '管理员账户', defaultValue: 'admin', placeholder: '如: admin' },
      { name: 'ADMIN_PASSWORD', label: '安全密码', defaultValue: 'P@ssw0rd123!', placeholder: '高强密码' }
    ]
  },
  {
    id: 'cisco-port-security',
    title: '端口安全配置',
    category: 'Cisco',
    desc: '接入层设备防御 MAC 泛洪的安全粘性 MAC 最佳管理模式。',
    code: `interface {{INTERFACE}}
 switchport port-security
 switchport port-security maximum {{MAX_MAC}}
 switchport port-security violation restrict
 switchport port-security mac-address sticky`,
    variables: [
      { name: 'INTERFACE', label: '限制接入接口', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' },
      { name: 'MAX_MAC', label: '最大 MAC 数量', defaultValue: '2', placeholder: '限制学习到的最大数量，如: 2' }
    ]
  },
  {
    id: 'cisco-port-mirror',
    title: '端口镜像配置',
    category: 'Cisco',
    desc: '思科交换机核心/汇聚层端口镜像SPAN配置，用于监控分析网络流量。',
    code: `monitor session {{SESSION_ID}} source interface {{SRC_IF}} both
monitor session {{SESSION_ID}} destination interface {{DST_IF}}`,
    variables: [
      { name: 'SESSION_ID', label: '会话ID', defaultValue: '1', placeholder: '如: 1' },
      { name: 'SRC_IF', label: '被监控源接口', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' },
      { name: 'DST_IF', label: '抓包设备目的接口', defaultValue: 'GigabitEthernet1/0/24', placeholder: '如: GigabitEthernet1/0/24' }
    ]
  },
  {
    id: 'cisco-netflow',
    title: 'NetFlow配置',
    category: 'Cisco',
    desc: '思科设备NetFlow特性配置，采集流量统计发送至NetFlow分析器。',
    code: `flow record {{RECORD_NAME}}
 match ipv4 source address
 match ipv4 destination address
 match ipv4 protocol
 match transport source-port
 match transport destination-port
 collect counter bytes long
 collect counter packets long
!
flow exporter {{EXPORTER_NAME}}
 destination {{SERVER_IP}}
 source {{SOURCE_IF}}
 transport udp {{PORT}}
!
flow monitor {{MONITOR_NAME}}
 exporter {{EXPORTER_NAME}}
 record {{RECORD_NAME}}
!
interface {{INTERFACE}}
 ip flow monitor {{MONITOR_NAME}} input
 ip flow monitor {{MONITOR_NAME}} output`,
    variables: [
      { name: 'RECORD_NAME', label: '流量记录名称', defaultValue: 'REC-1', placeholder: '如: REC-1' },
      { name: 'EXPORTER_NAME', label: '输出器名称', defaultValue: 'EXP-SERVER', placeholder: '如: EXP-SERVER' },
      { name: 'SERVER_IP', label: 'NetFlow服务器IP', defaultValue: '10.0.0.100', placeholder: '如: 10.0.0.100' },
      { name: 'SOURCE_IF', label: '发送数据的源接口', defaultValue: 'Vlan1', placeholder: '如: Vlan1' },
      { name: 'PORT', label: '发送UDP端口', defaultValue: '2055', placeholder: '如: 2055' },
      { name: 'MONITOR_NAME', label: '监控视图名称', defaultValue: 'MON-1', placeholder: '如: MON-1' },
      { name: 'INTERFACE', label: '应用此策略的接口', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' }
    ]
  },

  // ================= HuaWei =================
  {
    id: 'huawei-port-vlan',
    title: '端口VLAN配置',
    category: 'HuaWei',
    desc: '华为交换机基础 Access 接入端口及快速边缘状态设置最佳实践。',
    code: `interface {{INTERFACE}}
 description {{DESCRIPTION}}
 port link-type access
 port default vlan {{VLAN_ID}}
 stp edged-port enable`,
    variables: [
      { name: 'INTERFACE', label: '接口名称', defaultValue: 'GigabitEthernet0/0/1', placeholder: '如: GigabitEthernet0/0/1' },
      { name: 'DESCRIPTION', label: '接口描述', defaultValue: 'To_User_PC', placeholder: '业务描述' },
      { name: 'VLAN_ID', label: '划入 VLAN', defaultValue: '10', placeholder: '如: 10' }
    ]
  },
  {
    id: 'huawei-routing',
    title: '路由配置',
    category: 'HuaWei',
    desc: '为华为路由器和三层交换机配置静态路由项，含文字标注。',
    code: `ip route-static {{DEST_NETWORK}} {{SUBNET_MASK}} {{NEXT_HOP_IP}} description {{DESCRIPTION}}`,
    variables: [
      { name: 'DEST_NETWORK', label: '目标网络 IP', defaultValue: '10.0.0.0', placeholder: '如: 10.0.0.0' },
      { name: 'SUBNET_MASK', label: '掩码全称/前缀长', defaultValue: '24', placeholder: '如: 24 或 255.255.255.0' },
      { name: 'NEXT_HOP_IP', label: '路由下一跳', defaultValue: '192.168.1.1', placeholder: '下一跳 IP' },
      { name: 'DESCRIPTION', label: '路由说明', defaultValue: 'To_Core', placeholder: '目的备注' }
    ]
  },
  {
    id: 'huawei-snmp',
    title: 'SNMP配置',
    category: 'HuaWei',
    desc: '华为自带 ACL 隔离绑定的只读安全 SNMPv2c 监控设置。',
    code: `acl number 2000
 rule 5 permit source {{NMS_IP}} 0
snmp-agent
snmp-agent local-engineid {{ENGINE_ID}}
snmp-agent community read cipher {{COMMUNITY_STRING}} mib-view iso-view acl 2000
snmp-agent sys-info version v2c v3
snmp-agent sys-info contact {{CONTACT}}
snmp-agent sys-info location {{LOCATION}}`,
    variables: [
      { name: 'NMS_IP', label: '允许的轮询系统 IP', defaultValue: '10.10.10.100', placeholder: '填入监控服务器 IP' },
      { name: 'ENGINE_ID', label: '引擎 ID (可选十六进制)', defaultValue: '800007db03xxxxxxxx', placeholder: '如: 800007db03xxxxxxxx' },
      { name: 'COMMUNITY_STRING', label: '监控只读团体名', defaultValue: 'public', placeholder: '如: public' },
      { name: 'CONTACT', label: '联系人', defaultValue: 'admin@corp.com', placeholder: '联系方式' },
      { name: 'LOCATION', label: '物理方位', defaultValue: 'ServerRoom', placeholder: '说明' }
    ]
  },
  {
    id: 'huawei-l3-gateway',
    title: '三层接口Gateway配置',
    category: 'HuaWei',
    desc: '局域网 Vlanif 接口的基础网关配置及双向业务隔离最佳环境。',
    code: `interface Vlanif{{VLAN_ID}}
 description {{DESCRIPTION}}
 ip address {{IP_ADDRESS}} {{SUBNET_MASK}}`,
    variables: [
      { name: 'VLAN_ID', label: '接口编号 (VLAN)', defaultValue: '10', placeholder: '如: 10' },
      { name: 'DESCRIPTION', label: '描述', defaultValue: 'Network_Gateway', placeholder: '说明' },
      { name: 'IP_ADDRESS', label: '分配网络 IP', defaultValue: '192.168.10.254', placeholder: '网关物理IP' },
      { name: 'SUBNET_MASK', label: '子网掩码', defaultValue: '255.255.255.0', placeholder: '如: 255.255.255.0 或 24' }
    ]
  },
  {
    id: 'huawei-remote-management',
    title: '远程管理配置',
    category: 'HuaWei',
    desc: '基于 AAA 管理授权的 SSH v2 服务强登录堡垒通道配置。',
    code: `rsa local-key-pair create
user-interface vty 0 4
 authentication-mode aaa
 protocol inbound ssh
 idle-timeout 5 0
aaa
 local-user {{ADMIN_USER}} password irreversible-cipher {{ADMIN_PASSWORD}}
 local-user {{ADMIN_USER}} privilege level 15
 local-user {{ADMIN_USER}} service-type ssh`,
    variables: [
      { name: 'ADMIN_USER', label: '管理账户', defaultValue: 'admin', placeholder: '账号' },
      { name: 'ADMIN_PASSWORD', label: '认证密码', defaultValue: 'HuaWei@Sec123!', placeholder: '不可逆密文保存密码' }
    ]
  },
  {
    id: 'huawei-port-security',
    title: '端口安全配置',
    category: 'HuaWei',
    desc: '局域网保护终端被不安全设备顶替或广播包溢出的硬件接口防护。',
    code: `interface {{INTERFACE}}
 port-security enable
 port-security max-mac-num {{MAX_MAC}}
 port-security protect-action restrict
 port-security mac-address sticky`,
    variables: [
      { name: 'INTERFACE', label: '目标下行接口', defaultValue: 'GigabitEthernet0/0/1', placeholder: '如: GigabitEthernet0/0/1' },
      { name: 'MAX_MAC', label: '允许最大网卡数', defaultValue: '1', placeholder: '防泛洪数量，如: 1 或 2' }
    ]
  },
  {
    id: 'huawei-port-mirror',
    title: '端口镜像配置',
    category: 'HuaWei',
    desc: '华为交换机本地端口镜像(SPAN)配置。',
    code: `observe-port {{OBSERVE_INDEX}} interface {{DST_IF}}
interface {{SRC_IF}}
 port-mirroring to observe-port {{OBSERVE_INDEX}} {{DIRECTION}}`,
    variables: [
      { name: 'OBSERVE_INDEX', label: '观察端口索引', defaultValue: '1', placeholder: '如: 1' },
      { name: 'DST_IF', label: '目的观察接口', defaultValue: 'GigabitEthernet0/0/24', placeholder: '如: GigabitEthernet0/0/24' },
      { name: 'SRC_IF', label: '源镜像接口', defaultValue: 'GigabitEthernet0/0/1', placeholder: '如: GigabitEthernet0/0/1' },
      { name: 'DIRECTION', label: '镜像方向', defaultValue: 'both', placeholder: 'inbound, outbound 或 both' }
    ]
  },
  {
    id: 'huawei-sflow',
    title: 'sFlow配置',
    category: 'HuaWei',
    desc: '华为交换机下发sFlow采样分析网络流量统计。',
    code: `sflow agent ip {{AGENT_IP}}
sflow collector {{COLLECTOR_ID}} ip {{SERVER_IP}} datagram-size 1400
interface {{INTERFACE}}
 sflow collector {{COLLECTOR_ID}}
 sflow sampling rate {{SAMPLE_RATE}}
 sflow counter interval {{COUNTER_INTERVAL}}`,
    variables: [
      { name: 'AGENT_IP', label: '设备代理IP', defaultValue: '192.168.1.1', placeholder: '如: 192.168.1.1' },
      { name: 'COLLECTOR_ID', label: '采集器ID', defaultValue: '1', placeholder: '如: 1' },
      { name: 'SERVER_IP', label: 'sFlow服务器IP', defaultValue: '10.0.0.100', placeholder: '如: 10.0.0.100' },
      { name: 'INTERFACE', label: '被采样接口', defaultValue: 'GigabitEthernet0/0/1', placeholder: '如: GigabitEthernet0/0/1' },
      { name: 'SAMPLE_RATE', label: '采样比率', defaultValue: '4096', placeholder: '如: 4096' },
      { name: 'COUNTER_INTERVAL', label: '统计信息上报周期(s)', defaultValue: '60', placeholder: '通常: 60' }
    ]
  },

  // ================= H3C =================
  {
    id: 'h3c-port-vlan',
    title: '端口VLAN配置',
    category: 'H3C',
    desc: 'H3C (新华三) 二层端口 Access VLAN 配置与生成树端口收敛防抖。',
    code: `interface {{INTERFACE}}
 description {{DESCRIPTION}}
 port link-type access
 port access vlan {{VLAN_ID}}
 stp edged-port`,
    variables: [
      { name: 'INTERFACE', label: '终端接口名称', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' },
      { name: 'DESCRIPTION', label: '业务指引', defaultValue: 'Connect_to_PC', placeholder: '描述' },
      { name: 'VLAN_ID', label: '透传 VLAN ID', defaultValue: '20', placeholder: '如: 20' }
    ]
  },
  {
    id: 'h3c-routing',
    title: '路由配置',
    category: 'H3C',
    desc: 'IPv4 单播静态路由添加。',
    code: `ip route-static {{DEST_NETWORK}} {{SUBNET_MASK}} {{NEXT_HOP_IP}} description {{DESCRIPTION}}`,
    variables: [
      { name: 'DEST_NETWORK', label: '目的网络', defaultValue: '10.10.0.0', placeholder: '如: 10.10.0.0' },
      { name: 'SUBNET_MASK', label: '子网掩码', defaultValue: '24', placeholder: '如: 24 或 255.255.255.0' },
      { name: 'NEXT_HOP_IP', label: '下一跳 IP', defaultValue: '192.168.1.254', placeholder: '如: 192.168.1.254' },
      { name: 'DESCRIPTION', label: '路由描述', defaultValue: 'Route_to_DMZ', placeholder: '便于溯源' }
    ]
  },
  {
    id: 'h3c-snmp',
    title: 'SNMP配置',
    category: 'H3C',
    desc: '结合 Basic ACL 防御的 H3C SNMP Agent 信息采集设定。',
    code: `acl basic 2000
 rule 0 permit source {{NMS_IP}} 0
snmp-agent
snmp-agent community read simple {{COMMUNITY_STRING}} acl 2000
snmp-agent sys-info version v2c v3
snmp-agent sys-info contact {{CONTACT}}
snmp-agent sys-info location {{LOCATION}}`,
    variables: [
      { name: 'NMS_IP', label: '安全来源 IP', defaultValue: '10.1.1.10', placeholder: '允许监控的 IP' },
      { name: 'COMMUNITY_STRING', label: '团体口令', defaultValue: 'public', placeholder: '只读密码' },
      { name: 'CONTACT', label: '联系人信息', defaultValue: 'admin', placeholder: '信息' },
      { name: 'LOCATION', label: '物理设备地点', defaultValue: 'CoreRoom', placeholder: '信息' }
    ]
  },
  {
    id: 'h3c-l3-gateway',
    title: '三层接口Gateway配置',
    category: 'H3C',
    desc: '构建基于 Vlan-interface 面板的 H3C 三层汇聚业务主网关地址。',
    code: `interface Vlan-interface{{VLAN_ID}}
 description {{DESCRIPTION}}
 ip address {{IP_ADDRESS}} {{SUBNET_MASK}}`,
    variables: [
      { name: 'VLAN_ID', label: 'VLAN 路由接口', defaultValue: '20', placeholder: '如: 20' },
      { name: 'DESCRIPTION', label: '应用描述', defaultValue: 'Gateway_VLAN20', placeholder: '如: Gateway_VLAN20' },
      { name: 'IP_ADDRESS', label: '接口静态 IP', defaultValue: '192.168.20.1', placeholder: '如: 192.168.20.1' },
      { name: 'SUBNET_MASK', label: '子网掩码', defaultValue: '255.255.255.0', placeholder: '如: 255.255.255.0' }
    ]
  },
  {
    id: 'h3c-remote-management',
    title: '远程管理配置',
    category: 'H3C',
    desc: 'H3C 设备限制 Telnet 启用 RSA 及 Scheme Role 配置的安全 SSH。',
    code: `public-key local create rsa
line vty 0 4
 authentication-mode scheme
 protocol inbound ssh
 idle-timeout 5 0
local-user {{ADMIN_USER}} class manage
 password hash {{ADMIN_PASSWORD}}
 service-type ssh
 authorization-attribute user-role network-admin`,
    variables: [
      { name: 'ADMIN_USER', label: '管理员', defaultValue: 'h3cadmin', placeholder: '如: h3cadmin' },
      { name: 'ADMIN_PASSWORD', label: '密文密码', defaultValue: 'H3c@Secure!', placeholder: '如: H3c@Secure!' }
    ]
  },
  {
    id: 'h3c-port-security',
    title: '端口安全配置',
    category: 'H3C',
    desc: '启用 H3C 特征端口拦截防 MAC 溢出并保存静默锁定。',
    code: `interface {{INTERFACE}}
 port-security enable
 port-security max-mac-count {{MAX_MAC}}
 port-security intrusion-mode blockmac
 port-security mac-address security sticky`,
    variables: [
      { name: 'INTERFACE', label: '接入交换接口', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' },
      { name: 'MAX_MAC', label: '接口许可的MAC个数', defaultValue: '2', placeholder: '如: 2' }
    ]
  },
  {
    id: 'h3c-port-mirror',
    title: '端口镜像配置',
    category: 'H3C',
    desc: '新华三交换机本地端口镜像配置。',
    code: `mirroring-group {{GROUP_ID}} local
mirroring-group {{GROUP_ID}} mirroring-port {{SRC_IF}} {{DIRECTION}}
mirroring-group {{GROUP_ID}} monitor-port {{DST_IF}}`,
    variables: [
      { name: 'GROUP_ID', label: '镜像组编号', defaultValue: '1', placeholder: '如: 1' },
      { name: 'SRC_IF', label: '源镜像端口', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' },
      { name: 'DIRECTION', label: '流量方向', defaultValue: 'both', placeholder: 'inbound, outbound 或 both' },
      { name: 'DST_IF', label: '目的观测端口', defaultValue: 'GigabitEthernet1/0/24', placeholder: '如: GigabitEthernet1/0/24' }
    ]
  },
  {
    id: 'h3c-sflow',
    title: 'sFlow配置',
    category: 'H3C',
    desc: '新华三设备sFlow流量分析功能配置。',
    code: `sflow agent ip {{AGENT_IP}}
sflow collector {{COLLECTOR_ID}} ip {{SERVER_IP}} description "{{DESC}}"
interface {{INTERFACE}}
 sflow flow collector {{COLLECTOR_ID}}
 sflow sampling-rate {{SAMPLE_RATE}}
 sflow counter collector {{COLLECTOR_ID}}
 sflow counter interval {{COUNTER_INTERVAL}}`,
    variables: [
      { name: 'AGENT_IP', label: 'Agent侧地址', defaultValue: '192.168.1.1', placeholder: '如: 192.168.1.1' },
      { name: 'COLLECTOR_ID', label: 'Collector ID', defaultValue: '1', placeholder: '如: 1' },
      { name: 'SERVER_IP', label: '服务器IP', defaultValue: '10.0.0.100', placeholder: '如: 10.0.0.100' },
      { name: 'DESC', label: '采集器描述', defaultValue: 'sflow-server', placeholder: '如: sflow-server' },
      { name: 'INTERFACE', label: '采样接口', defaultValue: 'GigabitEthernet1/0/1', placeholder: '如: GigabitEthernet1/0/1' },
      { name: 'SAMPLE_RATE', label: '采样率', defaultValue: '4000', placeholder: '如: 4000' },
      { name: 'COUNTER_INTERVAL', label: '计数周期(s)', defaultValue: '60', placeholder: '如: 60' }
    ]
  },

  // ================= Forti =================
  {
    id: 'forti-port-vlan',
    title: '端口VLAN配置',
    category: 'Forti',
    desc: '在飞塔物理端口上创建关联 LAN 角色的子网逻辑 VLAN 接口。',
    code: `config system interface
    edit "{{VLAN_NAME}}"
        set vdom "root"
        set interface "{{PHYSICAL_PORT}}"
        set vlanid {{VLAN_ID}}
        set role lan
    next
end`,
    variables: [
      { name: 'VLAN_NAME', label: '逻辑接口名', defaultValue: 'VLAN_10_Office', placeholder: '易读标签' },
      { name: 'PHYSICAL_PORT', label: '绑定物理母口', defaultValue: 'internal1', placeholder: '如: internal1, port2' },
      { name: 'VLAN_ID', label: 'Tag ID', defaultValue: '10', placeholder: '通信 VLAN 编号' }
    ]
  },
  {
    id: 'forti-routing',
    title: '路由配置',
    category: 'Forti',
    desc: '系统静态路由项与下一跳及指定送出防火墙接口。',
    code: `config router static
    edit 0
        set dst {{DEST_NETWORK}} {{SUBNET_MASK}}
        set gateway {{NEXT_HOP_IP}}
        set device "{{OUT_INTERFACE}}"
        set comment "{{DESCRIPTION}}"
    next
end`,
    variables: [
      { name: 'DEST_NETWORK', label: '目标网络段', defaultValue: '10.0.0.0', placeholder: '如: 10.0.0.0 或 0.0.0.0' },
      { name: 'SUBNET_MASK', label: '子网掩码', defaultValue: '255.0.0.0', placeholder: '如: 255.0.0.0 或 0.0.0.0' },
      { name: 'NEXT_HOP_IP', label: '网关下一跳', defaultValue: '192.168.1.1', placeholder: '前置网络路由IP' },
      { name: 'OUT_INTERFACE', label: '发送出接口', defaultValue: 'wan1', placeholder: '如: wan1, port1' },
      { name: 'DESCRIPTION', label: '备注', defaultValue: 'To_Public_or_Branch', placeholder: '说明' }
    ]
  },
  {
    id: 'forti-snmp',
    title: 'SNMP配置',
    category: 'Forti',
    desc: '防火墙系统管理 SNMP 主机记录与团体名信任主机白名单。',
    code: `config system snmp sysinfo
    set description "{{DESCRIPTION}}"
    set contact-info "{{CONTACT}}"
    set location "{{LOCATION}}"
end
config system snmp community
    edit 1
        set name "{{COMMUNITY_STRING}}"
        config hosts
            edit 1
                set ip {{NMS_IP}} 255.255.255.255
            next
        end
    next
end`,
    variables: [
      { name: 'DESCRIPTION', label: '设备识别名', defaultValue: 'FortiGate_Edge', placeholder: '识别名' },
      { name: 'CONTACT', label: '技术联络人', defaultValue: 'netsec@corp.com', placeholder: '联络人' },
      { name: 'LOCATION', label: '安置位置', defaultValue: 'Headquarter', placeholder: '位置' },
      { name: 'COMMUNITY_STRING', label: '团体名明文', defaultValue: 'public', placeholder: '社区名' },
      { name: 'NMS_IP', label: '监控可信源 IP', defaultValue: '10.10.10.100', placeholder: '限定被访问源 IP' }
    ]
  },
  {
    id: 'forti-l3-gateway',
    title: '三层接口Gateway配置',
    category: 'Forti',
    desc: '构建基于物理 LAN 口的基础内外网接口并允许 PING 管理连通性。',
    code: `config system interface
    edit "{{PORT_NAME}}"
        set vdom "root"
        set ip {{IP_ADDRESS}} {{SUBNET_MASK}}
        set allowaccess ping
        set type physical
        set role lan
        set description "{{DESCRIPTION}}"
    next
end`,
    variables: [
      { name: 'PORT_NAME', label: '三层网关口/物理口', defaultValue: 'port2', placeholder: '如: port2, internal2' },
      { name: 'IP_ADDRESS', label: '本机承担的网关 IP', defaultValue: '192.168.10.254', placeholder: '如: 192.168.10.254' },
      { name: 'SUBNET_MASK', label: '网段掩码', defaultValue: '255.255.255.0', placeholder: '如: 255.255.255.0' },
      { name: 'DESCRIPTION', label: '中文/英文说明', defaultValue: 'LAN_Gateway', placeholder: '业务提示' }
    ]
  },
  {
    id: 'forti-remote-management',
    title: '远程管理配置',
    category: 'Forti',
    desc: '向系统添加超级管理员用户组用户并指定特定管理口开放 HTTPS 及 SSH。',
    code: `config system admin
    edit "{{ADMIN_USER}}"
        set password "{{ADMIN_PASSWORD}}"
        set accprofile "super_admin"
        set vdom "root"
    next
end
config system interface
    edit "{{MGMT_PORT}}"
        set allowaccess ping https ssh
    next
end`,
    variables: [
      { name: 'ADMIN_USER', label: '超级管理账户名', defaultValue: 'secadmin', placeholder: '新建管理账号' },
      { name: 'ADMIN_PASSWORD', label: '平台管理密码', defaultValue: 'Sec@Forti#999', placeholder: '不可猜测长度密码' },
      { name: 'MGMT_PORT', label: '授权内网管理入口', defaultValue: 'port1', placeholder: '如: mgmt, port1' }
    ]
  },
  {
    id: 'forti-port-security',
    title: '端口安全配置',
    category: 'Forti',
    desc: '使用物理层的 Switch-controller MAC 过滤授权阻止未认证硬件。',
    code: `config system interface
    edit "{{PORT_NAME}}"
        set switch-controller-mac-sync-interval 60
        set macaddr-acl enable
    next
end`,
    variables: [
      { name: 'PORT_NAME', label: '要锁定监控的下行物理接口', defaultValue: 'port3', placeholder: '如: port3' }
    ]
  },
  {
    id: 'forti-port-mirror',
    title: '端口镜像配置',
    category: 'Forti',
    desc: 'FortiGate 防火墙通过软交换完成 SPAN 端口报文投递与镜像分析。',
    code: `config system virtual-switch
    edit "{{VSWITCH}}"
        set physical-switch "sw0"
        config port
            edit "{{SRC_PORT}}"
            next
            edit "{{DST_PORT}}"
            next
        end
        set span enable
        set span-source-port "{{SRC_PORT}}"
        set span-dest-port "{{DST_PORT}}"
        set span-direction {{DIRECTION}}
    next
end`,
    variables: [
      { name: 'VSWITCH', label: '虚拟交换名字', defaultValue: 'span-sw', placeholder: '如: span-sw' },
      { name: 'SRC_PORT', label: '被分析源接口', defaultValue: 'port2', placeholder: '如: port2' },
      { name: 'DST_PORT', label: '接分析仪的目的接口', defaultValue: 'port3', placeholder: '如: port3' },
      { name: 'DIRECTION', label: '监听方向', defaultValue: 'both', placeholder: 'rx, tx 或 both' }
    ]
  },
  {
    id: 'forti-sflow',
    title: 'sFlow/NetFlow配置',
    category: 'Forti',
    desc: 'FortiGate全局及接口层级sFlow流量监控导出设置。',
    code: `config system sflow
    set collector-ip {{SERVER_IP}}
    set collector-port {{SERVER_PORT}}
    set source-ip {{AGENT_IP}}
end
config system interface
    edit "{{INTERFACE}}"
        set sflow-sampler enable
        set sample-rate {{SAMPLE_RATE}}
        set sample-direction {{DIRECTION}}
        set polling-interval {{POLL_INTERVAL}}
    next
end`,
    variables: [
      { name: 'SERVER_IP', label: '服务器IP', defaultValue: '10.0.0.100', placeholder: '如: 10.0.0.100' },
      { name: 'SERVER_PORT', label: '服务端口', defaultValue: '6343', placeholder: '如: 6343' },
      { name: 'AGENT_IP', label: 'Agent IP地址', defaultValue: '192.168.1.254', placeholder: '如: 192.168.1.254' },
      { name: 'INTERFACE', label: '取样监控接口', defaultValue: 'port1', placeholder: '如: port1' },
      { name: 'SAMPLE_RATE', label: '取样率', defaultValue: '2000', placeholder: '每多少包采1个' },
      { name: 'DIRECTION', label: '采样方向', defaultValue: 'both', placeholder: 'rx, tx, both' },
      { name: 'POLL_INTERVAL', label: '轮询间隔(s)', defaultValue: '60', placeholder: '如: 60' }
    ]
  },

  // ================= Rocky =================
  {
    id: 'rocky-network-interface',
    title: '网络接口配置',
    category: 'Rocky',
    desc: 'Rocky Linux/RHEL 使用 NetworkManager nmcli 命令完成网卡的无缝调整。',
    code: `# 显示所有连接
nmcli connection show

# 修改或创建接口配置
nmcli connection modify "{{IF_NAME}}" ipv4.addresses "{{IP_ADDRESS}}/{{PREFIX}}"
nmcli connection modify "{{IF_NAME}}" ipv4.gateway "{{GATEWAY}}"
nmcli connection modify "{{IF_NAME}}" ipv4.dns "{{DNS_SERVER}}"
nmcli connection modify "{{IF_NAME}}" ipv4.method "manual"
nmcli connection modify "{{IF_NAME}}" connection.autoconnect yes

# 重启接口使配置生效
nmcli connection down "{{IF_NAME}}" && nmcli connection up "{{IF_NAME}}"`,
    variables: [
      { name: 'IF_NAME', label: '主机网卡连接名', defaultValue: 'eth0', placeholder: '如: eth0, ens33' },
      { name: 'IP_ADDRESS', label: '分配或替换的新 IP', defaultValue: '192.168.1.150', placeholder: '如: 192.168.1.150' },
      { name: 'PREFIX', label: '子网前缀长', defaultValue: '24', placeholder: '如: 24, 16' },
      { name: 'GATEWAY', label: '网络出口网关', defaultValue: '192.168.1.1', placeholder: '如: 192.168.1.1' },
      { name: 'DNS_SERVER', label: '主要解析 DNS', defaultValue: '8.8.8.8', placeholder: '如: 8.8.8.8或223.5.5.5' }
    ]
  },
  {
    id: 'rocky-routing',
    title: '网络路由配置',
    category: 'Rocky',
    desc: 'Rocky OS 两种常用配置明细机制：原生 IP 临时路由 和 守护服务持久化。',
    code: `# [方式一] 临时添加路由 (重启后失效，用于马上测试)
ip route add {{DEST_NETWORK}}/{{PREFIX}} via {{NEXT_HOP_IP}} dev {{IF_NAME}}

# [方式二] 永久添加路由并挂载在指定设备配置中 (使用 nmcli)
nmcli connection modify "{{IF_NAME}}" +ipv4.routes "{{DEST_NETWORK}}/{{PREFIX}} {{NEXT_HOP_IP}}"
nmcli connection up "{{IF_NAME}}"

# 查看本机当前的最终路由查找表
ip route show`,
    variables: [
      { name: 'DEST_NETWORK', label: '目标通信网段', defaultValue: '10.50.0.0', placeholder: '如: 10.50.0.0' },
      { name: 'PREFIX', label: '网段掩码前缀', defaultValue: '16', placeholder: '如: 16 或 24' },
      { name: 'NEXT_HOP_IP', label: '必经的下一跳地址', defaultValue: '192.168.1.254', placeholder: '如: 192.168.1.254' },
      { name: 'IF_NAME', label: '本机关联的流出网卡', defaultValue: 'eth0', placeholder: '如: eth0' }
    ]
  },
  {
    id: 'rocky-iptables',
    title: 'IPtables四种链的常用配置',
    category: 'Rocky',
    desc: 'Linux 原生防火墙核心处理管线: DNAT、主机进站过滤、内网转发、及外网上网源地址转换 MASQUERADE。',
    code: `# 1. PREROUTING 链：目标地址转换 (DNAT) - 用于将外部端口映射到内部服务器
iptables -t nat -A PREROUTING -p tcp --dport {{EXTERNAL_PORT}} -j DNAT --to-destination {{INTERNAL_IP}}:{{INTERNAL_PORT}}

# 2. INPUT 链：保护本机安全 - 允许特定 IP 访问特定端口，其余默认丢弃（防外网直接扫描）
iptables -A INPUT -p tcp --dport {{LOCAL_PORT}} -s {{TRUSTED_IP}} -j ACCEPT
iptables -A INPUT -p tcp --dport {{LOCAL_PORT}} -j DROP

# 3. FORWARD 链：控制网段互访 - 允许特定信任源内部网段穿过网关系统互访
iptables -A FORWARD -s {{SOURCE_NETWORK}} -d {{DEST_NETWORK}} -j ACCEPT
iptables -A FORWARD -s {{SOURCE_NETWORK}} -j REJECT

# 4. POSTROUTING 链：源地址转换 (SNAT/MASQUERADE) - 用于内网通过网关上的出口 IP 上互联网
iptables -t nat -A POSTROUTING -s {{SOURCE_NETWORK}} -o {{OUTGOING_IF}} -j MASQUERADE`,
    variables: [
      { name: 'EXTERNAL_PORT', label: '映射暴露给公网的外挂端口', defaultValue: '8080', placeholder: '如: 8080' },
      { name: 'INTERNAL_IP', label: '内网应用真实 IP', defaultValue: '10.0.0.5', placeholder: '如: 10.0.0.5' },
      { name: 'INTERNAL_PORT', label: '内网应用侦听端口', defaultValue: '80', placeholder: '如: 80' },
      { name: 'LOCAL_PORT', label: '本机需要被保护管理的端口', defaultValue: '22', placeholder: '如: 22 (SSH)' },
      { name: 'TRUSTED_IP', label: '信任的来访者 IP/网段', defaultValue: '192.168.1.100', placeholder: '如: 192.168.1.100' },
      { name: 'SOURCE_NETWORK', label: '来源发起连接内网群', defaultValue: '10.0.0.0/24', placeholder: '如: 10.0.0.0/24' },
      { name: 'DEST_NETWORK', label: '被隔离访问的目的群', defaultValue: '172.16.0.0/16', placeholder: '如: 172.16.0.0/16' },
      { name: 'OUTGOING_IF', label: '连接公网互联网出口的网卡', defaultValue: 'eth1', placeholder: '如: eth1 或 ppp0' }
    ]
  },

  // ================= Debug =================
  {
    id: 'debug-tcpdump',
    title: 'tcpdump 抓包模板',
    category: 'Debug',
    desc: 'Linux系统常见抓包过滤并将其输出保存为pcap文件用于Wireshark分析。',
    code: `tcpdump -i {{INTERFACE}} {{FILTER}} -nn -vvv -w {{OUTPUT_FILE}}`,
    variables: [
      { name: 'INTERFACE', label: '网卡接口', defaultValue: 'any', placeholder: '如: any, eth0' },
      { name: 'FILTER', label: '抓包过滤条件', defaultValue: 'host 10.0.0.1 and port 80', placeholder: '如: host 1.1.1.1 and tcp port 80' },
      { name: 'OUTPUT_FILE', label: '导出文件名', defaultValue: '/tmp/capture.pcap', placeholder: '如: /tmp/capture.pcap' }
    ]
  },
  {
    id: 'debug-sniffer',
    title: 'dumptcp/抓包模板 (Forti/H3C/HuaWei)',
    category: 'Debug',
    desc: '硬件防火墙或网络设备上通过命令行直接捕获数据包的高级命令。',
    code: `# FortiGate 抓包并显示详细十六进制层级报文
diagnose sniffer packet {{FW_INTERFACE}} '{{FW_FILTER}}' 6 {{COUNT}} a
    
# 华为/H3C 基于丢包/流镜像定位 (流安全策略)
display acl all
capture-packet interface {{SW_INTERFACE}} acl {{ACL_ID}} destination terminal`,
    variables: [
      { name: 'FW_INTERFACE', label: '防火墙接口', defaultValue: 'any', placeholder: '如any, port1' },
      { name: 'FW_FILTER', label: '过滤字', defaultValue: 'host 8.8.8.8 and icmp', placeholder: '如: host 192.168.1.1' },
      { name: 'COUNT', label: '抓包个数', defaultValue: '100', placeholder: '如: 100' },
      { name: 'SW_INTERFACE', label: '交换机接口', defaultValue: 'GigabitEthernet0/0/1', placeholder: '交换机抓包口' },
      { name: 'ACL_ID', label: '访问控制表ID', defaultValue: '3000', placeholder: '如: 3000' }
    ]
  },
  {
    id: 'debug-cisco-voice',
    title: 'Cisco语音网关 debug 模板',
    category: 'Debug',
    desc: '排查思科IOS语音网关(CUBE/SIP/ISDN)常见通话建立问题及SIP信令诊断指令。',
    code: `terminal monitor
debug ccsip messages
debug voip ccapi inout
debug isdn q931
show voice call status
show sip-ua calls`,
    variables: []
  }
];
