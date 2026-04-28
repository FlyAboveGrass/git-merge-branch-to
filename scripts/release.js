#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versionType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ 无效的版本类型，请使用: patch, minor, major');
  process.exit(1);
}

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const oldVersion = packageJson.version;

console.log(`📦 当前版本: ${oldVersion}`);
console.log(`🔄 更新版本类型: ${versionType}`);

try {
  console.log('\n1️⃣ 更新版本号...');
  execSync(`pnpm version ${versionType} --no-git-tag-version`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  const newPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const newVersion = newPackageJson.version;

  console.log(`✅ 版本已更新: ${oldVersion} → ${newVersion}`);

  console.log('\n2️⃣ 开始打包...');
  execSync('pnpm run package:local', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });

  console.log('\n3️⃣ 检查 Git 状态...');
  try {
    execSync('git rev-parse --git-dir', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore',
    });

    const gitStatus = execSync('git status --porcelain', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
    }).trim();

    if (!gitStatus.includes('package.json')) {
      console.log('ℹ️  package.json 没有变更，跳过提交');
    } else {
      console.log('\n4️⃣ 提交版本变更...');
      const commitMessage = `chore(release): ${newVersion}`;

      execSync(`git add package.json`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });

      execSync(`git commit -m "${commitMessage}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });

      console.log('\n5️⃣ 创建 Git tag...');
      const tagName = `v${newVersion}`;
      execSync(`git tag -a ${tagName} -m "Release ${newVersion}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });

      console.log(`\n✅ 版本变更已提交: ${commitMessage}`);
      console.log(`✅ Tag 已创建: ${tagName}`);

      console.log('\n6️⃣ 推送到远程...');
      execSync('git push', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });

      execSync(`git push origin ${tagName}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });

      console.log(`✅ 代码和 tag ${tagName} 已推送到远程`);
    }
  } catch {
    console.log('⚠️  不在 Git 仓库中或 Git 操作失败，跳过提交');
    console.log('   提示: 请手动提交 package.json 的版本变更');
  }

  console.log(`\n🎉 Release 完成！版本: ${newVersion}`);
} catch (error) {
  console.error('\n❌ Release 失败:', error.message);
  process.exit(1);
}
