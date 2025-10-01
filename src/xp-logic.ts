import { App, TFile } from "obsidian";
import { XPSettings } from "./settings";

export async function parseTasksAndCalculateXP(app: App, settings: XPSettings) {
	const files = app.vault.getMarkdownFiles();
	let totalXP = 0;

	for (const file of files) {
		const content = await app.vault.read(file);
		const matches = content.match(/#xp\/(\w+)\+(\d+)/g);

		if (matches) {
			for (const match of matches) {
				const [, stat, amount] = /#xp\/(\w+)\+(\d+)/.exec(match);
				const xp = parseInt(amount) * settings.xpMultiplier;
				totalXP += xp;

				if (settings.debug) {
					console.log(`+${xp} XP → ${stat} (from ${file.path})`);
				}
			}
		}
	}

	if (settings.debug) console.log(`Total XP: ${totalXP}`);
	return totalXP;
}
