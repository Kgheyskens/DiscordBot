const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const dataDir = path.join(__dirname, '../data');
const warningsFile = path.join(dataDir, 'warnings.json');

function readWarnings() {
	return readJson(warningsFile, {});
}

function writeWarnings(data) {
	writeJson(warningsFile, data);
}

function warnUser(guildId, userId, reason, modId) {
	const all = readWarnings();
	const guild = all[guildId] || {};
	if (!guild[userId]) {
		guild[userId] = [];
	}

	const warningId = `warn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	guild[userId].push({
		id: warningId,
		reason,
		warnedBy: modId,
		warnedAt: Date.now(),
		autoAction: null,
	});

	all[guildId] = guild;
	writeWarnings(all);

	return guild[userId].length;
}

function getWarnings(guildId, userId) {
	const all = readWarnings();
	return all[guildId]?.[userId] || [];
}

function getWarningCount(guildId, userId) {
	return getWarnings(guildId, userId).length;
}

function clearWarnings(guildId, userId) {
	const all = readWarnings();
	if (all[guildId]) {
		delete all[guildId][userId];
		writeWarnings(all);
	}
}

module.exports = {
	warnUser,
	getWarnings,
	getWarningCount,
	clearWarnings,
};
