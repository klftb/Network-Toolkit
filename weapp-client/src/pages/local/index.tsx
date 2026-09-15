import React from 'react'
import { View, Text, Navigator } from '@tarojs/components'
import '../target/index.scss' // 复用通用样式

export default function LocalHub() {
  return (
    <View className='hub-page'>
      <View className='hub-header'>
        <View className='hub-icon pink'>📱</View>
        <Text className='hub-title'>Local Network</Text>
        <Text className='hub-desc'>本地网络环境与体检评估</Text>
      </View>

      <View className='nav-list'>
        <Navigator url='/pages/report/index' className='nav-item'>
          <View className='item-icon'>📝</View>
          <View className='item-text'>
            <Text className='item-title'>环境诊断报告</Text>
            <Text className='item-desc'>一键生成当前所处网络拓扑与内外网详细特征</Text>
          </View>
          <View className='item-arrow'>→</View>
        </Navigator>

        <Navigator url='/pages/wifi/index' className='nav-item'>
          <View className='item-icon'>📶</View>
          <View className='item-text'>
            <Text className='item-title'>WiFi 信号检测</Text>
            <Text className='item-desc'>已连接无线局域网深度质量分析与周边频段图谱</Text>
          </View>
          <View className='item-arrow'>→</View>
        </Navigator>

        <Navigator url='/pages/subnet/index' className='nav-item'>
          <View className='item-icon'>🧮</View>
          <View className='item-text'>
            <Text className='item-title'>子网掩码计算器</Text>
            <Text className='item-desc'>离线计算局域网可用首尾 IP 与可用主机总数</Text>
          </View>
          <View className='item-arrow'>→</View>
        </Navigator>
      </View>
    </View>
  )
}
