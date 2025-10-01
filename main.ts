import { Plugin, Notice } from "obsidian";
import { XPSettingsTab, DEFAULT_SETTINGS, XPSettings } from "./src/settings";
import { parseTasksAndCalculateXP } from "./src/xp-logic";
import { renderRadar } from "./src/xp-radar";

export default class XPPlugin extends Plugin {
	settings: XPSettings;

	async onload() {
		console.log("Loading XP Plugin 🚀");

		// Завантаження налаштувань
		await this.loadSettings();

		// Додати таб налаштувань
		this.addSettingTab(new XPSettingsTab(this.app, this));

		// Команда для оновлення XP вручну
		this.addCommand({
			id: "recalculate-xp",
			name: "Recalculate XP",
			callback: async () => {
				await parseTasksAndCalculateXP(this.app, this.settings);
				new Notice("XP recalculated ✅");
			},
		});

		// Код-блок для radar chart
		this.registerMarkdownCodeBlockProcessor("xp-radar", (src, el) => {
			renderRadar(el, this.settings);
		});
	}

	onunload() {
		console.log("Unloading XP Plugin ❌");
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
}
