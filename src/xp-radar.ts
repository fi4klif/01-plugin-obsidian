import * as d3 from "d3";
import { XPSettings } from "./settings";

export function renderRadar(el: HTMLElement, settings: XPSettings) {
	const width = 400,
		height = 400;
	const stats = settings.stats;
	const data = stats.map(() => Math.floor(Math.random() * 100)); // TODO: реальні значення XP

	el.empty();
	el.addClass("xp-radar-container");
	el.createEl("h3", { text: "XP Radar" });

	const svg = d3
		.select(el)
		.append("svg")
		.attr("width", width)
		.attr("height", height);

	const radius = Math.min(width, height) / 2 - 40;
	const angleSlice = (Math.PI * 2) / stats.length;

	const g = svg
		.append("g")
		.attr("transform", `translate(${width / 2},${height / 2})`);

	// Полігон (XP форма)
	const line = d3
		.lineRadial<number>()
		.radius((d, i) => (d / 100) * radius)
		.angle((_, i) => i * angleSlice);

	g.append("path")
		.datum(data)
		.attr("d", line as any)
		.attr("fill", "rgba(0, 150, 255, 0.4)")
		.attr("stroke", "blue")
		.attr("stroke-width", 2);
}
