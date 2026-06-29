# Egern 磁力拦截 · JavDB 优化版

针对 **JavDB 详情页点击「下载」** 的场景优化，效果类似 KeepShare 操作页：

- 复制磁力链接
- 115 网盘 · 离线下载
- PikPak · 一键导入
- 光鸭云盘 · 一键导入

## 文件说明

| 文件 | 作用 |
|------|------|
| `Magnet-Guangya.sgmodule` | Egern 模块配置（MITM 域名、脚本绑定） |
| `javdb-magnet-rewrite.js` | **JavDB 专项**：改写详情页 `magnet:` 链接 |
| `magnet-intercept-response.js` | 拦截 KeepShare 中转页 / 302 跳转 |
| `magnet-intercept-request.js` | 虚拟域名上的操作页与各导入动作 |

## 安装步骤

### 在线订阅（推荐）

Egern → **模块** → 从 URL 导入：

```
https://raw.githubusercontent.com/LaoTouWanYouXi/keepshare/refs/heads/main/Magnet-Guangya.sgmodule
```

脚本会从 GitHub 自动拉取，无需手动下载 `.js` 文件。

### 本地安装

1. 将 **5 个文件** 放在同一目录（iPhone 文件 App / iCloud）。
2. Egern → **模块** → 导入 `Magnet-Guangya.sgmodule`。
3. 填写模块参数：
   - **GUANGYA_REFRESH_TOKEN**：光鸭 `refresh_token`（一键导入光鸭必填）
   - **MAGNET_HOST**：保持默认 `egern-magnet.local`
   - **KEEPSHARE_TEMPLATE**：KeepShare 自动分享模板，已默认 `https://keepshare.cc/ppvt5qst/`
   - **ENABLE_115 / ENABLE_PIKPAK / ENABLE_GUANGYA**：设为 `0` 可隐藏对应按钮
4. Egern → **MITM** → 安装并 **完全信任** CA 证书。
5. 启用模块，打开 Egern 代理。

## JavDB 工作流程

```
打开 javdb.com/v/xxx 详情页
  → MITM 解密 HTML
  → javdb-magnet-rewrite.js 把「下载」的 magnet: 链接
     改为 https://egern-magnet.local/page?magnet=...
  → 点击下载 → 本地操作页（不唤起系统磁力处理器）
  → 选择 115 / PikPak / 光鸭
```

若你使用的脚本/站点先跳 **keepshare.org**，则由 `magnet-intercept-response.js` 直接替换为同一套操作页。

## MITM 域名（已内置）

- `javdb.com`、`javdb36.com`、`javdb37.com`（可按需追加镜像域）
- `keepshare.org`、`keepshare.cc`
- `egern-magnet.local`（虚拟操作域名）

若你使用其他 JavDB 镜像，在 `[MITM]` 段追加，例如：

```ini
hostname = %APPEND% javdb567.com
```

## 115 / PikPak 说明

| 配置 | 行为 |
|------|------|
| 已配置 `KEEPSHARE_TEMPLATE`（默认已填） | 115/PikPak 跳转 `https://keepshare.cc/ppvt5qst/{magnet}?action=115|pikpak` |
| 留空 `KEEPSHARE_TEMPLATE` | 115 → 115 网页离线下载；PikPak → PikPak Web 添加磁力 |

光鸭导入始终走本地脚本 + 你的 `refresh_token`，不经过 KeepShare 服务器。

## 常见问题

- **egern-magnet.local 无法访问 / 网页打不开**：
  1. 这是**虚拟域名**，不是真实网站，必须 **Egern 代理已开启** 且模块已启用
  2. 模块需包含 `[Host]` 和 `[General] force-http-engine-hosts`（新版已内置）
  3. MITM 证书必须 **完全信任**
  4. 更新模块后 **重新打开 JavDB 详情页**（旧页面 HTML 可能仍是错误链接）
  5. iOS 对 `.local` 域名有时异常；若仍失败，把模块参数 **MAGNET_HOST** 改为 `egern-magnet.test` 并同步改 MITM / Host（或等下一版默认改用 `.test`）
- **点击下载没反应 / 仍直接跳磁力**：确认 MITM 域名包含 JavDB、证书已信任。
- **操作页空白**：检查 GitHub Raw 脚本能否访问；Egern 日志是否有脚本报错。
- **光鸭导入失败「空间不足」**：光鸭云盘空间已满，需清理后再试。
- **script-path 找不到脚本**：确认 GitHub 仓库文件已 push，Raw 地址可打开。

## 与初版的区别

| 项目 | 初版 | JavDB 优化版 |
|------|------|--------------|
| 拦截范围 | 几乎全站 URL | 仅 JavDB 详情 + KeepShare |
| JavDB magnet: | 无法拦截（非 HTTP） | 页面内链接改写 |
| 操作页按钮 | 复制 + 光鸭 | 复制 + 115 + PikPak + 光鸭 |
| UI | 基础 | 对齐 KeepShare 截图风格 |
