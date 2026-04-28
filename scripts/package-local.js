#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const version = packageJson.version;
const packageName = `${packageJson.name}_${version}.vsix`;

console.log(`正在打包，版本: ${version}`);
console.log(`包名: ${packageName}`);

try {
  execSync(
    `vsce package --allow-missing-repository --allow-star-activation --no-dependencies --out ${packageName}`,
    {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    }
  );
  console.log(`\n✅ 打包成功！文件: ${packageName}`);
} catch (error) {
  console.error('\n❌ 打包失败:', error.message);
  process.exit(1);
}
