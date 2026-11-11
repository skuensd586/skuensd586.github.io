// 豆瓣数据的读写与合并，供 sync / import / fetch-covers 三个脚本共用。

import dns from 'node:dns';
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// WSL 等环境里 IPv6 常常不通，Node 先试 IPv6 会连接超时；优先 IPv4 更稳。
dns.setDefaultResultOrder('ipv4first');

// Node 的 fetch 默认不读 http_proxy / https_proxy（curl 会读）。
// 本机若配置了代理，需要显式启用，否则访问海外接口会连接超时。没有代理时此调用无影响。
http.setGlobalProxyFromEnv?.();

export const DATA_FILE = fileURLToPath(new URL('../../src/data/douban.json', import.meta.url));

export async function load() {
	try {
		return JSON.parse(await readFile(DATA_FILE, 'utf8'));
	} catch {
		return { updated: null, items: [] };
	}
}

const rank = { wish: 0, doing: 1, done: 2 };
const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

/**
 * 合并条目：
 * - 以「链接 + 状态」为键，新数据覆盖旧字段，但不会用空值抹掉已有字段（如封面）。
 * - 同一条目只保留最靠后的状态（想 → 在 → 已），并把封面等信息带过去。
 */
export function mergeItems(existing, incoming) {
	const map = new Map(existing.map((i) => [`${i.url}|${i.status}`, i]));
	for (const it of incoming) {
		const key = `${it.url}|${it.status}`;
		map.set(key, { ...map.get(key), ...defined(it) });
	}

	const best = new Map();
	const extras = new Map(); // url → { cover, coverTried }
	for (const item of map.values()) {
		const cur = best.get(item.url);
		if (!cur || rank[item.status] > rank[cur.status]) best.set(item.url, item);
		const ex = extras.get(item.url) ?? {};
		if (item.cover) ex.cover = item.cover;
		if (item.coverTried) ex.coverTried = item.coverTried;
		extras.set(item.url, ex);
	}
	return [...best.values()]
		.map((item) => ({ ...extras.get(item.url), ...item }))
		.sort((a, b) => b.date.localeCompare(a.date));
}

export async function save(data, items) {
	const changed = JSON.stringify(items) !== JSON.stringify(data.items);
	await writeFile(
		DATA_FILE,
		JSON.stringify({ updated: changed ? new Date().toISOString() : data.updated, items }, null, '\t') + '\n',
	);
	return changed;
}
