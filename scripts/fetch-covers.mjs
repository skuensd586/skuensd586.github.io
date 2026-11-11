// 为书影音条目获取封面，下载到 public/covers/，并把相对路径写回 src/data/douban.json
//
// 数据来源（均为公开接口）：
//   电影/剧集 → TMDB     需要环境变量 TMDB_API_KEY（v3 密钥或 v4 读取令牌均可）
//   书        → Open Library（无需密钥）
//   音乐      → 暂不支持（标题太容易重名，宁可显示题字封面也不贴错图）
//
// 用法：TMDB_API_KEY=xxx node scripts/fetch-covers.mjs
//
// 匹配只依据标题，难免认错。可在 src/data/cover-overrides.json 里手动指定：
//   { "https://movie.douban.com/subject/1/": "https://image.tmdb.org/t/p/w500/xxx.jpg" }
// 值可以是图片网址（会下载），也可以是已放进 public/ 的相对路径（如 "covers/my.jpg"）。

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load, save } from './lib/store.mjs';

const OUT_DIR = fileURLToPath(new URL('../public/covers/', import.meta.url));
const OVERRIDES_FILE = fileURLToPath(new URL('../src/data/cover-overrides.json', import.meta.url));
const UA = 'personal-blog-cover-fetcher/1.0 (static site build script)';
const RETRY_DAYS = 14; // 没找到封面的条目，隔多久再试

const TMDB_KEY = process.env.TMDB_API_KEY?.trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

async function getJson(url, headers = {}) {
	const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(20_000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

async function tmdb(path, params = {}) {
	const u = new URL(`https://api.themoviedb.org/3${path}`);
	for (const [k, v] of Object.entries({ language: 'zh-CN', ...params })) u.searchParams.set(k, v);
	const headers = {};
	if (TMDB_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${TMDB_KEY}`; // v4 令牌
	else u.searchParams.set('api_key', TMDB_KEY); // v3 密钥
	return getJson(u, headers);
}

/** "办公室 第三季" → { base: "办公室", season: 3 } */
function splitSeason(title) {
	const m = title.match(/^(.*?)\s*第\s*([一二三四五六七八九十]|\d+)\s*季\s*$/);
	if (!m) return { base: title.trim(), season: null };
	return { base: m[1].trim(), season: CN_NUM[m[2]] ?? Number(m[2]) };
}

async function movieCover(item) {
	const { base, season } = splitSeason(item.title);
	const found = await tmdb('/search/multi', { query: base });
	const hit = found.results?.find((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path);
	if (!hit) return null;
	const name = `${hit.title ?? hit.name}（${(hit.release_date ?? hit.first_air_date ?? '').slice(0, 4) || '?'}）`;
	if (season && hit.media_type === 'tv') {
		await sleep(250);
		try {
			const s = await tmdb(`/tv/${hit.id}/season/${season}`);
			if (s.poster_path) return { src: `https://image.tmdb.org/t/p/w500${s.poster_path}`, note: `${name} 第${season}季` };
		} catch {}
	}
	return { src: `https://image.tmdb.org/t/p/w500${hit.poster_path}`, note: name };
}

async function bookCover(item) {
	const u = new URL('https://openlibrary.org/search.json');
	u.searchParams.set('title', item.title);
	u.searchParams.set('limit', '5');
	u.searchParams.set('fields', 'title,cover_i');
	const found = await getJson(u);
	const hit = found.docs?.find((d) => d.cover_i);
	return hit ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg?default=false` : null;
}

async function download(src) {
	const ext = (src.match(/\.(jpe?g|png|webp|gif)(?:$|\?)/i)?.[1] ?? 'jpg').toLowerCase();
	const name = `${createHash('sha1').update(src).digest('hex').slice(0, 12)}.${ext}`;
	const file = `${OUT_DIR}${name}`;
	if (!existsSync(file)) {
		const res = await fetch(src, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
		if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`HTTP ${res.status}`);
		await mkdir(OUT_DIR, { recursive: true });
		await writeFile(file, Buffer.from(await res.arrayBuffer()));
	}
	return `covers/${name}`;
}

let overrides = {};
try {
	overrides = JSON.parse(await readFile(OVERRIDES_FILE, 'utf8'));
} catch {}

const data = await load();
const items = data.items.map((i) => ({ ...i }));
const now = Date.now();
const stat = { ok: 0, miss: 0, skip: 0, fail: 0 };

if (!TMDB_KEY) console.log('未设置 TMDB_API_KEY：跳过电影封面，仅处理书和手动指定的封面。');

for (const item of items) {
	const override = overrides[item.url];
	try {
		if (override) {
			item.cover = /^https?:/.test(override) ? await download(override) : override;
			stat.ok++;
			continue;
		}
		if (item.cover) continue;
		if (item.coverTried && now - Date.parse(item.coverTried) < RETRY_DAYS * 86_400_000) {
			stat.skip++;
			continue;
		}

		let found = null; // { src, note }
		if (item.type === 'movie') {
			if (!TMDB_KEY) continue;
			found = await movieCover(item);
			await sleep(250);
		} else if (item.type === 'book') {
			const src = await bookCover(item);
			found = src && { src, note: 'Open Library' };
			await sleep(700);
		} else {
			continue; // 音乐：不自动匹配
		}

		if (found) {
			item.cover = await download(found.src);
			delete item.coverTried;
			stat.ok++;
			console.log(`  ✓ ${item.title}  ←  ${found.note}`);
		} else {
			item.coverTried = new Date().toISOString();
			stat.miss++;
			console.log(`  · 未找到：${item.title}`);
		}
	} catch (err) {
		stat.fail++;
		console.warn(`  ✗ ${item.title}：${err.message}`);
	}
}

await save(data, items);
console.log(`封面处理完成：成功 ${stat.ok}，未找到 ${stat.miss}，暂缓重试 ${stat.skip}，出错 ${stat.fail}。`);
