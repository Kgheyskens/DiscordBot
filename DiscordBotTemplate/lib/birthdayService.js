const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const dataDir = path.join(__dirname, '../data');
const birthdaysFile = path.join(dataDir, 'birthdays.json');

function readBirthdays() {
	return readJson(birthdaysFile, {});
}

function writeBirthdays(data) {
	writeJson(birthdaysFile, data);
}

function setBirthday(guildId, userId, ddmmFormat) {
	if (!/^\d{4}$/.test(ddmmFormat)) {
		throw new Error('Birthday format must be DDMM (e.g., 0512 for May 12)');
	}

	const all = readBirthdays();
	const guild = all[guildId] || {};
	guild[userId] = ddmmFormat;
	all[guildId] = guild;
	writeBirthdays(all);
}

function getBirthday(guildId, userId) {
	const all = readBirthdays();
	return all[guildId]?.[userId] || null;
}

function getTodaysBirthdays(guildId) {
	const all = readBirthdays();
	const guild = all[guildId] || {};

	const today = new Date();
	const todayDDMM = String(today.getDate()).padStart(2, '0') + String(today.getMonth() + 1).padStart(2, '0');

	return Object.entries(guild)
		.filter(([_, ddmm]) => ddmm === todayDDMM)
		.map(([userId]) => userId);
}

function deleteBirthday(guildId, userId) {
	const all = readBirthdays();
	if (all[guildId]) {
		delete all[guildId][userId];
		writeBirthdays(all);
	}
}

module.exports = {
	setBirthday,
	getBirthday,
	getTodaysBirthdays,
	deleteBirthday,
};
