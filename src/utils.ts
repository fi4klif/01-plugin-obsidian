import { Notice } from "obsidian";

/**
 * Debug logger (показує тільки якщо debug=true)
 */
export function logDebug(debug: boolean, ...args: any[]) {
	if (debug) {
		console.log("[XP Plugin]", ...args);
	}
}

/**
 * Показати повідомлення в Obsidian
 */
export function notify(msg: string, timeout: number = 3000) {
	new Notice(`⚡ XP: ${msg}`, timeout);
}

/**
 * Парсинг тегу виду #xp/Stat+10
 * Повертає { stat: "Stat", amount: 10 }
 */
export function parseXPTag(
	tag: string
): { stat: string; amount: number } | null {
	const match = /#xp\/(\w+)\+(\d+)/.exec(tag);
	if (!match) return null;

	return {
		stat: match[1],
		amount: parseInt(match[2], 10),
	};
}

/**
 * Нормалізувати значення (наприклад, для радар-чарту)
 * value → від 0 до max
 */
export function normalize(value: number, max: number): number {
	if (max === 0) return 0;
	return Math.max(0, Math.min(1, value / max));
}

/**
 * Розрахунок рівня з XP (класична формула)
 * Наприклад: кожні 100 XP = +1 lvl
 */
export function calculateLevel(xp: number, xpPerLevel: number = 100): number {
	return Math.floor(xp / xpPerLevel);
}
