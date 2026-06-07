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

// Legacy entries zijn DDMM-strings; nieuwe entries zijn { day, month, year|null }
function normalize(entry) {
	if (!entry) return null;
	if (typeof entry === 'string') {
		return {
			day: parseInt(entry.slice(0, 2), 10),
			month: parseInt(entry.slice(2, 4), 10),
			year: null,
		};
	}
	return entry;
}

function setBirthday(guildId, userId, { day, month, year = null }) {
	if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) {
		throw new Error('Ongeldige datum.');
	}
	const all = readBirthdays();
	const guild = all[guildId] || {};
	guild[userId] = { day, month, year };
	all[guildId] = guild;
	writeBirthdays(all);
}

function getBirthday(guildId, userId) {
	const all = readBirthdays();
	return normalize(all[guildId]?.[userId]);
}

function getTodaysBirthdays(guildId) {
	const all = readBirthdays();
	const guild = all[guildId] || {};

	const today = new Date();
	const day = today.getDate();
	const month = today.getMonth() + 1;
	const currentYear = today.getFullYear();

	return Object.entries(guild)
		.map(([userId, entry]) => ({ userId, ...normalize(entry) }))
		.filter(b => b.day === day && b.month === month)
		.map(b => ({ userId: b.userId, age: b.year ? currentYear - b.year : null }));
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
