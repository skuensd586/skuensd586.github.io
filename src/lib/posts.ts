import { getCollection } from 'astro:content';

/**
 * 获取已发布文章，按发布时间倒序。
 * 草稿（frontmatter 里 draft: true）只在本地开发时可见，正式构建会被排除。
 */
export async function getPosts() {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 思维内阁的想法，按日期倒序。 */
export async function getThoughts() {
	const list = await getCollection('thoughts', ({ data }) => import.meta.env.DEV || !data.draft);
	return list.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** 估算阅读时长（分钟）：中文按每分钟 400 字，英文按每分钟 220 词。 */
export function readingMinutes(body = ''): number {
	const text = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\[\]()!-]/g, ' ');
	const cjk = (text.match(/[一-鿿]/g) ?? []).length;
	const words = (text.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
	return Math.max(1, Math.round(cjk / 400 + words / 220));
}

/** 所有标签及其文章数，按数量倒序。 */
export async function getTags() {
	const counts = new Map<string, number>();
	for (const post of await getPosts()) for (const t of post.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}
