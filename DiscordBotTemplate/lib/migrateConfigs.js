const path = require('path');
const fs = require('fs');
const { readJson } = require('./jsonStore');
const { getSettings, saveSettings } = require('./guildSettings');

const dataDir = path.join(__dirname, '..', 'data');

function migrateGuildConfigs() {
	const sources = {
		welcome: path.join(dataDir, 'welcomeConfig.json'),
		levels: path.join(dataDir, 'levelsChannel.json'),
		counting: path.join(dataDir, 'countingConfig.json'),
		crowns: path.join(dataDir, 'crownsConfig.json'),
		ticketPanels: path.join(dataDir, 'ticketPanels.json'),
	};

	const guildIds = new Set();
	for (const file of Object.values(sources)) {
		if (!fs.existsSync(file)) continue;
		const data = readJson(file, {});
		Object.keys(data).forEach(id => guildIds.add(id));
	}

	if (guildIds.size === 0) return 0;

	let migrated = 0;
	for (const guildId of guildIds) {
		const current = getSettings(guildId);
		const patch = { channels: {}, roles: {}, welcome: {}, counting: {}, economy: {} };

		const welcome = readJson(sources.welcome, {})[guildId];
		if (welcome?.channelId && !current.channels.welcome) {
			patch.channels.welcome = welcome.channelId;
			patch.welcome.enabled = true;
		}

		const levels = readJson(sources.levels, {})[guildId];
		if (levels?.channelId && !current.channels.levels) {
			patch.channels.levels = levels.channelId;
		}

		const counting = readJson(sources.counting, {})[guildId];
		if (counting?.channelId && !current.channels.counting) {
			patch.channels.counting = counting.channelId;
			patch.counting.enabled = true;
		}

		const crowns = readJson(sources.crowns, {})[guildId];
		if (crowns) {
			if (typeof crowns.enabled === 'boolean') patch.economy.enabled = crowns.enabled;
			if (typeof crowns.chancePercent === 'number') patch.economy.crownSpawnChance = crowns.chancePercent;
		}

		const tickets = readJson(sources.ticketPanels, {})[guildId];
		if (tickets) {
			if (tickets.channelId && !current.channels.ticketPanel) patch.channels.ticketPanel = tickets.channelId;
			if (tickets.categoryId && !current.channels.ticketCategory) patch.channels.ticketCategory = tickets.categoryId;
			if (tickets.supportRoleId && !current.roles.ticketSupport) patch.roles.ticketSupport = tickets.supportRoleId;
		}

		saveSettings(guildId, patch);
		migrated += 1;
	}

	return migrated;
}

module.exports = { migrateGuildConfigs };
