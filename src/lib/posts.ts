import { getCollection } from 'astro:content';

/**
 * 获取已发布文章，按发布时间倒序。
 * 草稿（frontmatter 里 draft: true）只在本地开发时可见，正式构建会被排除。
 */
export async function getPosts() {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
