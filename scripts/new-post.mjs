// 新建文章：  npm run new "文章标题"
// 新建想法：  npm run new:thought "想法标题"
// 新建地点：  npm run new:place "地名"
//
// 文章生成在 src/content/blog/，默认是草稿（draft: true），写完改成 false 或删掉该行即可发布。
// 想法生成在 src/content/thoughts/，直接发布，默认状态是「研究中」。
// 地点生成一个文件夹 src/content/travel/<地名>/，把照片放进去即可。
// 会尝试用 OpenStreetMap 的公开地名查询填好经纬度；查不到就留 0，需要手动改。

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const isThought = args.includes('--thought');
const isPlace = args.includes('--place');
const title = args.filter((a) => !a.startsWith('--')).join(' ').trim();
if (!title) {
	console.error(isPlace ? '用法：npm run new:place "地名"' : isThought ? '用法：npm run new:thought "想法标题"' : '用法：npm run new "文章标题"');
	process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

if (isPlace) {
	await import('./lib/store.mjs'); // 只为启用系统代理与 IPv4 优先
	const safe = title.replace(/[\\/:*?"<>|#%]/g, '').replace(/\s+/g, '-');
	const folder = fileURLToPath(new URL(`../src/content/travel/${safe}/`, import.meta.url));
	if (existsSync(folder)) {
		console.error(`文件夹已存在：${folder}`);
		process.exit(1);
	}
	let lat = 0;
	let lng = 0;
	let found = '';
	try {
		const u = new URL('https://nominatim.openstreetmap.org/search');
		u.searchParams.set('q', title);
		u.searchParams.set('format', 'json');
		u.searchParams.set('limit', '1');
		u.searchParams.set('accept-language', 'zh-CN');
		const res = await fetch(u, { headers: { 'User-Agent': 'personal-blog-new-place/1.0' }, signal: AbortSignal.timeout(10_000) });
		const [hit] = await res.json();
		if (hit) {
			lat = Number(Number(hit.lat).toFixed(4));
			lng = Number(Number(hit.lon).toFixed(4));
			found = hit.display_name;
		}
	} catch {}
	await mkdir(folder, { recursive: true });
	await writeFile(
		`${folder}index.md`,
		`---
title: '${title.replace(/'/g, "''")}'
date: '${date}'   # 去的日期，决定地图上路线的先后
lat: ${lat}
lng: ${lng}
---

关于这个地方，写几句……
`,
	);
	console.log(`已创建：src/content/travel/${safe}/index.md`);
	console.log(found ? `经纬度取自：${found}（${lat}, ${lng}）。不对的话请手动改。` : '没查到经纬度，已填 0，请手动改 lat / lng。');
	console.log('把这次旅行的照片放进同一个文件夹即可。');
	process.exit(0);
}

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
