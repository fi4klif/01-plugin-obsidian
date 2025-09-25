import {
	Plugin,
	PluginSettingTab,
	App,
	Setting,
	TFile,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
	Component,
	Notice, // Додати цей імпорт
	MarkdownView,
} from "obsidian";

interface XPSystemSettings {
	subStatTag: string;
	mainStatTag: string;
	xpMultiplier: number;
	levelFormula: string;
	mainToSubXPRatio: number;
	forceUpdateFiles: boolean;
	debugMode: boolean;
	autoSyncOnStartup: boolean;
	chartTheme: "default" | "dark" | "colorful";
}

const DEFAULT_SETTINGS: XPSystemSettings = {
	subStatTag: "substat",
	mainStatTag: "stat",
	xpMultiplier: 100,
	levelFormula: "1.5",
	mainToSubXPRatio: 0.2,
	forceUpdateFiles: false,
	debugMode: false,
	autoSyncOnStartup: true,
	chartTheme: "default",
};

interface LevelInfo {
	level: number;
	xpCurrent: number;
	xpNeeded: number;
	progress: number;
}

interface SubStatData {
	level: number;
	xpCurrent: number;
	xpNeeded: number;
	progress: number;
	mainCategory: string;
	totalXP: number;
	newXPEarned: number;
	storedTotalXP: number;
}

interface MainStatData {
	name: string;
	level: number;
	progress: number;
}

export default class XPSystemPlugin extends Plugin {
	settings: XPSystemSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon("zap", "XP System Sync", () => {
			this.runXPSync();
		});

		// Add command
		this.addCommand({
			id: "xp-sync",
			name: "Run XP Sync",
			callback: () => {
				this.runXPSync();
			},
		});

		// Add command for radar chart
		this.addCommand({
			id: "show-radar-chart",
			name: "Show XP Radar Chart",
			callback: () => {
				this.showRadarChart();
			},
		});

		// Add settings tab
		this.addSettingTab(new XPSystemSettingTab(this.app, this));

		// Register code block processor for radar charts
		this.registerMarkdownCodeBlockProcessor(
			"xp-radar",
			(source, el, ctx) => {
				this.processRadarChart(source, el, ctx);
			}
		);

		// Auto-sync on startup if enabled
		if (this.settings.autoSyncOnStartup) {
			setTimeout(() => this.runXPSync(), 1000);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Level calculation functions
	xpNeededForLevel(lvl: number): number {
		return Math.floor(
			this.settings.xpMultiplier *
				Math.pow(lvl, parseFloat(this.settings.levelFormula))
		);
	}

	calculateLevelFromTotalXP(totalXP: number): LevelInfo {
		if (!totalXP || totalXP < 0)
			return {
				level: 1,
				xpCurrent: 0,
				xpNeeded: this.xpNeededForLevel(1),
				progress: 0,
			};

		let level = 1;
		let xpSpent = 0;

		while (true) {
			const xpForThisLevel = this.xpNeededForLevel(level);
			if (xpSpent + xpForThisLevel > totalXP) break;
			xpSpent += xpForThisLevel;
			level++;
		}

		const xpCurrent = totalXP - xpSpent;
		const xpNeeded = this.xpNeededForLevel(level);
		const progress = Math.round((xpCurrent / xpNeeded) * 100);

		return { level, xpCurrent, xpNeeded, progress };
	}

	// Category parsing functions
	extractCategoryFromWikilink(categoryValue: any): string {
		if (!categoryValue) return "Misc";

		try {
			let categoryStr = String(categoryValue);

			if (this.settings.debugMode) {
				console.log(`🔍 Raw category value: "${categoryStr}"`);
			}

			// Extract content from wikilinks [[...]]
			const wikilinkMatch = categoryStr.match(
				/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/
			);
			if (wikilinkMatch) {
				let result = wikilinkMatch[2] || wikilinkMatch[1];
				result = result.split("/").pop()?.replace(".md", "") || result;
				if (this.settings.debugMode) {
					console.log(`🔍 Extracted from wikilink: "${result}"`);
				}
				return result;
			}

			categoryStr = categoryStr.replace(/['"]/g, "").trim();
			return categoryStr || "Misc";
		} catch (err) {
			if (this.settings.debugMode) {
				console.log(`⚠️ Category parsing error: ${err}`);
			}
			return "Misc";
		}
	}

	parseMainCategory(fileCache: any): string {
		let mainCategory = "Misc";

		try {
			const frontmatter = fileCache?.frontmatter;
			if (!frontmatter) return mainCategory;

			if (
				frontmatter.categories &&
				Array.isArray(frontmatter.categories) &&
				frontmatter.categories.length > 0
			) {
				mainCategory = this.extractCategoryFromWikilink(
					frontmatter.categories[0]
				);
			} else if (frontmatter.category) {
				mainCategory = this.extractCategoryFromWikilink(
					frontmatter.category
				);
			} else if (frontmatter["main-category"]) {
				mainCategory = this.extractCategoryFromWikilink(
					frontmatter["main-category"]
				);
			}

			if (this.settings.debugMode) {
				console.log(
					`🔍 ${fileCache.file?.name} → final category: "${mainCategory}"`
				);
			}
		} catch (err) {
			if (this.settings.debugMode) {
				console.log(`⚠️ Category parsing error: ${err}`);
			}
		}

		return mainCategory;
	}

	// File update function
	async safeUpdateInlineFields(
		file: TFile,
		updates: Record<string, any>
	): Promise<boolean> {
		if (!this.settings.forceUpdateFiles) return true;

		try {
			let content = await this.app.vault.read(file);
			let hasChanges = false;

			for (const [field, value] of Object.entries(updates)) {
				const regex = new RegExp(`^${field}::\\s*(.*)$`, "m");
				const newLine = `${field}:: ${value}`;
				const match = content.match(regex);

				if (match) {
					if (match[1].trim() !== String(value)) {
						content = content.replace(regex, newLine);
						hasChanges = true;
					}
				} else {
					const frontmatterMatch = content.match(
						/^---\n[\s\S]*?\n---\n/
					);
					if (frontmatterMatch) {
						content =
							content.slice(0, frontmatterMatch[0].length) +
							`${newLine}\n` +
							content.slice(frontmatterMatch[0].length);
						hasChanges = true;
					} else {
						content = `${newLine}\n\n${content}`;
						hasChanges = true;
					}
				}
			}

			if (hasChanges) {
				await this.app.vault.modify(file, content);
			}
			return true;
		} catch (err) {
			console.error(`❗ Error updating ${file.path}: ${err}`);
			return false;
		}
	}

	// Main XP sync function
	async runXPSync() {
		try {
			console.log("🔎 XP sync started...");

			const xpTagRegex = /#xp\/\s*(?:\[\[([^\]]+)\]\]|([^\s\+]+))/i;
			const xpNumberRegex = /\+(\d+)/;
			const taskXPBySub: Record<string, number> = {};

			// 1) Collect XP from completed tasks
			const files = this.app.vault.getMarkdownFiles();
			for (const file of files) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				if (!fileCache?.listItems) continue;

				for (const listItem of fileCache.listItems) {
					if (!listItem.task || listItem.task !== "x") continue;

					const lineText = await this.getLineText(
						file,
						listItem.position.start.line
					);
					if (!lineText.includes("#xp/")) continue;

					const tagMatch = lineText.match(xpTagRegex);
					if (!tagMatch) continue;

					const subName = (tagMatch[1] || tagMatch[2]).trim();
					if (subName === "substat tem") continue;

					const xpMatch = lineText.match(xpNumberRegex);
					const xpValue = xpMatch ? parseInt(xpMatch[1], 10) : 1;

					taskXPBySub[subName] =
						(taskXPBySub[subName] || 0) + xpValue;
				}
			}

			if (this.settings.debugMode) {
				console.log(`🔍 Task XP found:`, taskXPBySub);
			}

			// 2) Process sub-stats
			const subStatFiles = files.filter((file) => {
				const fileCache = this.app.metadataCache.getFileCache(file);
				return (
					fileCache?.tags?.some(
						(tag) => tag.tag === `#${this.settings.subStatTag}`
					) ||
					fileCache?.frontmatter?.tags?.includes(
						this.settings.subStatTag
					)
				);
			});

			const subStatsData: Record<string, SubStatData> = {};
			const mainStatToSubs: Record<string, string[]> = {};

			for (const file of subStatFiles) {
				const subName = file.basename;
				if (subName === "substat tem") continue;

				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter || {};

				let storedTotalXP = 0;
				if (frontmatter["total-xp"] !== undefined) {
					storedTotalXP = Number(frontmatter["total-xp"]) || 0;
				} else if (frontmatter.xp !== undefined) {
					storedTotalXP = Number(frontmatter.xp) || 0;
				}

				const newTaskXP = taskXPBySub[subName] || 0;
				const currentTotalXP = storedTotalXP + newTaskXP;

				const levelInfo =
					this.calculateLevelFromTotalXP(currentTotalXP);
				const mainCategory = this.parseMainCategory(fileCache);

				subStatsData[subName] = {
					level: levelInfo.level,
					xpCurrent: levelInfo.xpCurrent,
					xpNeeded: levelInfo.xpNeeded,
					progress: levelInfo.progress,
					mainCategory: mainCategory,
					totalXP: currentTotalXP,
					newXPEarned: newTaskXP,
					storedTotalXP: storedTotalXP,
				};

				if (!mainStatToSubs[mainCategory])
					mainStatToSubs[mainCategory] = [];
				mainStatToSubs[mainCategory].push(subName);

				if (newTaskXP > 0 || this.settings.forceUpdateFiles) {
					const updates = {
						level: levelInfo.level,
						"xp-current": levelInfo.xpCurrent,
						"xp-needed": levelInfo.xpNeeded,
						progress: levelInfo.progress,
						"total-xp": currentTotalXP,
						"main-category": mainCategory,
					};

					await this.safeUpdateInlineFields(file, updates);
				}
			}

			// 3) Process main stats
			const mainStatFiles = files.filter((file) => {
				const fileCache = this.app.metadataCache.getFileCache(file);
				return (
					fileCache?.tags?.some(
						(tag) => tag.tag === `#${this.settings.mainStatTag}`
					) ||
					fileCache?.frontmatter?.tags?.includes(
						this.settings.mainStatTag
					)
				);
			});

			for (const file of mainStatFiles) {
				const mainName = file.basename;
				let assignedSubs: string[] = [];

				if (mainStatToSubs[mainName]) {
					assignedSubs = mainStatToSubs[mainName];
				} else {
					for (const [catName, subs] of Object.entries(
						mainStatToSubs
					)) {
						if (catName.toLowerCase() === mainName.toLowerCase()) {
							assignedSubs = subs;
							break;
						}
					}
				}

				if (assignedSubs.length === 0) continue;

				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter || {};

				let currentMainXP = 0;
				if (frontmatter["total-xp"] !== undefined) {
					currentMainXP = Number(frontmatter["total-xp"]) || 0;
				} else if (frontmatter.xp !== undefined) {
					currentMainXP = Number(frontmatter.xp) || 0;
				}

				let newMainXP = 0;
				for (const subName of assignedSubs) {
					const subData = subStatsData[subName];
					if (subData && subData.newXPEarned > 0) {
						newMainXP += Math.floor(
							subData.newXPEarned * this.settings.mainToSubXPRatio
						);
					}
				}

				const totalMainXP = currentMainXP + newMainXP;
				const mainLevelInfo =
					this.calculateLevelFromTotalXP(totalMainXP);

				const totalSubLevels = assignedSubs.reduce((sum, subName) => {
					return sum + (subStatsData[subName]?.level || 1);
				}, 0);
				const avgSubLevel =
					Math.round((totalSubLevels / assignedSubs.length) * 10) /
					10;

				if (newMainXP > 0 || this.settings.forceUpdateFiles) {
					const mainUpdates = {
						level: mainLevelInfo.level,
						"xp-current": mainLevelInfo.xpCurrent,
						"xp-needed": mainLevelInfo.xpNeeded,
						progress: mainLevelInfo.progress,
						"total-xp": totalMainXP,
						"total-sub-levels": totalSubLevels,
						"avg-sub-level": avgSubLevel,
					};

					await this.safeUpdateInlineFields(file, mainUpdates);
				}
			}

			const totalNewXP = Object.values(taskXPBySub).reduce(
				(sum, xp) => sum + xp,
				0
			);
			const activeSubs = Object.keys(taskXPBySub).length;

			// Show notification
			const message = `XP Sync Complete! Total XP: ${totalNewXP}, Active skills: ${activeSubs}`;
			new Notice(message);
			console.log(message);
		} catch (err) {
			console.error("❗ XP Sync Error:", err);
			new Notice(`XP Sync Error: ${err}`);
		}
	}

	async getLineText(file: TFile, lineNumber: number): Promise<string> {
		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		return lines[lineNumber] || "";
	}

	async showRadarChart() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("Please open a note to insert the radar chart");
			return;
		}

		const chartCode = "```xp-radar\n# XP System Radar Chart\n```";

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const editor = view.editor;
			editor.replaceSelection(chartCode);
		}
	}

	async processRadarChart(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	) {
		try {
			const files = this.app.vault.getMarkdownFiles();
			const mainStatFiles = files.filter((file) => {
				const fileCache = this.app.metadataCache.getFileCache(file);
				return (
					fileCache?.tags?.some(
						(tag) => tag.tag === `#${this.settings.mainStatTag}`
					) ||
					fileCache?.frontmatter?.tags?.includes(
						this.settings.mainStatTag
					)
				);
			});

			const mainStatsData: MainStatData[] = [];

			for (const file of mainStatFiles) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter || {};

				let totalXP = 0;
				if (frontmatter["total-xp"] !== undefined) {
					totalXP = Number(frontmatter["total-xp"]) || 0;
				} else if (frontmatter.xp !== undefined) {
					totalXP = Number(frontmatter.xp) || 0;
				}

				const levelInfo = this.calculateLevelFromTotalXP(totalXP);

				mainStatsData.push({
					name: file.basename,
					level: levelInfo.level,
					progress: levelInfo.progress,
				});
			}

			if (mainStatsData.length === 0) {
				el.innerHTML =
					'<div style="text-align: center; padding: 20px; color: #666;">No main stats found</div>';
				return;
			}

			const chartHTML = this.generateRadarChartHTML(mainStatsData);
			el.innerHTML = chartHTML;
		} catch (err) {
			console.error("Error processing radar chart:", err);
			el.innerHTML = `<div style="color: red;">Error generating radar chart: ${err}</div>`;
		}
	}

	generateRadarChartHTML(mainStatsData: MainStatData[]): string {
		const size = 300;
		const center = size / 2;
		const radius = center - 50;
		const numStats = mainStatsData.length;

		let svgContent = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <!-- Background circles -->
        ${[20, 40, 60, 80, 100]
			.map((percent) => {
				const r = (radius * percent) / 100;
				return `<circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="#ddd" stroke-width="1"/>`;
			})
			.join("")}
        
        <!-- Axis lines -->
        ${mainStatsData
			.map((stat, i) => {
				const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
				const x = center + radius * Math.cos(angle);
				const y = center + radius * Math.sin(angle);
				return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="#ddd" stroke-width="1"/>`;
			})
			.join("")}
        
        <!-- Data polygon -->
        <polygon points="${mainStatsData
			.map((stat, i) => {
				const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
				const normalizedLevel = Math.min(stat.level * 10, 100); // Scale levels for visibility
				const r = (radius * normalizedLevel) / 100;
				const x = center + r * Math.cos(angle);
				const y = center + r * Math.sin(angle);
				return `${x},${y}`;
			})
			.join(" ")}" 
        fill="rgba(75,192,192,0.4)" 
        stroke="rgba(75,192,192,1)" 
        stroke-width="2"/>
        
        <!-- Data points -->
        ${mainStatsData
			.map((stat, i) => {
				const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
				const normalizedLevel = Math.min(stat.level * 10, 100);
				const r = (radius * normalizedLevel) / 100;
				const x = center + r * Math.cos(angle);
				const y = center + r * Math.sin(angle);
				return `<circle cx="${x}" cy="${y}" r="4" fill="rgba(75,192,192,1)"/>`;
			})
			.join("")}
        
        <!-- Labels -->
        ${mainStatsData
			.map((stat, i) => {
				const angle = (i * 2 * Math.PI) / numStats - Math.PI / 2;
				const labelRadius = radius + 20;
				const x = center + labelRadius * Math.cos(angle);
				const y = center + labelRadius * Math.sin(angle);
				return `
            <text x="${x}" y="${y}" text-anchor="middle" dy="5" font-size="12" fill="#333">
              ${stat.name}
            </text>
            <text x="${x}" y="${
					y + 15
				}" text-anchor="middle" dy="5" font-size="10" fill="#666">
              Lvl ${stat.level}
            </text>
          `;
			})
			.join("")}
      </svg>
    `;

		return `
      <div style="text-align: center; padding: 20px;">
        <h3>Character Stats Radar</h3>
        ${svgContent}
        <div style="margin-top: 15px; font-size: 12px; color: #666;">
          Last updated: ${new Date().toLocaleString()}
        </div>
      </div>
    `;
	}
}

class XPSystemSettingTab extends PluginSettingTab {
	plugin: XPSystemPlugin;

	constructor(app: App, plugin: XPSystemPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "XP System Settings" });

		new Setting(containerEl)
			.setName("Sub-stat tag")
			.setDesc("Tag used to identify sub-stat files (without #)")
			.addText((text) =>
				text
					.setPlaceholder("substat")
					.setValue(this.plugin.settings.subStatTag)
					.onChange(async (value) => {
						this.plugin.settings.subStatTag = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Main stat tag")
			.setDesc("Tag used to identify main stat files (without #)")
			.addText((text) =>
				text
					.setPlaceholder("stat")
					.setValue(this.plugin.settings.mainStatTag)
					.onChange(async (value) => {
						this.plugin.settings.mainStatTag = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("XP multiplier")
			.setDesc("Base XP needed for level 1 (affects all levels)")
			.addSlider((slider) =>
				slider
					.setLimits(50, 500, 25)
					.setValue(this.plugin.settings.xpMultiplier)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.xpMultiplier = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Level formula exponent")
			.setDesc(
				"Formula exponent for XP calculation (1.0 = linear, 1.5 = default, 2.0 = quadratic)"
			)
			.addSlider((slider) =>
				slider
					.setLimits(1.0, 3.0, 0.1)
					.setValue(parseFloat(this.plugin.settings.levelFormula))
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.levelFormula = value.toFixed(1);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Main to Sub XP ratio")
			.setDesc("Percentage of sub-stat XP that goes to main stats")
			.addSlider((slider) =>
				slider
					.setLimits(0.1, 0.5, 0.05)
					.setValue(this.plugin.settings.mainToSubXPRatio)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.mainToSubXPRatio = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Force update files")
			.setDesc("Enable to actually save XP progress to files")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.forceUpdateFiles)
					.onChange(async (value) => {
						this.plugin.settings.forceUpdateFiles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc("Enable detailed logging for troubleshooting")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-sync on startup")
			.setDesc("Automatically run XP sync when Obsidian starts")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSyncOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Usage" });

		const usageDiv = containerEl.createDiv();
		usageDiv.innerHTML = `
      <p><strong>XP Tasks:</strong> Add XP to tasks like this:</p>
      <ul>
        <li><code>- [x] Complete workout #xp/Physical +5</code></li>
        <li><code>- [x] Read book chapter #xp/[[Intellectual]] +3</code></li>
      </ul>
      
      <p><strong>Radar Chart:</strong> Use in any note:</p>
      <pre><code>\`\`\`xp-radar
# XP System Radar Chart
\`\`\`</code></pre>
      
      <p><strong>Manual Sync:</strong> Use the ribbon icon or command palette.</p>
    `;
	}
}
