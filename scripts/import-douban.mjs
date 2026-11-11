// 导入豆瓣导出的历史标注，补全 RSS 只能给出最近约 10 条的缺口。
//
// 用法：node scripts/import-douban.mjs <导出文件.csv|.json> [...更多文件]
//
// 豆瓣官方没有导出功能。可用浏览器扩展（如「豆伴」）在你自己登录的浏览器里
// 把「我看/读/听」导出成 CSV 或 JSON，再用本脚本导入。导出的是你自己的数据，
// 脚本不会访问豆瓣。
//
// 列名（中英文均可，大小写不敏感）：
//   标题 title/name · 链接 url/link · 类型 type/category · 状态 status
//   评分 rating · 短评 comment · 日期 date
// 缺少「类型」时从链接域名推断（book./movie./music.douban.com）。
// 缺少「状态」时，按标题里的「想看/看过…」前缀推断，仍无法判断则当作已完成。

import { readFile } from 'node:fs/promises';
import { load, mergeItems, save } from './lib/store.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
	console.error('用法：node scripts/import-douban.mjs <导出文件.csv|.json> [...]');
	process.exit(1);
}

// ---------- 解析 ----------
function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = '';
	let quoted = false;
	text = text.replace(/^﻿/, '');
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
			else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') (row.push(cell), (cell = ''));
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(cell);
			cell = '';
			if (row.some((x) => x !== '')) rows.push(row);
			row = [];
		} else cell += c;
	}
	row.push(cell);
	if (row.some((x) => x !== '')) rows.push(row);
	const [head, ...body] = rows;
	return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const ALIAS = {
	title: ['标题', '名称', '名字', 'title', 'name'],
	url: ['链接', '豆瓣链接', '条目链接', 'url', 'link', 'subject_url'],
	type: ['类型', '分类', 'type', 'category'],
	status: ['状态', '标记', 'status', 'state', 'interest'],
	rating: ['评分', '我的评分', '个人评分', 'rating', 'my_rating', 'score'],
	comment: ['短评', '评论', '备注', 'comment', 'review', 'note'],
	date: ['日期', '标记日期', '标记时间', '时间', 'date', 'create_time', 'time', 'created'],
};
const pick = (row, key) => {
	const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
	for (const a of ALIAS[key]) if (lower[a.toLowerCase()] !== undefined && lower[a.toLowerCase()] !== '') return String(lower[a.toLowerCase()]);
	return '';
};

const TYPE = { 书: 'book', 图书: 'book', book: 'book', 电影: 'movie', 影: 'movie', 影视: 'movie', 剧集: 'movie', movie: 'movie', 音乐: 'music', 音: 'music', music: 'music' };
const STATUS = {
	想读: 'wish', 想看: 'wish', 想听: 'wish', wish: 'wish', wishlist: 'wish',
	在读: 'doing', 在看: 'doing', 在听: 'doing', do: 'doing', doing: 'doing',
	读过: 'done', 看过: 'done', 听过: 'done', collect: 'done', done: 'done',
};
const RATING_WORD = { 力荐: 5, 推荐: 4, 还行: 3, 较差: 2, 很差: 1 };

function toItem(row) {
	let title = pick(row, 'title');
	const url = pick(row, 'url');
	if (!title || !url) return null;

	let status = STATUS[pick(row, 'status').toLowerCase()];
	const prefix = title.match(/^(想读|在读|读过|想看|在看|看过|想听|在听|听过)(.+)$/);
	if (prefix) {
		status ??= STATUS[prefix[1]];
		title = prefix[2];
	}
	title = title.replace(/^[《「『"“]|[》」』"”]$/g, '').trim();

	let type = TYPE[pick(row, 'type').toLowerCase()];
	type ??= url.includes('book.douban') ? 'book' : url.includes('music.douban') ? 'music' : url.includes('movie.douban') ? 'movie' : undefined;
	if (!type) return null;

	// 评分：1–5 的数字；10 分制折半；或「力荐/推荐…」
	const rawRating = pick(row, 'rating');
	let rating = RATING_WORD[rawRating] ?? Number(rawRating);
	if (!Number.isFinite(rating) || rating <= 0) rating = undefined;
	else if (rating > 5) rating = Math.min(5, Math.round(rating / 2));

	const d = new Date(pick(row, 'date').replace(/\//g, '-'));
	return {
		type,
		status: status ?? 'done',
		title,
		url: url.replace(/^http:/, 'https:'),
		rating,
		comment: pick(row, 'comment') || undefined,
		date: Number.isNaN(d.valueOf()) ? new Date(0).toISOString() : d.toISOString(),
	};
}

// ---------- 执行 ----------
let incoming = [];
for (const f of files) {
	const text = await readFile(f, 'utf8');
	let rows;
	if (f.toLowerCase().endsWith('.json')) {
		const j = JSON.parse(text);
		rows = Array.isArray(j) ? j : (j.items ?? j.data ?? []);
	} else rows = parseCsv(text);
	const items = rows.map(toItem).filter(Boolean);
	console.log(`${f}：读取 ${rows.length} 行，识别出 ${items.length} 条${items.length < rows.length ? `（${rows.length - items.length} 行缺少标题/链接/类型，已跳过）` : ''}`);
	incoming = incoming.concat(items);
}

const data = await load();
const before = data.items.length;
const merged = mergeItems(data.items, incoming);
await save(data, merged);
console.log(`导入完成：${before} → ${merged.length} 条（新增 ${merged.length - before}）。`);
