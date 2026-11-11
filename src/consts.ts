// 全站共享的常量。

export const SITE_TITLE = '潮声';
export const SITE_DESCRIPTION = '写下来的话，读过的书，看过的光影。';

/** 给站内链接加上 base 前缀（部署到 GitHub Pages 子路径时需要）。 */
export function url(path = ''): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}/${path.replace(/^\//, '')}`;
}
