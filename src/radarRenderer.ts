import { MainStatData } from "./statsManager";

export function generateRadarChartHTML(
	mainStatsData: MainStatData[],
	options: {
		chartSize?: number;
		fillColor?: string;
		strokeColor?: string;
		gridColor?: string;
		labelColor?: string;
		showProgressBars?: boolean;
		pointRadius?: number;
		fillOpacity?: number;
		chartBgColor?: string;
		chartGridCount?: number;
		chartFontFamily?: string;
		chartStrokeWidth?: number;
	}
): string {
	const size = options.chartSize || 360;
	const center = size / 2;
	const radius = center - 50;
	const numStats = mainStatsData.length;
	const fillColor = options.fillColor || "rgba(75,192,192,0.4)";
	const strokeColor = options.strokeColor || "rgba(75,192,192,1)";
	const gridColor = options.gridColor || "#444";
	const labelColor = options.labelColor || "#eee";
	const pointRadius = options.pointRadius || 4;
	const fillOpacity = options.fillOpacity ?? 0.4;
	const chartBgColor = options.chartBgColor || "#181818";
	const chartGridCount = options.chartGridCount || 5;
	const chartFontFamily = options.chartFontFamily || "inherit";
	const chartStrokeWidth = options.chartStrokeWidth || 2;

	// Helper: нормалізувати рівень (наприклад, 1-10 → 10-100%)
	function normLevel(level: number) {
		return Math.min(level * 10, 100);
	}

	// SVG grid circles
	const gridCircles = Array.from({ length: chartGridCount }, (_, i) => {
		const percent = ((i + 1) / chartGridCount) * 100;
		const r = (radius * percent) / 100;
		return `<circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${gridColor}" stroke-width="1"/>`;
	}).join("");

	// Axis lines
	const axes = mainStatsData
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const x = center + radius * Math.cos(angle);
			const y = center + radius * Math.sin(angle);
			return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;
		})
		.join("");

	// Data polygon
	const polygonPoints = mainStatsData
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const r = (radius * normLevel(stat.level)) / 100;
			const x = center + r * Math.cos(angle);
			const y = center + r * Math.sin(angle);
			return `${x},${y}`;
		})
		.join(" ");

	// Data points
	const dataPoints = mainStatsData
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const r = (radius * normLevel(stat.level)) / 100;
			const x = center + r * Math.cos(angle);
			const y = center + r * Math.sin(angle);
			return `<circle cx="${x}" cy="${y}" r="${pointRadius}" fill="${strokeColor}"/>`;
		})
		.join("");

	// Labels
	const labels = mainStatsData
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const labelRadius = radius + 20;
			const x = center + labelRadius * Math.cos(angle);
			const y = center + labelRadius * Math.sin(angle);
			return `
      <text x="${x}" y="${y}" text-anchor="middle" dy="5" font-size="14" fill="${labelColor}" font-family="${chartFontFamily}">
        ${stat.name}
      </text>
      <text x="${x}" y="${
				y + 18
			}" text-anchor="middle" dy="5" font-size="12" fill="#aaa" font-family="${chartFontFamily}">
        Lvl ${stat.level}
      </text>
    `;
		})
		.join("");

	return `
    <div class="xp-radar-container" style="background:${chartBgColor};">
      <h3 style="color:${labelColor};font-family:${chartFontFamily};">XP Radar</h3>
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:${chartBgColor};border-radius:8px;">
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
