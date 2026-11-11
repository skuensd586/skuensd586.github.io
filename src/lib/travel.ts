import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';

// 每个地点文件夹里的图片。构建时由 Astro 压缩、转成现代格式，并去掉 EXIF（包括拍摄位置）。
const files = import.meta.glob<{ default: ImageMetadata }>(
	'/src/content/travel/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
	{ eager: true },
);

/** 所有旅行地点（按时间从早到晚），每个地点带上它文件夹里的照片（按文件名排序）。 */
export async function getPlaces() {
	const list = await getCollection('travel', ({ data }) => import.meta.env.DEV || !data.draft);
	return list
		.map((place) => {
			const prefix = `/src/content/travel/${place.id}/`;
			const photos = Object.entries(files)
				.filter(([path]) => path.startsWith(prefix))
				.sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
				.map(([path, mod]) => ({ src: mod.default, name: path.slice(prefix.length) }));
			return { ...place, photos };
		})
		.sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
}

/** 39.9042, 116.4074 → "39.90°N 116.41°E" */
export function formatCoord(lat: number, lng: number) {
	return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}　${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}
