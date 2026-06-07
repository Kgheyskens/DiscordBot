const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const countingSavesFile = path.join(__dirname, '..', 'data', 'countingSaves.json');

function getCountingSaves(guildId, userId) {
	const all = readJson(countingSavesFile, {});
	return all[guildId]?.[userId] || 0;
}

function setCountingSaves(guildId, userId, amount) {
	const all = readJson(countingSavesFile, {});
	const guildSaves = all[guildId] || {};
	guildSaves[userId] = Math.max(0, amount);
	all[guildId] = guildSaves;
	writeJson(countingSavesFile, all);
	return guildSaves[userId];
}

function addCountingSaves(guildId, userId, amount) {
	return setCountingSaves(guildId, userId, getCountingSaves(guildId, userId) + amount);
}

module.exports = {
	countingSavesFile,
	getCountingSaves,
	setCountingSaves,
	addCountingSaves,
};
