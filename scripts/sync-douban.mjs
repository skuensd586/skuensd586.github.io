// 同步豆瓣「书影音」标记到 src/data/douban.json
//
// 用法：DOUBAN_ID=你的豆瓣ID node scripts/sync-douban.mjs
//
// 原理：豆瓣没有公开 API，这里读取个人主页公开的 RSS（只含最近约 10 条动态），
// 合并进已有的 JSON，历史记录会随每日同步逐渐累积。
// 更早的历史请用 scripts/import-douban.mjs 导入豆瓣导出文件。
// 豆瓣可能对机房 IP 限流；失败时脚本只打印警告并保留原数据，不会让部署中断。
//
// 封面不在这里处理（豆瓣封面有防盗链），见 scripts/fetch-covers.mjs。

import { load, mergeItems, save } from './lib/store.mjs';

const id = process.env.DOUBAN_ID?.trim();

if (!id) {
	console.log('未设置 DOUBAN_ID，跳过豆瓣同步。');
	process.exit(0);
}

const FEED = `https://www.douban.com/feed/people/${encodeURIComponent(id)}/interests`;

// 标题前缀 → [类型, 状态]
const PREFIX = {
	想读: ['book', 'wish'],
	在读: ['book', 'doing'],
	读过: ['book', 'done'],
	想看: ['movie', 'wish'],
	在看: ['movie', 'doing'],
	看过: ['movie', 'done'],
	想听: ['music', 'wish'],
	在听: ['music', 'doing'],
	听过: ['music', 'done'],
};
const RATING = { 力荐: 5, 推荐: 4, 还行: 3, 较差: 2, 很差: 1 };

const decode = (s = '') =>
	s
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.trim();
const tag = (block, name) => decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]);

function parse(xml) {
	const out = [];
	for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
		const title = tag(block, 'title'); // 例如：看过《海边的曼彻斯特》
		const m = title.match(/^(想读|在读|读过|想看|在看|看过|想听|在听|听过)(.+)$/);
		if (!m) continue; // 非书影音动态（日记、广播等）
		const [type, status] = PREFIX[m[1]];
		const desc = tag(block, 'description');
		const ratingWord = desc.match(/推荐:\s*(力荐|推荐|还行|较差|很差)/)?.[1];
		const comment = desc.match(/备注:\s*([^<]+)/)?.[1]?.trim();
		const pub = new Date(tag(block, 'pubDate'));
		out.push({
			type,
			status,
			title: m[2].replace(/^[《「『"“]|[》」』"”]$/g, '').trim(),
			url: tag(block, 'link'),
			rating: ratingWord ? RATING[ratingWord] : undefined,
			comment: comment || undefined,
			date: Number.isNaN(pub.valueOf()) ? new Date().toISOString() : pub.toISOString(),
		});
	}
	return out;
}

try {
	const res = await fetch(FEED, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
			Accept: 'application/rss+xml, application/xml, text/xml',
		},
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const fresh = parse(await res.text());

	const data = await load();
	const items = mergeItems(data.items, fresh);
	const changed = await save(data, items);
	console.log(`豆瓣同步完成：抓取 ${fresh.length} 条，共 ${items.length} 条${changed ? '（有更新）' : '（无变化）'}。`);
} catch (err) {
	console.warn(`⚠️ 豆瓣同步失败：${err.message}。保留现有数据。`);
}
