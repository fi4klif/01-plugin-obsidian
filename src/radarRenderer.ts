import { MainStatData } from "./statsManager";

export interface RadarChartOptions {
	chartSize?: number;
	fillColor?: string;
	strokeColor?: string;
	gridColor?: string;
	labelColor?: string;
	pointRadius?: number;
	fillOpacity?: number;
	chartGridCount?: number;
	chartFontFamily?: string;
	chartStrokeWidth?: number;
	axisColor?: string;
	axisOpacity?: number;
	axisWidth?: number;
	labelFontWeight?: string;
	labelFontSize?: number;
	labelTextShadow?: string;
	mode?: "triangle" | "circle";
}

export function generateRadarChartHTML(
	mainStatsData: MainStatData[],
	options: RadarChartOptions = {}
): string {
	const mode = options.mode || "triangle";
	const size = options.chartSize || 340;
	const center = size / 2;
	const radius = center - 30;
	const fillColor = options.fillColor || "rgba(0,200,255,0.18)";
	const strokeColor = options.strokeColor || "#00ff99";
	const gridColor = options.gridColor || "rgba(200,200,200,0.18)";
	const labelColor = options.labelColor || "#fff";
	const pointRadius = options.pointRadius || 4;
	const fillOpacity = options.fillOpacity ?? 0.18;
	const chartGridCount = options.chartGridCount || 5;
	const chartFontFamily = options.chartFontFamily || "inherit";
	const chartStrokeWidth = options.chartStrokeWidth || 2;
	const axisColor = options.axisColor || "#fff";
	const axisOpacity = options.axisOpacity ?? 0.3;
	const axisWidth = options.axisWidth || 2;
	const labelFontWeight = options.labelFontWeight || "bold";
	const labelFontSize = options.labelFontSize || 16;
	const labelTextShadow =
		options.labelTextShadow || "0 0 6px #000, 0 0 2px #000";

	let stats: MainStatData[];
	let numStats: number;
	if (mode === "circle") {
		stats = mainStatsData;
		numStats = mainStatsData.length;
	} else {
		stats = mainStatsData.slice(0, 3);
		numStats = 3;
	}

	function normLevel(level: number) {
		return Math.min(level * 10, 100);
	}

	// Grid (rings)
	const gridCircles = Array.from({ length: chartGridCount }, (_, i) => {
		const percent = ((i + 1) / chartGridCount) * 100;
		const r = (radius * percent) / 100;
		return `<circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${gridColor}" stroke-width="1"/>`;
	}).join("");

	// Axis lines (customizable)
	const axes = stats
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const x = center + radius * Math.cos(angle);
			const y = center + radius * Math.sin(angle);
			return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${axisColor}" stroke-opacity="${axisOpacity}" stroke-width="${axisWidth}"/>`;
		})
		.join("");

	// Data polygon
	const polygonPoints = stats
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const r = (radius * normLevel(stat.level)) / 100;
			const x = center + r * Math.cos(angle);
			const y = center + r * Math.sin(angle);
			return `${x},${y}`;
		})
		.join(" ");

	// Data points
	const dataPoints = stats
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const r = (radius * normLevel(stat.level)) / 100;
			const x = center + r * Math.cos(angle);
			const y = center + r * Math.sin(angle);
			return `<circle cx="${x}" cy="${y}" r="${pointRadius}" fill="${strokeColor}"/>`;
		})
		.join("");

	// Labels (читабельні, жирні, з тінню)
	const labels = stats
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const labelRadius = radius + 18;
			const x = center + labelRadius * Math.cos(angle);
			const y = center + labelRadius * Math.sin(angle);
			return `
      <text x="${x}" y="${y}" text-anchor="middle" dy="0" font-size="${labelFontSize}" fill="${labelColor}" font-family="${chartFontFamily}" font-weight="${labelFontWeight}" style="text-shadow:${labelTextShadow};">
        ${stat.name}
      </text>
      <text x="${x}" y="${
				y + 18
			}" text-anchor="middle" dy="0" font-size="13" fill="#fff" font-family="${chartFontFamily}" font-weight="bold" style="text-shadow:${labelTextShadow};">
        Lvl ${stat.level}
      </text>
    `;
		})
		.join("");

	return `
    <div class="xp-radar-container">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${gridCircles}
        ${axes}
        <polygon points="${polygonPoints}"
          fill="${fillColor.replace(/[\d.]+\)$/g, `${fillOpacity})`)}"
          stroke="${strokeColor}"
          stroke-width="${chartStrokeWidth}"/>
        ${dataPoints}
        ${labels}
      </svg>
    </div>
  `;
}
