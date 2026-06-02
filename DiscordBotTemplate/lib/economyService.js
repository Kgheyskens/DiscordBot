const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const {
	addBalance,
	getBalance,
	subtractBalance,
} = require('./coinService');
const { getCrownConfig } = require('./crownService');
const { getSettings } = require('./guildSettings');
const { getRobBonus } = require('./effectService');

const coinsFile = path.join(__dirname, '..', 'data', 'coins.json');
const economyTimersFile = path.join(__dirname, '..', 'data', 'economyTimers.json');

const workJobs = [
	'kranten bezorgen',
	'afwas doen',
	'pakketjes sorteren',
	'een reclamecampagne draaien',
	'de vloer schoonmaken',
	'een kleine stream hosten',
	'de hond uitlaten',
	'cadeautjes inpakken',
	'koffie zetten op kantoor',
];

function getRandomInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDuration(ms) {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts = [];
	if (hours > 0) parts.push(`${hours}u`);
	if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
	parts.push(`${seconds}s`);
	return parts.join(' ');
}

function getEconomyConfig(guildId) {
	return getSettings(guildId).economy;
}

function isEconomyEnabled(guildId, crownsConfigFile) {
	const econ = getEconomyConfig(guildId);
	if (econ.enabled) return true;
	if (crownsConfigFile) {
		const legacy = getCrownConfig(crownsConfigFile, guildId);
		return Boolean(legacy?.enabled);
	}
	return false;
}

function readTimers(timersFile = economyTimersFile) {
	return readJson(timersFile, {});
}

function getUserTimers(timersFile, guildId, userId) {
	const allTimers = readTimers(timersFile);
	return allTimers[guildId]?.[userId] || { workAt: 0, dailyAt: 0, robAt: 0, robbedAt: 0 };
}

function setUserTimer(timersFile, guildId, userId, key, value) {
	const allTimers = readTimers(timersFile);
	const guildTimers = allTimers[guildId] || {};
	const userTimers = guildTimers[userId] || { workAt: 0, dailyAt: 0, robAt: 0, robbedAt: 0 };
	userTimers[key] = value;
	guildTimers[userId] = userTimers;
	allTimers[guildId] = guildTimers;
	writeJson(timersFile, allTimers);
	return userTimers;
}

function claimWorkReward({ coinsFile: file, crownsConfigFile, timersFile, guildId, userId }) {
	if (!isEconomyEnabled(guildId, crownsConfigFile)) {
		return { disabled: true };
	}

	const econ = getEconomyConfig(guildId);
	const cooldownMs = Math.max(1, econ.workCooldownMinutes) * 60 * 1000;
	const timers = getUserTimers(timersFile, guildId, userId);
	const now = Date.now();
	const nextAvailableAt = (timers.workAt || 0) + cooldownMs;
	if (now < nextAvailableAt) {
		return { cooldown: true, remainingMs: nextAvailableAt - now };
	}

	const job = workJobs[Math.floor(Math.random() * workJobs.length)];
	const min = Math.max(1, Math.min(econ.workMin, econ.workMax));
	const max = Math.max(min, econ.workMax);
	const amount = getRandomInteger(min, max);
	addBalance(file, guildId, userId, amount);
	setUserTimer(timersFile, guildId, userId, 'workAt', now);

	return { success: true, job, amount, nextCooldownMs: cooldownMs };
}

function claimDailyReward({ coinsFile: file, crownsConfigFile, timersFile, guildId, userId }) {
	if (!isEconomyEnabled(guildId, crownsConfigFile)) {
		return { disabled: true };
	}

	const econ = getEconomyConfig(guildId);
	const cooldownMs = Math.max(1, econ.dailyCooldownHours) * 60 * 60 * 1000;
	const timers = getUserTimers(timersFile, guildId, userId);
	const now = Date.now();
	const nextAvailableAt = (timers.dailyAt || 0) + cooldownMs;
	if (now < nextAvailableAt) {
		return { cooldown: true, remainingMs: nextAvailableAt - now };
	}

	const min = Math.max(1, Math.min(econ.dailyMin, econ.dailyMax));
	const max = Math.max(min, econ.dailyMax);
	const amount = getRandomInteger(min, max);
	addBalance(file, guildId, userId, amount);
	setUserTimer(timersFile, guildId, userId, 'dailyAt', now);

	return { success: true, amount, nextCooldownMs: cooldownMs };
}

function transfer({ coinsFile: file, guildId, fromUserId, toUserId, amount }) {
	if (!Number.isInteger(amount) || amount <= 0) {
		return { error: 'Bedrag moet groter zijn dan 0.' };
	}
	if (fromUserId === toUserId) {
		return { error: 'Je kunt niet aan jezelf betalen.' };
	}

	const econ = getEconomyConfig(guildId);
	const taxPercent = Math.max(0, Math.min(100, econ.payTaxPercent || 0));
	const fromBalance = getBalance(file, guildId, fromUserId);
	if (fromBalance < amount) {
		return { error: `Je hebt maar ${fromBalance} coins.` };
	}

	const tax = Math.floor((amount * taxPercent) / 100);
	const received = amount - tax;
	subtractBalance(file, guildId, fromUserId, amount);
	addBalance(file, guildId, toUserId, received);

	return {
		success: true,
		amount,
		tax,
		received,
		fromBalance: getBalance(file, guildId, fromUserId),
		toBalance: getBalance(file, guildId, toUserId),
	};
}

function attemptRob({ coinsFile: file, timersFile, guildId, robberId, victimId }) {
	if (robberId === victimId) {
		return { error: 'Je kunt jezelf niet beroven.' };
	}

	const econ = getEconomyConfig(guildId);
	const cooldownMs = Math.max(1, econ.robCooldownHours) * 60 * 60 * 1000;
	const robberTimers = getUserTimers(timersFile, guildId, robberId);
	const now = Date.now();
	const nextAvailableAt = (robberTimers.robAt || 0) + cooldownMs;
	if (now < nextAvailableAt) {
		return { cooldown: true, remainingMs: nextAvailableAt - now };
	}

	const victimBalance = getBalance(file, guildId, victimId);
	if (victimBalance < econ.robMinVictimBalance) {
		return { error: `Het slachtoffer heeft te weinig coins (minstens ${econ.robMinVictimBalance} nodig).` };
	}

	const robberBalance = getBalance(file, guildId, robberId);
	if (robberBalance < econ.robMinVictimBalance) {
		return { error: `Je hebt zelf minstens ${econ.robMinVictimBalance} coins nodig om te beroven.` };
	}

	const victimTimers = getUserTimers(timersFile, guildId, victimId);
	const recentlyRobbed = (victimTimers.robbedAt || 0) + 24 * 60 * 60 * 1000;
	if (now < recentlyRobbed) {
		return { error: 'Dit slachtoffer is recent al beroofd. Probeer iemand anders.' };
	}

	const bonus = getRobBonus(guildId, robberId);
	const successChance = Math.max(0, Math.min(100, econ.robSuccessChance + bonus));
	const success = Math.random() * 100 < successChance;
	setUserTimer(timersFile, guildId, robberId, 'robAt', now);

	if (success) {
		const stealPercent = Math.max(1, Math.min(100, econ.robMaxStealPercent));
		const maxSteal = Math.max(1, Math.floor((victimBalance * stealPercent) / 100));
		const stolen = getRandomInteger(1, maxSteal);
		subtractBalance(file, guildId, victimId, stolen);
		addBalance(file, guildId, robberId, stolen);
		setUserTimer(timersFile, guildId, victimId, 'robbedAt', now);
		return {
			success: true,
			stolen,
			robberBalance: getBalance(file, guildId, robberId),
			victimBalance: getBalance(file, guildId, victimId),
		};
	}

	const failPercent = Math.max(0, Math.min(100, econ.robFailFeePercent));
	const fee = Math.max(1, Math.floor((robberBalance * failPercent) / 100));
	subtractBalance(file, guildId, robberId, fee);
	return {
		failure: true,
		fee,
		robberBalance: getBalance(file, guildId, robberId),
	};
}

function getLeaderboard({ coinsFile: file, guildId, limit = 10 }) {
	const all = readJson(file, {});
	const guild = all[guildId] || {};
	return Object.entries(guild)
		.map(([userId, balance]) => ({ userId, balance }))
		.sort((a, b) => b.balance - a.balance)
		.slice(0, Math.max(1, limit));
}

function getLevelLeaderboard({ levelsFile, guildId, limit = 10 }) {
	const all = readJson(levelsFile, {});
	const guild = all[guildId] || {};
	return Object.entries(guild)
		.map(([userId, data]) => ({
			userId,
			level: data?.level || 0,
			xp: data?.xp || 0,
		}))
		.sort((a, b) => (b.level - a.level) || (b.xp - a.xp))
		.slice(0, Math.max(1, limit));
}

module.exports = {
	claimDailyReward,
	claimWorkReward,
	transfer,
	attemptRob,
	getLeaderboard,
	getLevelLeaderboard,
	formatDuration,
	getEconomyConfig,
	isEconomyEnabled,
	getUserTimers,
	setUserTimer,
	economyTimersFile,
	coinsFile,
};
