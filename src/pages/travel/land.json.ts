// 精细的陆地轮廓（约 600KB，压缩后约 200KB）。地图放大到一定程度时才由浏览器请求。
import type { APIRoute } from 'astro';
import land50 from 'world-atlas/land-50m.json';
import { landPath } from '../../lib/worldmap';

export const GET: APIRoute = () =>
	new Response(JSON.stringify({ d: landPath(land50) }), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
