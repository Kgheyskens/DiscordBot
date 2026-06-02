const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const dataDir = path.join(__dirname, '../data');
const bumpTimersFile = path.join(dataDir, 'bumpTimers.json');

const BUMP_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

function readBumpTimers() {
	return readJson(bumpTimersFile, {});
}

function writeBumpTimers(data) {
	writeJson(bumpTimersFile, data);
}

function logBump(guildId) {
	const all = readBumpTimers();
	const guild = all[guildId] || {};
	guild.lastBumpAt = Date.now();
	guild.nextReminderAt = Date.now() + BUMP_COOLDOWN_MS;
	all[guildId] = guild;
	writeBumpTimers(all);
}

function getLastBumpTime(guildId) {
	const all = readBumpTimers();
	return all[guildId]?.lastBumpAt || null;
}

function shouldPostBumpReminder(guildId) {
	const all = readBumpTimers();
	const guild = all[guildId] || {};
	if (!guild.nextReminderAt) return false;
	return Date.now() >= guild.nextReminderAt;
}

function setBumpReminderRole(guildId, roleId) {
	const all = readBumpTimers();
	const guild = all[guildId] || {};
	guild.bumpReminderRoleId = roleId;
	all[guildId] = guild;
	writeBumpTimers(all);
}

function getBumpReminderRole(guildId) {
	const all = readBumpTimers();
	return all[guildId]?.bumpReminderRoleId || null;
}

function getNextBumpReminderTime(guildId) {
	const all = readBumpTimers();
	return all[guildId]?.nextReminderAt || null;
}

module.exports = {
	logBump,
	getLastBumpTime,
	shouldPostBumpReminder,
	setBumpReminderRole,
	getBumpReminderRole,
	getNextBumpReminderTime,
};
