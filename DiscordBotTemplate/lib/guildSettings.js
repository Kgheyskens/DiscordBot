const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const guildSettingsFile = path.join(__dirname, '..', 'data', 'guildSettings.json');

const DEFAULT_SETTINGS = {
	channels: {
		welcome: null,
		levels: null,
		counting: null,
		twitch: null,
		ticketCategory: null,
		ticketPanel: null,
		modlog: null,
		challenge: null,
		halloffame: null,
	},
	roles: {
		ticketSupport: null,
	},
	economy: {
		enabled: false,
		crownSpawnChance: 5,
		workMin: 18,
		workMax: 60,
		dailyMin: 85,
		dailyMax: 220,
		workCooldownMinutes: 60,
		dailyCooldownHours: 24,
		payTaxPercent: 5,
		robCooldownHours: 6,
		robSuccessChance: 35,
		robMaxStealPercent: 25,
		robFailFeePercent: 10,
		robMinVictimBalance: 100,
	},
	welcome: {
		enabled: false,
		mode: 'channel',
		message: 'Welkom {user}, je bent nu lid nummer **{count}**.',
	},
	counting: {
		enabled: false,
		saveCost: 50,
	},
	minigames: {
		wordle: { enabled: true, channelId: null, rewardCrowns: 5 },
		hangman: { enabled: true, channelId: null, rewardCrowns: 5 },
		minesweeper: { enabled: true, channelId: null, rewardCrowns: 5 },
	},
	crownshop: {
		xpPerCrown: 25,
	},
	challenge: {
		enabled: false,
		postHour: 9,
		rewardKroontjes: 10,
		customPuzzles: [],
	},
	hallOfFame: {
		enabled: false,
		postDay: 1,
		postHour: 10,
	},
	applicationRoles: [],
};

function deepMerge(target, source) {
	const result = { ...target };
	for (const key of Object.keys(source || {})) {
		if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
			result[key] = deepMerge(target?.[key] || {}, source[key]);
		} else if (source[key] !== undefined) {
			result[key] = source[key];
		}
	}
	return result;
}

function readAll() {
	return readJson(guildSettingsFile, {});
}

function writeAll(data) {
	writeJson(guildSettingsFile, data);
}

function getSettings(guildId) {
	if (!guildId) return deepMerge({}, DEFAULT_SETTINGS);
	const all = readAll();
	return deepMerge(DEFAULT_SETTINGS, all[guildId] || {});
}

function saveSettings(guildId, partial) {
	const all = readAll();
	const current = deepMerge(DEFAULT_SETTINGS, all[guildId] || {});
	const next = deepMerge(current, partial || {});
	all[guildId] = next;
	writeAll(all);
	return next;
}

function setChannel(guildId, key, channelId) {
	return saveSettings(guildId, { channels: { [key]: channelId || null } });
}

function setRole(guildId, key, roleId) {
	return saveSettings(guildId, { roles: { [key]: roleId || null } });
}

function setEconomy(guildId, partial) {
	return saveSettings(guildId, { economy: partial || {} });
}

function setWelcome(guildId, partial) {
	return saveSettings(guildId, { welcome: partial || {} });
}

function setCounting(guildId, partial) {
	return saveSettings(guildId, { counting: partial || {} });
}

function setMinigame(guildId, game, partial) {
	return saveSettings(guildId, { minigames: { [game]: partial || {} } });
}

function setCrownshop(guildId, partial) {
	return saveSettings(guildId, { crownshop: partial || {} });
}

function setChallenge(guildId, partial) {
	return saveSettings(guildId, { challenge: partial || {} });
}

function setHallOfFame(guildId, partial) {
	return saveSettings(guildId, { hallOfFame: partial || {} });
}

function getApplicationRoles(guildId) {
	const settings = getSettings(guildId);
	return Array.isArray(settings.applicationRoles) ? settings.applicationRoles : [];
}

function setApplicationRoles(guildId, roles) {
	const list = Array.isArray(roles) ? roles : [];
	return saveSettings(guildId, { applicationRoles: list });
}

function addApplicationRole(guildId, { label, roleId = null, available = true }) {
	const cleanedLabel = String(label || '').trim().slice(0, 80);
	if (!cleanedLabel) return { error: '❌ Geef een naam voor de rol op.' };
	const list = getApplicationRoles(guildId);
	if (list.length >= 25) return { error: '❌ Maximum 25 sollicitatie-rollen.' };
	if (list.some(r => r.label.toLowerCase() === cleanedLabel.toLowerCase())) {
		return { error: '❌ Er bestaat al een rol met die naam.' };
	}
	const id = `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	const entry = { id, label: cleanedLabel, roleId: roleId || null, available: Boolean(available) };
	setApplicationRoles(guildId, [...list, entry]);
	return { entry };
}

function updateApplicationRole(guildId, id, patch) {
	const list = getApplicationRoles(guildId);
	const idx = list.findIndex(r => r.id === id);
	if (idx === -1) return { error: '❌ Rol niet gevonden.' };
	const next = { ...list[idx] };
	if (patch.label !== undefined) {
		const cleaned = String(patch.label || '').trim().slice(0, 80);
		if (!cleaned) return { error: '❌ Naam mag niet leeg zijn.' };
		next.label = cleaned;
	}
	if (patch.roleId !== undefined) next.roleId = patch.roleId || null;
	if (patch.available !== undefined) next.available = Boolean(patch.available);
	const copy = [...list];
	copy[idx] = next;
	setApplicationRoles(guildId, copy);
	return { entry: next };
}

function removeApplicationRole(guildId, id) {
	const list = getApplicationRoles(guildId);
	const next = list.filter(r => r.id !== id);
	if (next.length === list.length) return { error: '❌ Rol niet gevonden.' };
	setApplicationRoles(guildId, next);
	return { ok: true };
}

function resetSection(guildId, section) {
	if (!DEFAULT_SETTINGS[section]) return null;
	const all = readAll();
	const current = deepMerge(DEFAULT_SETTINGS, all[guildId] || {});
	current[section] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS[section]));
	all[guildId] = current;
	writeAll(all);
	return current;
}

module.exports = {
	guildSettingsFile,
	DEFAULT_SETTINGS,
	getSettings,
	saveSettings,
	setChannel,
	setRole,
	setEconomy,
	setWelcome,
	setCounting,
	setMinigame,
	setCrownshop,
	setChallenge,
	setHallOfFame,
	getApplicationRoles,
	setApplicationRoles,
	addApplicationRole,
	updateApplicationRole,
	removeApplicationRole,
	resetSection,
};
