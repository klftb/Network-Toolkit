export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/speedtest/index',
    'pages/target/index',
    'pages/connect/index',
    'pages/report/index',
    'pages/subnet/index',
    'pages/trace/index',
    'pages/latency/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f8fafc',
    navigationBarTitleText: 'Network Toolkit',
    navigationBarTextStyle: 'black'
  }
})