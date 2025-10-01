// statsManager.ts
import { App, TFile } from "obsidian";

interface XPSettings {
	subStatTag: string;
	mainStatTag: string;
	xpMultiplier: number;
	levelFormula: string | number;
	mainToSubXPRatio: number;
	debugMode: boolean;
}

interface LevelInfo {
	level: number;
	xpCurrent: number;
	xpNeeded: number;
	progress: number;
}

export interface SubStatData {
	filePath: string;
	fileName: string;
	level: number;
	xpCurrent: number;
	xpNeeded: number;
	progress: number;
	mainCategory: string;
	totalXP: number;
	newXPEarned: number;
	storedTotalXP: number;
}

export interface MainStatData {
	filePath?: string;
	name: string;
	level: number;
	xpCurrent?: number;
	xpNeeded?: number;
	progress: number;
	totalXP?: number;
	newMainXP?: number;
	assignedSubs?: string[];
}

/** internal helpers */
function xpNeededForLevel(settings: XPSettings, lvl: number) {
	return Math.floor(
		settings.xpMultiplier *
			Math.pow(lvl, parseFloat(String(settings.levelFormula)))
	);
}

function calculateLevelFromTotalXP(
	settings: XPSettings,
	totalXP: number
): LevelInfo {
	if (!totalXP || totalXP < 0)
		return {
			level: 1,
			xpCurrent: 0,
			xpNeeded: xpNeededForLevel(settings, 1),
			progress: 0,
		};

	let level = 1;
	let xpSpent = 0;
	while (true) {
		const xpForThisLevel = xpNeededForLevel(settings, level);
		if (xpSpent + xpForThisLevel > totalXP) break;
		xpSpent += xpForThisLevel;
		level++;
	}
	const xpCurrent = totalXP - xpSpent;
	const xpNeeded = xpNeededForLevel(settings, level);
	const progress = Math.round((xpCurrent / xpNeeded) * 100);
	return { level, xpCurrent, xpNeeded, progress };
}

/**
 * computeLiveStats
 * Сканує vault, підраховує taskXPBySub, subStatsData і mainStatsData,
 * і повертає об'єкти для рендера (НЕ записує нічого у файли).
 */
export async function computeLiveStats(app: App, settings: XPSettings) {
	const xpTagRegex = /#xp\/\s*(?:\[\[([^\]]+)\]\]|([^\s\+]+))/i;
	const xpNumberRegex = /\+(\d+)/;

	const taskXPBySub: Record<string, number> = {};
	const files = app.vault.getMarkdownFiles();

	// 1) Scan tasks for #xp/ tags (like в original runXPSync)
	for (const file of files) {
		const fileCache = app.metadataCache.getFileCache(file);
		if (!fileCache?.listItems) continue;

		const content = await app.vault.read(file);
		const lines = content.split("\n");

		for (const listItem of fileCache.listItems) {
			if (!listItem.task || listItem.task !== "x") continue;
			const lineIdx = listItem.position?.start?.line ?? -1;
			const lineText = lines[lineIdx] || "";
			if (!lineText.includes("#xp/")) continue;

			const tagMatch = lineText.match(xpTagRegex);
			if (!tagMatch) continue;
			const subName = (tagMatch[1] || tagMatch[2]).trim();
			if (!subName || subName === "substat tem") continue;

			const xpMatch = lineText.match(xpNumberRegex);
			const xpValue = xpMatch ? parseInt(xpMatch[1], 10) : 1;

			taskXPBySub[subName] = (taskXPBySub[subName] || 0) + xpValue;
		}
	}

	if (settings.debugMode) {
		console.log("🔍 [computeLiveStats] taskXPBySub:", taskXPBySub);
	}

	// 2) Collect sub stat files
	const subStatFiles = files.filter((file: TFile) => {
		const fileCache = app.metadataCache.getFileCache(file);
		return (
			fileCache?.tags?.some(
				(tag) => tag.tag === `#${settings.subStatTag}`
			) ||
			(Array.isArray(fileCache?.frontmatter?.tags) &&
				fileCache.frontmatter.tags.includes(settings.subStatTag))
		);
	});

	const subStatsData: Record<string, SubStatData> = {};
	const mainStatToSubs: Record<string, string[]> = {};

	for (const file of subStatFiles) {
		const subName = file.basename;
		if (subName === "substat tem") continue;

		const fileCache = app.metadataCache.getFileCache(file);
		const frontmatter = fileCache?.frontmatter || {};

		let storedTotalXP = 0;
		if (frontmatter["total-xp"] !== undefined) {
			storedTotalXP = Number(frontmatter["total-xp"]) || 0;
		} else if (frontmatter.xp !== undefined) {
			storedTotalXP = Number(frontmatter.xp) || 0;
		}

		const newTaskXP = taskXPBySub[subName] || 0;
		const currentTotalXP = storedTotalXP + newTaskXP;
		const levelInfo = calculateLevelFromTotalXP(settings, currentTotalXP);

		// parse main category similar to original parseMainCategory logic (best-effort)
		let mainCategory = "Misc";
		try {
			if (fileCache?.frontmatter) {
				const fm = fileCache.frontmatter;
				if (
					fm.categories &&
					Array.isArray(fm.categories) &&
					fm.categories.length > 0
				) {
					mainCategory = String(fm.categories[0]);
				} else if (fm.category) mainCategory = String(fm.category);
				else if (fm["main-category"])
					mainCategory = String(fm["main-category"]);
			}
		} catch (e) {
			mainCategory = "Misc";
		}

		subStatsData[subName] = {
			filePath: file.path,
			fileName: subName,
			level: levelInfo.level,
			xpCurrent: levelInfo.xpCurrent,
			xpNeeded: levelInfo.xpNeeded,
			progress: levelInfo.progress,
			mainCategory,
			totalXP: currentTotalXP,
			newXPEarned: newTaskXP,
			storedTotalXP,
		};

		if (!mainStatToSubs[mainCategory]) mainStatToSubs[mainCategory] = [];
		mainStatToSubs[mainCategory].push(subName);
	}

	// 3) Build main stats data (aggregate)
	const mainStatFiles = files.filter((file: TFile) => {
		const fileCache = app.metadataCache.getFileCache(file);
		return (
			fileCache?.tags?.some(
				(tag) => tag.tag === `#${settings.mainStatTag}`
			) ||
			(Array.isArray(fileCache?.frontmatter?.tags) &&
				fileCache.frontmatter.tags.includes(settings.mainStatTag))
		);
	});

	const mainStatsData: MainStatData[] = [];

	for (const file of mainStatFiles) {
		const mainName = file.basename;
		let assignedSubs: string[] = [];

		if (mainStatToSubs[mainName]) {
			assignedSubs = mainStatToSubs[mainName];
		} else {
			for (const [catName, subs] of Object.entries(mainStatToSubs)) {
				if (catName.toLowerCase() === mainName.toLowerCase()) {
					assignedSubs = subs;
					break;
				}
			}
		}

		// determine stored main xp
		const fileCache = app.metadataCache.getFileCache(file);
		const frontmatter = fileCache?.frontmatter || {};
		let storedMainXP = 0;
		if (frontmatter["total-xp"] !== undefined)
			storedMainXP = Number(frontmatter["total-xp"]) || 0;
		else if (frontmatter.xp !== undefined)
			storedMainXP = Number(frontmatter.xp) || 0;

		// new main xp from subs
		let newMainXP = 0;
		for (const subName of assignedSubs) {
			const s = subStatsData[subName];
			if (s && s.newXPEarned > 0) {
				newMainXP += Math.floor(
					s.newXPEarned * settings.mainToSubXPRatio
				);
			}
		}

		const totalMainXP = storedMainXP + newMainXP;
		const mainLevelInfo = calculateLevelFromTotalXP(settings, totalMainXP);

		mainStatsData.push({
			filePath: file.path,
			name: mainName,
			level: mainLevelInfo.level,
			xpCurrent: mainLevelInfo.xpCurrent,
			xpNeeded: mainLevelInfo.xpNeeded,
			progress: mainLevelInfo.progress,
			totalXP: totalMainXP,
			newMainXP,
			assignedSubs,
		});
	}

	if (settings.debugMode) {
		console.log("🔍 [computeLiveStats] subStatsData:", subStatsData);
		console.log("🔍 [computeLiveStats] mainStatsData:", mainStatsData);
	}

	return { taskXPBySub, subStatsData, mainStatsData, mainStatToSubs };
}
