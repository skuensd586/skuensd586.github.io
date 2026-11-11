// 世界地图的投影与陆地轮廓。地图页（内嵌粗略轮廓）和 land.json（精细轮廓，放大后再加载）
// 必须用同一套投影，所以集中放在这里。
//
// 只画陆地与海，不画任何国界。数据：Natural Earth（公有领域），经 world-atlas 打包。

import { geoGraticule, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

/** 地图的坐标系宽度（SVG 用户单位）。 */
export const W = 2000;
const LAT_TOP = 78; // 北到斯瓦尔巴
const LAT_BOTTOM = -57; // 南到合恩角，不含南极
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const k = W / (2 * Math.PI);
export const H = Math.round(k * (merc(LAT_TOP) - merc(LAT_BOTTOM)));

// 墨卡托投影：放大到任何地方，形状都不会歪。
export const projection = geoMercator()
	.scale(k)
	.translate([W / 2, k * merc(LAT_TOP)])
	.clipExtent([
		[0, 0],
		[W, H],
	]);

const path = geoPath(projection).digits(1);

export function landPath(topology: any): string {
	return path(feature(topology, topology.objects.land) as any) ?? '';
}
export const graticulePath = path(geoGraticule().step([30, 30])()) ?? '';
export const linePath = (coords: [number, number][]) => path({ type: 'LineString', coordinates: coords }) ?? '';
