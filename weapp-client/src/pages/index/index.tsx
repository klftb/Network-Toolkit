import React from 'react'
import { View, Text, Navigator } from '@tarojs/components'
import './index.scss'

export default function Index() {
  return (
    <View className='home-page'>
      <View className='header'>
        <Text className='title'>Network Toolkit</Text>
        <Text className='subtitle'>您的云端网络专家</Text>
      </View>

      <View className='tools-grid'>
        <Navigator url='/pages/diagnose/index' className='tool-card featured' hoverClass='none'>
          <View className='icon'>🩺</View>
          <Text className='name'>一键体检</Text>
          <Text className='desc'>Ping+归属地+端口+Whois</Text>
        </Navigator>

        <Navigator url='/pages/subnet/index' className='tool-card' hoverClass='none'>
          <View className='icon'>🧮</View>
          <Text className='name'>子网掩码计算</Text>
          <Text className='desc'>纯本地运算</Text>
        </Navigator>

        <Navigator url='/pages/ip/index' className='tool-card' hoverClass='none'>
          <View className='icon'>📍</View>
          <Text className='name'>公网 IP 查询</Text>
          <Text className='desc'>归属地与ISP查询</Text>
        </Navigator>

        <Navigator url='/pages/ping/index' className='tool-card' hoverClass='none'>
          <View className='icon'>📡</View>
          <Text className='name'>Ping 探测</Text>
          <Text className='desc'>ICMP/TCP/UDP</Text>
        </Navigator>

        <Navigator url='/pages/portscan/index' className='tool-card' hoverClass='none'>
          <View className='icon'>🔍</View>
          <Text className='name'>端口扫描</Text>
          <Text className='desc'>预设与自定义扫描</Text>
        </Navigator>

        <Navigator url='/pages/wifi/index' className='tool-card' hoverClass='none'>
          <View className='icon'>📶</View>
          <Text className='name'>WiFi 信号</Text>
          <Text className='desc'>信号强度与附近热点</Text>
        </Navigator>

        <Navigator url='/pages/trace/index' className='tool-card' hoverClass='none'>
          <View className='icon'>🕸️</View>
          <Text className='name'>Trace / MTR</Text>
          <Text className='desc'>路由追踪与跳数丢包诊断</Text>
        </Navigator>

        <Navigator url='/pages/speedtest/index' className='tool-card featured' hoverClass='none'>
          <View className='icon'>⚡</View>
          <Text className='name'>网络测速</Text>
          <Text className='desc'>带宽测试+网站连通</Text>
        </Navigator>
      </View>
    </View>
  )
}