import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import TracePage from '../trace/index'
import LatencyPage from '../latency/index'
import './index.scss'

export default function ConnectHub() {
  const [activeTab, setActiveTab] = useState<'ping' | 'multi'>('ping')

  return (
    <View className='connect-page'>
      <View className='header'>
        <Text className='title'>连通性测试</Text>
        <Text className='subtitle'>深度 TCP Ping 探测与多节点延时对比</Text>
      </View>

      <View className='tabs-row'>
        <View className={`tab-item ${activeTab === 'ping' ? 'active' : ''}`} onClick={() => setActiveTab('ping')}>
          单节点 TCP Ping
        </View>
        <View className={`tab-item ${activeTab === 'multi' ? 'active' : ''}`} onClick={() => setActiveTab('multi')}>
          多节点并发测速
        </View>
      </View>

      <View className='tab-content'>
        {activeTab === 'ping' && <TracePage />}
        {activeTab === 'multi' && <LatencyPage />}
      </View>
    </View>
  )
}
