import { App, PluginSettingTab, Setting } from "obsidian";
import type XPPlugin from "../main";

export interface XPSettings {
	xpMultiplier: number;
	stats: string[];
	debug: boolean;
	axisColor: string;
	axisOpacity: number;
	axisWidth: number;
	labelFontSize: number;
	labelFontWeight: string;
	labelTextShadow: string;
}

export const DEFAULT_SETTINGS: XPSettings = {
	xpMultiplier: 1,
	stats: ["Strength", "Intelligence", "Wisdom", "Charisma", "Dexterity"],
	debug: false,
	axisColor: "#fff",
	axisOpacity: 0.3,
	axisWidth: 2,
	labelFontWeight: "bold",
	labelFontSize: 16,
	labelTextShadow: "0 0 6px #000, 0 0 2px #000",
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

		new Setting(containerEl)
			.setName("Axis color")
			.setDesc("Color of the axis lines")
			.addColorPicker((picker) =>
				picker
					.setValue(this.plugin.settings.axisColor || "#fff")
					.onChange(async (value) => {
						this.plugin.settings.axisColor = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Axis opacity")
			.setDesc("Opacity of the axis lines (0.0 - 1.0)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(this.plugin.settings.axisOpacity ?? 0.3)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.axisOpacity = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Axis width")
			.setDesc("Stroke width of axis lines")
			.addSlider((slider) =>
				slider
					.setLimits(1, 8, 1)
					.setValue(this.plugin.settings.axisWidth || 2)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.axisWidth = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Label font size")
			.setDesc("Font size for stat labels")
			.addSlider((slider) =>
				slider
					.setLimits(10, 32, 1)
					.setValue(this.plugin.settings.labelFontSize || 16)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.labelFontSize = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Label font weight")
			.setDesc("Font weight for stat labels (e.g. bold, 700)")
			.addText((text) =>
				text
					.setPlaceholder("bold")
					.setValue(this.plugin.settings.labelFontWeight || "bold")
					.onChange(async (value) => {
						this.plugin.settings.labelFontWeight = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Label text shadow")
			.setDesc("CSS text-shadow for stat labels")
			.addText((text) =>
				text
					.setPlaceholder("0 0 6px #000, 0 0 2px #000")
					.setValue(
						this.plugin.settings.labelTextShadow ||
							"0 0 6px #000, 0 0 2px #000"
					)
					.onChange(async (value) => {
						this.plugin.settings.labelTextShadow = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
