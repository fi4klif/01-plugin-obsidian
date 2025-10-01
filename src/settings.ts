import { App, PluginSettingTab, Setting } from "obsidian";
import type XPPlugin from "../main";

export interface XPSettings {
	xpMultiplier: number;
	stats: string[];
	debug: boolean;
}

export const DEFAULT_SETTINGS: XPSettings = {
	xpMultiplier: 1,
	stats: ["Strength", "Intelligence", "Wisdom", "Charisma", "Dexterity"],
	debug: false,
};

export class XPSettingsTab extends PluginSettingTab {
	plugin: XPPlugin & {
		settings: XPSettings;
		saveSettings: () => Promise<void>;
	};

	constructor(
		app: App,
		plugin: XPPlugin & {
			settings: XPSettings;
			saveSettings: () => Promise<void>;
		}
	) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "XP System Settings" });

		new Setting(containerEl)
			.setName("XP Multiplier")
			.setDesc("Adjust how much XP is gained per task")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 3, 0.1)
					.setValue(this.plugin.settings.xpMultiplier)
					.onChange(async (value) => {
						this.plugin.settings.xpMultiplier = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable Debug Mode")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debug)
					.onChange(async (value) => {
						this.plugin.settings.debug = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
