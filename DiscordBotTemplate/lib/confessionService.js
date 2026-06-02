const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const dataDir = path.join(__dirname, '../data');
const confessionsFile = path.join(dataDir, 'confessions.json');

function readConfessions() {
	return readJson(confessionsFile, {});
}

function writeConfessions(data) {
	writeJson(confessionsFile, data);
}

function submitConfession(guildId, content) {
	const all = readConfessions();
	if (!all[guildId]) {
		all[guildId] = [];
	}

	const confessionId = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	all[guildId].push({
		id: confessionId,
		content,
		postedAt: Date.now(),
		reactions: {},
	});

	writeConfessions(all);
	return confessionId;
}

function getConfessions(guildId, limit = 50) {
	const all = readConfessions();
	const guild = all[guildId] || [];
	return guild.slice(-limit);
}

function deleteConfession(guildId, confessionId) {
	const all = readConfessions();
	if (all[guildId]) {
		all[guildId] = all[guildId].filter(c => c.id !== confessionId);
		writeConfessions(all);
	}
}

function addReaction(guildId, confessionId, emoji) {
	const all = readConfessions();
	if (all[guildId]) {
		const confession = all[guildId].find(c => c.id === confessionId);
		if (confession) {
			confession.reactions[emoji] = (confession.reactions[emoji] || 0) + 1;
			writeConfessions(all);
		}
	}
}

module.exports = {
	submitConfession,
	getConfessions,
	deleteConfession,
	addReaction,
};
