// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// 在 GitHub Actions 中构建时，根据仓库自动推导 site 与 base：
//   - 仓库名为 <用户名>.github.io  → https://<用户名>.github.io/
//   - 其他仓库名                    → https://<用户名>.github.io/<仓库名>
// 本地开发时使用默认值。若使用自定义域名，把 site 改成你的域名、base 设为 '/' 即可。
const repository = process.env.GITHUB_REPOSITORY; // 形如 "owner/name"
let site = 'https://example.com';
let base = '/';

if (process.env.GITHUB_ACTIONS && repository) {
	const [owner, name] = repository.split('/');
	site = `https://${owner}.github.io`;
	base = name.toLowerCase() === `${owner}.github.io`.toLowerCase() ? '/' : `/${name}`;
}

// https://astro.build/config
export default defineConfig({
	site,
	base,
	integrations: [mdx(), sitemap()],
	markdown: {
		// 代码高亮：浅色/深色双主题，随系统切换
		shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
	},
});
