// 新建文章：  npm run new "文章标题"
// 新建想法：  npm run new:thought "想法标题"
//
// 文章生成在 src/content/blog/，默认是草稿（draft: true），写完改成 false 或删掉该行即可发布。
// 想法生成在 src/content/thoughts/，直接发布，默认状态是「研究中」。

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const isThought = args.includes('--thought');
const title = args.filter((a) => a !== '--thought').join(' ').trim();
if (!title) {
	console.error(isThought ? '用法：npm run new:thought "想法标题"' : '用法：npm run new "文章标题"');
	process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// 文件名：日期 + 标题（保留中文，空白换成连字符，去掉文件名不允许的字符）
const slug = `${date}-${title.replace(/[\\/:*?"<>|#%]/g, '').replace(/\s+/g, '-')}`;
const kind = isThought ? 'thoughts' : 'blog';
const dir = fileURLToPath(new URL(`../src/content/${kind}/`, import.meta.url));
const file = `${dir}${slug}.md`;

if (existsSync(file)) {
	console.error(`文件已存在：${file}`);
	process.exit(1);
}

const q = title.replace(/'/g, "''");
const body = isThought
	? `---
title: '${q}'
date: '${date}'
status: researching   # 想明白后改成 internalized
attr: psy             # int 智力 / psy 精神 / fys 体格 / mot 运动
# effect: '+1 ……：想明白之后的一句加成'
---

在这里写下这个想法……
`
	: `---
title: '${q}'
description: ''
pubDate: '${date}'
tags: []
draft: true
---

在这里开始写作……
`;

await mkdir(dir, { recursive: true });
await writeFile(file, body);
console.log(
	`已创建：src/content/${kind}/${slug}.md` + (isThought ? '' : '\n写完后把 draft 改为 false（或删除该行）即可发布。'),
);
