const { spawn } = require('child_process');

const args = ['@tarojs/cli', 'init', 'weapp-client', '--name', 'weapp-client', '--typescript', '--css', 'sass', '--npm', 'npm', '--template', 'default', '--autoInstall'];
const p = spawn('npx.cmd', args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

p.stdout.on('data', (d) => {
  const str = d.toString();
  process.stdout.write(str);
  if (str.includes('请选择框架') || str.includes('请选择编译工具') || str.includes('是否需要使用编译器') || str.includes('请选择模板')) {
    p.stdin.write('\r\n');
  }
});

p.stderr.on('data', (d) => {
  process.stderr.write(d);
});

p.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
});
