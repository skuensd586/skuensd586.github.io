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

// 思维内阁：比文章短的想法。一条想法一个文件。
const thoughts = defineCollection({
	loader: glob({ base: './src/content/thoughts', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		/** researching = 还在想；internalized = 想明白了 */
		status: z.enum(['researching', 'internalized']).default('researching'),
		/** 归属的属性色：智力 / 精神 / 体格 / 运动 */
		attr: z.enum(['int', 'psy', 'fys', 'mot']).default('psy'),
		/** 想明白之后的「加成」，一句话，可选。例如「+1 内陆帝国：对海更有耐心」 */
		effect: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

// 旅行：一个地点一个文件夹，里面是 index.md 和这次旅行的照片。
const travel = defineCollection({
	loader: glob({
		base: './src/content/travel',
		pattern: '*/index.md',
		// 用文件夹名作 id（也就是网址里的那一段）
		generateId: ({ entry }) => entry.split('/')[0],
	}),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		/** 纬度（北纬为正）与经度（东经为正） */
		lat: z.number().min(-90).max(90),
		lng: z.number().min(-180).max(180),
		draft: z.boolean().default(false),
	}),
});

export const collections = { blog, thoughts, travel };
