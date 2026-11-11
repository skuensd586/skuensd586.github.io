// 新建文章：npm run new "文章标题"
// 生成 src/content/blog/<slug>.md，默认是草稿（draft: true），写完把它改成 false 或删掉即可发布。

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
	console.error('用法：npm run new "文章标题"');
	process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// 文件名：日期 + 标题（保留中文，空白换成连字符，去掉文件名不允许的字符）
const slug = `${date}-${title.replace(/[\\/:*?"<>|#%]/g, '').replace(/\s+/g, '-')}`;
const dir = fileURLToPath(new URL('../src/content/blog/', import.meta.url));
const file = `${dir}${slug}.md`;

if (existsSync(file)) {
	console.error(`文件已存在：${file}`);
	process.exit(1);
}

await mkdir(dir, { recursive: true });
await writeFile(
	file,
	`---
title: '${title.replace(/'/g, "''")}'
description: ''
pubDate: '${date}'
tags: []
draft: true
---

在这里开始写作……
`,
);
console.log(`已创建：src/content/blog/${slug}.md\n写完后把 draft 改为 false（或删除该行）即可发布。`);
