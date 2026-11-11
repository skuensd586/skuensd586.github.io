import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// 读取 src/content/blog/ 下的 Markdown 与 MDX 文件
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// 校验 frontmatter，写错字段时构建会直接报错
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
			/** true 表示草稿：本地可预览，线上不发布 */
			draft: z.boolean().default(false),
		}),
});

export const collections = { blog };
