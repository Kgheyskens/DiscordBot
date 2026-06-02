const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const dataDir = path.join(__dirname, '../data');
const remindersFile = path.join(dataDir, 'reminders.json');

function readReminders() {
	return readJson(remindersFile, {});
}

function writeReminders(data) {
	writeJson(remindersFile, data);
}

function createReminder(guildId, userId, channelId, content, fireAt, type = 'user') {
	const all = readReminders();
	const guild = all[guildId] || {};

	const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	guild[reminderId] = {
		userId,
		channelId,
		type,
		content,
		fireAt,
		recurring: false,
		recurringType: null,
	};

	all[guildId] = guild;
	writeReminders(all);

	return reminderId;
}

function getReminders(guildId, userId) {
	const all = readReminders();
	const guild = all[guildId] || {};
	return Object.values(guild).filter(r => r.userId === userId);
}

function getExpiredReminders(guildId) {
	const all = readReminders();
	const guild = all[guildId] || {};
	const now = Date.now();

	return Object.entries(guild)
		.filter(([_, reminder]) => reminder.fireAt <= now)
		.map(([id, reminder]) => ({ id, ...reminder }));
}

function deleteReminder(guildId, reminderId) {
	const all = readReminders();
	if (all[guildId]) {
		delete all[guildId][reminderId];
		writeReminders(all);
	}
}

function updateReminderTime(guildId, reminderId, newFireAt) {
	const all = readReminders();
	if (all[guildId]?.[reminderId]) {
		all[guildId][reminderId].fireAt = newFireAt;
		writeReminders(all);
	}
}

module.exports = {
	createReminder,
	getReminders,
	getExpiredReminders,
	deleteReminder,
	updateReminderTime,
};
