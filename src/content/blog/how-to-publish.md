---
title: '如何发布一篇新文章'
description: '写作与发布流程速查：新建、预览、发布，以及草稿和标签的用法。'
pubDate: '2026-11-11'
tags: ['指南', 'Astro']
---

## 1. 新建文章

在项目目录运行：

```bash
npm run new "我的第一篇文章"
```

会在 `src/content/blog/` 下生成一个带 frontmatter 的 Markdown 文件，默认是**草稿**。

## 2. 本地预览

```bash
npm run dev
```

打开终端里提示的地址。草稿只在本地开发时可见，线上不会发布。

## 3. 发布

写完后，把文件顶部的 `draft: true` 改成 `draft: false`（或直接删掉这一行），然后提交并推送：

```bash
git add .
git commit -m "新文章：我的第一篇文章"
git push
```

GitHub Actions 会自动构建并部署，一两分钟后线上就能看到。

## frontmatter 字段

| 字段 | 说明 |
| --- | --- |
| `title` | 标题（必填） |
| `description` | 摘要，会显示在列表和分享卡片中（必填） |
| `pubDate` | 发布日期，如 `'2026-11-11'`（必填） |
| `updatedDate` | 更新日期（可选） |
| `heroImage` | 头图，图片放在 `src/assets/`（可选） |
| `tags` | 标签数组，如 `['随笔', '代码']` |
| `draft` | `true` 为草稿，默认 `false` |

## 在文章里使用图片

把图片放进 `src/assets/`，在文章里用相对路径引用即可，Astro 会自动压缩并转成现代格式。

```md
![海边的小狗](../../assets/dog.jpg)
```
