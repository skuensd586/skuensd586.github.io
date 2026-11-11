// 全站共享的常量。

export const SITE_TITLE = '小海湾';
export const SITE_DESCRIPTION = '一个有海浪声和小狗的个人博客：记录代码、生活，和路上看到的风景。';

/** 给站内链接加上 base 前缀（部署到 GitHub Pages 子路径时需要）。 */
export function url(path = ''): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}/${path.replace(/^\//, '')}`;
}
