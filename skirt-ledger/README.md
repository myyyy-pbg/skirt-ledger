# 裙子账本（Skirt Ledger）

一个纯前端、可离线使用的 Lolita 裙子 / 配饰记账 PWA。手机浏览器打开即可当 App 用，数据存在本机（localStorage），**不上传任何服务器**。

## 功能
- 记裙子：系列名 + 多款式（定金 / 尾款 / 全款）、类型（JSK / OP / SK / 开衫 / 衬衫）、颜色多选、照片、品牌、备注
- 记配饰（独立统计，不计入裙子总价）
- 统计：总价 / 已付 / 待付尾款、按类型 / 月份 / 颜色分布、配饰明细
- 一键导出 / 导入备份（换手机前务必导出）
- 安装到主屏：Safari → 分享 → 添加到主屏幕

## 技术
纯静态：HTML + CSS + 原生 JS，Service Worker 离线缓存。**无构建步骤、无依赖、无后端**。
所有资源均为相对路径，可直接拖到任意静态托管。

## 部署
- **GitHub Pages（推荐看这份）**：详见 [GitHub-Pages-部署步骤.md](./GitHub-Pages-部署步骤.md)
- 其它静态托管（CloudStudio / EdgeOne Pages / CloudBase / 任意支持静态文件的平台）：把本目录整个拖上去即可

## 版本
当前 `VERSION = v8`（见 app.js 顶部）。改代码后请同步更新 app.js 的 `VERSION`、sw.js 的 `CACHE`、index.html 里的 `?v=N` 三处版本号，否则手机端可能加载到旧缓存。
