const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const afkFile = path.join(__dirname, '..', 'data', 'afk.json');

function readAll() { return readJson(afkFile, {}); }
function writeAll(data) { writeJson(afkFile, data); }

function getAfk(guildId, userId) {
	const all = readAll();
	return all[guildId]?.[userId] || null;
}

function setAfk(guildId, userId, reason) {
	const all = readAll();
	all[guildId] = all[guildId] || {};
	all[guildId][userId] = { reason: (reason || 'AFK').slice(0, 200), since: Date.now() };
	writeAll(all);
	return all[guildId][userId];
}

function clearAfk(guildId, userId) {
	const all = readAll();
	if (!all[guildId]?.[userId]) return null;
	const removed = all[guildId][userId];
	delete all[guildId][userId];
	writeAll(all);
	return removed;
}

function formatDuration(ms) {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ${sec % 60}s`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}u ${min % 60}m`;
	const day = Math.floor(hr / 24);
	return `${day}d ${hr % 24}u`;
}

module.exports = { afkFile, getAfk, setAfk, clearAfk, formatDuration };
