import { MainStatData } from "./statsManager";

export function generateRadarChartHTML(
	mainStatsData: MainStatData[],
	options: {
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
	}
): string {
	const size = options.chartSize || 340;
	const center = size / 2;
	const radius = center - 30;
	const numStats = 3; // тільки 3 main stats
	const fillColor = options.fillColor || "rgba(0,200,255,0.18)";
	const strokeColor = options.strokeColor || "#00ff99";
	const gridColor = options.gridColor || "rgba(200,200,200,0.18)";
	const labelColor = options.labelColor || "#b0b0b0";
	const pointRadius = options.pointRadius || 4;
	const fillOpacity = options.fillOpacity ?? 0.18;
	const chartGridCount = options.chartGridCount || 5;
	const chartFontFamily = options.chartFontFamily || "inherit";
	const chartStrokeWidth = options.chartStrokeWidth || 2;

	// Helper: нормалізувати рівень (1-10 → 10-100%)
	function normLevel(level: number) {
		return Math.min(level * 10, 100);
	}

	// SVG grid circles (прозорі)
	const gridCircles = Array.from({ length: chartGridCount }, (_, i) => {
		const percent = ((i + 1) / chartGridCount) * 100;
		const r = (radius * percent) / 100;
		return `<circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${gridColor}" stroke-width="1"/>`;
	}).join("");

	// Axis lines
	const axes = mainStatsData
		.slice(0, 3)
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const x = center + radius * Math.cos(angle);
			const y = center + radius * Math.sin(angle);
			return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;
		})
		.join("");

	// Data polygon
	const polygonPoints = mainStatsData
		.slice(0, 3)
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
		.slice(0, 3)
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
		.slice(0, 3)
		.map((stat, i) => {
			const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
			const labelRadius = radius + 18;
			const x = center + labelRadius * Math.cos(angle);
			const y = center + labelRadius * Math.sin(angle);
			return `
      <text x="${x}" y="${y}" text-anchor="middle" dy="5" font-size="13" fill="${labelColor}" font-family="${chartFontFamily}">
        ${stat.name}
      </text>
      <text x="${x}" y="${
				y + 15
			}" text-anchor="middle" dy="5" font-size="11" fill="#888" font-family="${chartFontFamily}">
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
