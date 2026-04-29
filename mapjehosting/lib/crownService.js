const { readJson, writeJson } = require('./jsonStore');

function readCrownBalances(crownsFile) {
	return readJson(crownsFile, {});
}

function writeCrownBalances(crownsFile, data) {
	writeJson(crownsFile, data);
}

function getBalance(crownsFile, guildId, userId) {
	const allCrowns = readCrownBalances(crownsFile);
	return allCrowns[guildId]?.[userId] || 0;
}

function setBalance(crownsFile, guildId, userId, balance) {
	const allCrowns = readCrownBalances(crownsFile);
	const guildCrowns = allCrowns[guildId] || {};
	guildCrowns[userId] = Math.max(0, balance);
	allCrowns[guildId] = guildCrowns;
	writeCrownBalances(crownsFile, allCrowns);
	return guildCrowns[userId];
}

function addBalance(crownsFile, guildId, userId, amount) {
	const currentBalance = getBalance(crownsFile, guildId, userId);
	return setBalance(crownsFile, guildId, userId, currentBalance + amount);
}

function subtractBalance(crownsFile, guildId, userId, amount) {
	const currentBalance = getBalance(crownsFile, guildId, userId);
	if (currentBalance < amount) {
		return null;
	}

	return setBalance(crownsFile, guildId, userId, currentBalance - amount);
}

function getCrownConfig(crownsConfigFile, guildId) {
	const allConfigs = readJson(crownsConfigFile, {});
	return allConfigs[guildId] || { enabled: false, chancePercent: 5 };
}

function setCrownConfig(crownsConfigFile, guildId, config) {
	const allConfigs = readJson(crownsConfigFile, {});
	allConfigs[guildId] = {
		enabled: Boolean(config.enabled),
		chancePercent: Math.max(1, Math.min(100, config.chancePercent ?? 5)),
	};
	writeJson(crownsConfigFile, allConfigs);
	return allConfigs[guildId];
}

module.exports = {
	getBalance,
	setBalance,
	addBalance,
	subtractBalance,
	getCrownConfig,
	setCrownConfig,
};