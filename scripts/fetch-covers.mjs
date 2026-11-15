// 为书影音条目获取封面，下载到 public/covers/，并把相对路径写回 src/data/douban.json
//
// 自动来源（均为公开接口）：
//   电影/剧集 → TMDB              需要环境变量 TMDB_API_KEY（v3 密钥或 v4 读取令牌均可）
//   书        → Open Library       无需密钥，但中文书收录很少
//              → Google Books      后备，需要环境变量 GOOGLE_BOOKS_API_KEY（匿名调用额度为 0）
//   音乐      → MusicBrainz + Cover Art Archive   无需密钥
//
// 用法：TMDB_API_KEY=xxx node scripts/fetch-covers.mjs [--retry]
//   --retry  重新尝试之前没找到封面的条目（默认 14 天内不重复尝试）
//
// 豆瓣只给标题，不给作者/歌手，所以自动匹配有两种补救办法：
//
// 1) 提示作者或歌手：src/data/cover-hints.json
//      { "https://music.douban.com/subject/1394768/": "Blur" }
//    音乐没有提示时，只有标题恰好唯一才会采用，否则跳过（宁可没图也不贴错）。
//
// 2) 手动放图：把图片命名为豆瓣条目编号，放进 public/covers/manual/
//      public/covers/manual/26658395.jpg     ← 编号就是豆瓣链接里 subject/ 后面的数字
//    也可以在 src/data/cover-overrides.json 里把豆瓣链接映射到图片网址或站内路径。

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { load, save } from './lib/store.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const OUT_DIR = `${PUBLIC_DIR}covers/`;
const UA = 'personal-blog-cover-fetcher/1.0 (static site build script)';
const RETRY_DAYS = 14; // 没找到封面的条目，隔多久再试
const RETRY = process.argv.includes('--retry');

const TMDB_KEY = process.env.TMDB_API_KEY?.trim();
const GBOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY?.trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
/** 比较标题用：去掉空白、标点和大小写差异 */
const norm = (s = '') => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

async function getJson(url, headers = {}) {
	const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(20_000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}
async function readJson(relative) {
	try {
		return JSON.parse(await readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
	} catch {
		return {};
	}
}

// ---------- 电影：TMDB ----------
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

// ---------- 书：Open Library，后备 Google Books ----------
async function bookCover(item, author) {
	const u = new URL('https://openlibrary.org/search.json');
	u.searchParams.set('title', item.title);
	if (author) u.searchParams.set('author', author);
	u.searchParams.set('limit', '5');
	u.searchParams.set('fields', 'title,cover_i');
	const hit = (await getJson(u)).docs?.find((d) => d.cover_i);
	if (hit) return { src: `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg?default=false`, note: `Open Library：${hit.title}` };

	if (!GBOOKS_KEY) return null;
	await sleep(300);
	const g = new URL('https://www.googleapis.com/books/v1/volumes');
	g.searchParams.set('q', `intitle:${item.title}${author ? ` inauthor:${author}` : ''}`);
	g.searchParams.set('maxResults', '5');
	g.searchParams.set('fields', 'items(volumeInfo(title,authors,imageLinks))');
	g.searchParams.set('key', GBOOKS_KEY);
	// 只接受标题对得上的结果，避免把别的书的封面贴上来
	const vol = (await getJson(g)).items?.find((v) => v.volumeInfo?.imageLinks && norm(v.volumeInfo.title).includes(norm(item.title)));
	if (!vol) return null;
	const link = vol.volumeInfo.imageLinks.thumbnail ?? vol.volumeInfo.imageLinks.smallThumbnail;
	return {
		src: link.replace(/^http:/, 'https:').replace('&edge=curl', ''),
		note: `Google Books：${vol.volumeInfo.title}（${(vol.volumeInfo.authors ?? []).join('、')}）`,
		ext: 'jpg',
	};
}

// ---------- 音乐：MusicBrainz 查专辑，Cover Art Archive 取封面 ----------
async function musicCover(item, artist) {
	const q = `releasegroup:"${item.title.replace(/"/g, '')}"${artist ? ` AND artist:"${artist.replace(/"/g, '')}"` : ''}`;
	const u = new URL('https://musicbrainz.org/ws/2/release-group');
	u.searchParams.set('query', q);
	u.searchParams.set('fmt', 'json');
	u.searchParams.set('limit', '6');
	const groups = (await getJson(u))['release-groups'] ?? [];
	const exact = groups.filter((g) => norm(g.title) === norm(item.title));

	let candidates;
	if (artist) candidates = exact.length ? exact : groups.slice(0, 1);
	else {
		// 没有歌手提示：重名的专辑太多，只有「标题完全一致且唯一」才敢用
		if (exact.length !== 1) return { ambiguous: exact.length };
		candidates = exact;
	}
	for (const g of candidates.slice(0, 3)) {
		await sleep(1100); // MusicBrainz 要求每秒不超过一次请求
		const src = `https://coverartarchive.org/release-group/${g.id}/front-500`;
		const head = await fetch(src, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
		if (head?.ok) return { src, note: `MusicBrainz：${g.title} — ${g['artist-credit']?.[0]?.name ?? '?'}（${(g['first-release-date'] ?? '').slice(0, 4) || '?'}）`, ext: 'jpg' };
	}
	return null;
}

// ---------- 下载 ----------
async function download(src, extHint) {
	const ext = (src.match(/\.(jpe?g|png|webp|gif)(?:$|\?)/i)?.[1] ?? extHint ?? 'jpg').toLowerCase();
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

/** public/covers/manual/<豆瓣编号>.<扩展名> */
function manualCover(item) {
	const id = item.url.match(/subject\/(\d+)/)?.[1];
	if (!id) return null;
	for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
		if (existsSync(`${OUT_DIR}manual/${id}.${ext}`)) return `covers/manual/${id}.${ext}`;
	}
	return null;
}

// ---------- 执行 ----------
const overrides = await readJson('../src/data/cover-overrides.json');
const hints = await readJson('../src/data/cover-hints.json');

const data = await load();
const items = data.items.map((i) => ({ ...i }));
const now = Date.now();
const stat = { ok: 0, miss: 0, skip: 0, fail: 0 };
const todo = []; // 需要人工补充的条目

if (!TMDB_KEY) console.log('未设置 TMDB_API_KEY：跳过电影封面。');
if (!GBOOKS_KEY) console.log('未设置 GOOGLE_BOOKS_API_KEY：图书只查 Open Library（中文书多半查不到）。');

for (const item of items) {
	const id = item.url.match(/subject\/(\d+)/)?.[1] ?? '?';
	try {
		// 人工指定的优先，且每次都生效（方便随时更换）
		const override = overrides[item.url];
		const manual = manualCover(item);
		if (override || manual) {
			item.cover = override ? (/^https?:/.test(override) ? await download(override) : override) : manual;
			delete item.coverTried;
			stat.ok++;
			continue;
		}
		if (item.cover) continue;

		const hint = hints[item.url];
		const recentlyTried = item.coverTried && now - Date.parse(item.coverTried) < RETRY_DAYS * 86_400_000;
		if (recentlyTried && !RETRY && !hint) {
			stat.skip++;
			todo.push({ item, id });
			continue;
		}

		let found = null;
		if (item.type === 'movie') {
			if (!TMDB_KEY) continue;
			found = await movieCover(item);
			await sleep(250);
		} else if (item.type === 'book') {
			found = await bookCover(item, hint);
			await sleep(700);
		} else {
			found = await musicCover(item, hint);
			await sleep(1100);
		}

		if (found?.src) {
			item.cover = await download(found.src, found.ext);
			delete item.coverTried;
			stat.ok++;
			console.log(`  ✓ ${item.title}  ←  ${found.note}`);
		} else {
			item.coverTried = new Date().toISOString();
			stat.miss++;
			todo.push({ item, id });
			const why = found?.ambiguous !== undefined ? `同名专辑有 ${found.ambiguous || '0'} 张完全一致的，无法确定是哪张` : '各来源都没有';
			console.log(`  · 未找到：${item.title}（${why}）`);
		}
	} catch (err) {
		stat.fail++;
		console.warn(`  ✗ ${item.title}：${err.message}`);
	}
}

await save(data, items);
console.log(`封面处理完成：成功 ${stat.ok}，未找到 ${stat.miss}，暂缓重试 ${stat.skip}，出错 ${stat.fail}。`);
if (todo.length > 0) {
	console.log('\n以下条目还没有封面，可以二选一补上：');
	console.log('  A. 在 src/data/cover-hints.json 里写上作者/歌手，再运行 npm run covers -- --retry');
	console.log('  B. 把图片存成 public/covers/manual/<编号>.jpg');
	for (const { item, id } of todo) console.log(`    [${item.type}] ${item.title}　编号 ${id}　${item.url}`);
}
