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
	resetSection,
};
