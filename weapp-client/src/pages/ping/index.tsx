import { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function PingRedirect() {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/trace/index' })
  }, [])

  return (
    <View style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
      <Text>正在跳转至 Ping / MTR 诊断模块...</Text>
    </View>
  )
}
