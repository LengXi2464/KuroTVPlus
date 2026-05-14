# KuroTVPlus Cloudflare Pages 部署指南

## 概述

本文档详细记录了 KuroTVPlus 项目在 Cloudflare Pages 上的部署流程、配置要求及常见问题解决方案。

---

## 一、前置条件

### 1.1 必需的账号和服务

| 服务 | 说明 | 推荐方案 |
|------|------|----------|
| Cloudflare 账号 | 托管 Pages 和 D1 数据库 | 免费额度够用 |
| Upstash 账号 | Redis 缓存服务 | 免费额度够用 |
| GitHub 仓库 | 代码托管 | - |

### 1.2 本地环境要求

- Node.js >= 24.x
- pnpm >= 10.x

---

## 二、部署步骤

### 2.1 创建 Cloudflare Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Create Application**
3. 选择 **Pages** → **Connect to Git**
4. 选择你的 GitHub 仓库

### 2.2 配置构建设置

| 设置项 | 值 |
|--------|-----|
| **Framework preset** | Next.js |
| **Build command** | `pnpm run build:cloudflare` |
| **Build output directory** | `.open-next` |
| **Root directory** | 留空 |

> **关键说明**：必须使用 `build:cloudflare` 命令，该命令会执行 OpenNext 适配层构建，生成 Cloudflare Workers 所需的 `worker.js` 文件。

### 2.3 配置环境变量

在 **Settings** → **Environment variables** 中添加以下变量：

#### 基础配置（必需）

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `USERNAME` | 站长账号 | `admin` |
| `PASSWORD` | 站长密码 | `your_secure_password` |
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储类型 | `upstash` 或 `d1` |
| `CRON_PASSWORD` | 定时任务密码 | `your_cron_password` |

#### Upstash Redis 配置（当存储类型为 upstash 时）

| 变量名 | 说明 |
|--------|------|
| `UPSTASH_URL` | Upstash Redis URL |
| `UPSTASH_TOKEN` | Upstash Redis Token |

#### Cloudflare D1 配置（当存储类型为 d1 时）

确保 `wrangler.toml` 中已正确配置 D1 数据库：

```toml
[[d1_databases]]
binding = "DB"
database_name = "moontvplus"
database_id = "your-d1-database-id"
```

#### 可选配置

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_SITE_NAME` | 网站名称 |
| `TMDB_API_KEY` | TMDB API 密钥 |
| `ANNOUNCEMENT` | 网站公告 |
| `NEXT_PUBLIC_ENABLE_OFFLINE_DOWNLOAD` | 是否启用离线下载 |

### 2.4 配置 KV/其他绑定（如需要）

如果项目使用 Cloudflare KV，需要在 Pages 设置中添加 KV 命名空间绑定。

---

## 三、GitHub Actions 自动部署（可选）

项目已包含 `.github/workflows/cloudflare-deploy.yml` 配置文件，启用自动部署需要：

1. 在 GitHub 仓库的 **Settings** → **Secrets and variables** → **Actions** 中添加以下 secrets：

| Secret 名称 | 说明 |
|-------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |
| `USERNAME` | 站长账号 |
| `PASSWORD` | 站长密码 |
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储类型 |
| `UPSTASH_URL` | Upstash URL（如使用） |
| `UPSTASH_TOKEN` | Upstash Token（如使用） |
| `D1_DATABASE_ID` | D1 数据库 ID（如使用） |

2. 手动触发 workflow 或推送代码自动触发部署

---

## 四、常见问题及解决方案

### 4.1 错误：`The entry-point file at ".open-next/worker.js" was not found`

**原因**：构建命令配置错误，使用了标准的 `pnpm run build` 而不是 `pnpm run build:cloudflare`。

**解决方案**：
- 在 Cloudflare Pages 设置中将构建命令改为 `pnpm run build:cloudflare`

### 4.2 错误：`Next.js version 14.2.35 is not supported`

**原因**：Next.js 版本超出官方支持期限，OpenNext 构建时会阻止。

**解决方案**：
- 修改 `package.json` 中的构建脚本，添加 `--dangerouslyUseUnsupportedNextVersion` 标志：

```json
{
  "scripts": {
    "build:cloudflare": "BUILD_TARGET=cloudflare pnpm gen:manifest && npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion"
  }
}
```

### 4.3 错误：`binding DB of type d1 must have a valid database_id specified`

**原因**：`wrangler.toml` 中的 D1 数据库 ID 仍是占位符。

**解决方案**：
1. 在 Cloudflare Dashboard 获取 D1 数据库 ID
2. 更新 `wrangler.toml`：

```toml
database_id = "your-actual-d1-database-id"
```

### 4.4 网站显示"安全合规配置警告"

**原因**：未配置 `PASSWORD` 环境变量，网站处于未保护状态。

**解决方案**：
- 在环境变量中添加 `PASSWORD` 配置

---

## 五、项目配置文件说明

### 5.1 `wrangler.toml` 关键配置

```toml
name = "moontv-plus"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
main = ".open-next/worker.js"
minify = true

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "moontvplus"
database_id = "your-database-id"

[vars]
NODE_ENV = "production"
BUILD_TARGET = "cloudflare"
```

### 5.2 `open-next.config.ts`

OpenNext 配置文件，定义了 Cloudflare 适配层的转换规则，包括：
- 默认页面的 wrapper 和 converter 配置
- Edge 外部依赖列表
- Middleware 配置

---

## 六、部署验证

部署成功后，可以通过以下方式验证：

1. **访问网站首页**：确认页面能正常加载
2. **检查登录功能**：使用配置的 USERNAME 和 PASSWORD 登录
3. **测试核心功能**：搜索、播放、收藏等
4. **查看构建日志**：确认无错误警告

---

## 七、维护与更新

### 7.1 代码更新

推送代码到 GitHub 主分支会自动触发重新部署（如果启用了 GitHub Actions）。

### 7.2 环境变量更新

在 Cloudflare Pages 设置中修改环境变量后，需要手动触发重新构建。

### 7.3 D1 数据库迁移

通过 `wrangler d1 execute` 命令执行数据库迁移：

```bash
wrangler d1 execute moontvplus --remote --file=./migrations/001_initial_schema.sql
```

---

## 八、版本记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0 | 2026-05-15 | 初始版本，记录部署流程和常见问题 |