# 部署到 GitHub Pages 分步指南

把「裙子账本」发布成一个手机浏览器能打开的公开网址。代码已经 GitHub Pages 就绪（全部相对路径，无需任何修改）。

> ⚠️ **先说清楚一个现实**：GitHub Pages 的服务器在海外，国内访问**实测偏慢、偶发打不开**（2026-08 实测：国内节点 60 秒都加载不完）。它适合「能用就行、能忍偶尔转圈」的场景。如果忍受不了，回到两条更稳的路：① CloudStudio 零成本（我随时重部署）② 买域名+备案绑 EdgeOne/CloudBase（一劳永逸）。本指南照你选的 GitHub Pages 路线写。

---

## 第一步：在 GitHub 新建仓库
1. 登录 https://github.com → 右上角 **＋** → **New repository**
2. 仓库名二选一：
   - **方案 A（推荐，最简单）**：随便起名，比如 `skirt-ledger`。最终网址是 `https://你的用户名.github.io/skirt-ledger/`
   - **方案 B（根域名，无子路径）**：仓库必须命名为 `你的用户名.github.io`（如 `miyan.github.io`）。最终网址是 `https://你的用户名.github.io/`，最干净，但一个账号只能有一个
3. 其它默认，**不要**勾选 "Add a README"（本地已经有了），直接 **Create repository**
4. 建好后，复制仓库的 git 地址（页面上有 HTTPS 那串，形如 `https://github.com/你的用户名/skirt-ledger.git`）

## 第二步：把本地代码推上去（你来做，需要你的 GitHub 账号）
本地仓库我已经帮你 `git init` 并提交好了，你只需补上远程地址并推送：

```bash
cd skirt-ledger
git remote add origin https://github.com/你的用户名/skirt-ledger.git
git branch -M main
git push -u origin main
```
> 推送时会让你登录 GitHub（浏览器或弹窗填用户名 + 密码/**Personal Access Token**）。密码现在大多要用 Token，不是账号密码——在 GitHub → Settings → Developer settings → Personal access tokens 生成一个，勾 repo 权限即可。

## 第三步：开启 GitHub Pages
1. 进仓库 → **Settings**（右上角）→ 左侧 **Pages**
2. **Build and deployment** → Source 选 **Deploy from a branch**
3. Branch 选 **main** / 目录选 **/ (root)** → **Save**
4. 等 1～2 分钟，页面顶部会出现一行绿字：`Your site is published at https://你的用户名.github.io/skirt-ledger/`

## 第四步：拿到最终链接
就是上面那个 `https://你的用户名.github.io/skirt-ledger/`（方案 B 则无 `/skirt-ledger`）。iPhone 用 Safari 打开它。

## 第五步：iPhone 安装到主屏
Safari 打开链接 → 点底部「分享」按钮 → **添加到主屏幕** → 主屏就多了一个「裙子账本」图标，点开就是全屏 App。

---

## 以后改了代码怎么办
1. 改完本地文件后：
   ```bash
   git add -A
   git commit -m "改了什么"
   git push
   ```
2. GitHub Pages 会自动重新发布，几秒到 1 分钟生效。
3. **手机端缓存**：Service Worker 会缓存旧版。iPhone 上要从后台**划掉 App 彻底关闭再重开**才会加载新版；若还不行，删了主屏图标重加。

## 换手机 / 清缓存前务必备份
数据只存在你这台手机的浏览器里，不会上传。在 App 内「统计 → 数据 → 导出备份」存一份 JSON，换手机后用「导入备份」恢复。

## 想在国内快一点？
GitHub Pages 本身改不了（服务器在海外）。唯一提速办法是**买域名 + ICP 备案 + 套国内 CDN 回源 GitHub**，但比直接绑 EdgeOne 更绕、首屏还更慢，不推荐。真要稳定，还是买域名+备案绑 EdgeOne/CloudBase。
