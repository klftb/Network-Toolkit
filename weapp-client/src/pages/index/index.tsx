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
        <Navigator url='/pages/subnet/index' className='tool-card gradient-blue'>
          <View className='icon'>🧮</View>
          <Text className='name'>子网掩码计算</Text>
          <Text className='desc'>纯本地运算，支持滑动条</Text>
        </Navigator>
        
        <Navigator url='/pages/ip/index' className='tool-card gradient-blue'>
          <View className='icon'>📍</View>
          <Text className='name'>公网 IP 查询</Text>
          <Text className='desc'>云端代理防跨域</Text>
        </Navigator>

        <Navigator url='/pages/ping/index' className='tool-card'>
          <View className='icon'>📡</View>
          <Text className='name'>Ping 探测</Text>
          <Text className='desc'>ICMP/TCP/UDP 连通性测试</Text>
        </Navigator>

        <View className='tool-card disabled'>
          <View className='icon'>🔍</View>
          <Text className='name'>端口扫描</Text>
          <Text className='desc'>开发中...</Text>
        </View>
      </View>
    </View>
  )
}