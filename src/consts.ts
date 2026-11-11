// 全站共享的常量。

export const SITE_TITLE = '潮声';
export const SITE_DESCRIPTION = '写下来的话，读过的书，看过的光影。';

/** 给站内链接加上 base 前缀（部署到 GitHub Pages 子路径时需要）。 */
export function url(path = ''): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}/${path.replace(/^\//, '')}`;
}

/** 主导航 */
export const NAV = [
	{ name: '文章', en: 'Journal', path: 'blog/' },
	{ name: '思维内阁', en: 'Thoughts', path: 'thoughts/' },
	{ name: '书影音', en: 'Inventory', path: 'media/' },
	{ name: '关于', en: 'Character', path: 'about/' },
] as const;

/**
 * 评论区（giscus，基于 GitHub Discussions）。四项都填好才会显示评论区。
 * 获取方式：先在仓库 Settings 里开启 Discussions，再到 https://giscus.app 填仓库名，
 * 页面会生成 data-repo-id 与 data-category-id，抄到这里即可。
 */
export const GISCUS = {
	repo: '', // 例如 'skuensd586/skuensd586.github.io'
	repoId: '',
	category: 'Announcements',
	categoryId: '',
};
