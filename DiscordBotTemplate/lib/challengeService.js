const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const { getSettings } = require('./guildSettings');
const { pickRandom, isCorrectAnswer } = require('./puzzlePool');
const { addBalance } = require('./crownService');

const challengesFile = path.join(__dirname, '..', 'data', 'challenges.json');
const winnersFile = path.join(__dirname, '..', 'data', 'monthlyWinners.json');
const crownsFile = path.join(__dirname, '..', 'data', 'crowns.json');

function todayKey(date = new Date()) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function monthKey(date = new Date()) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

function getActive(guildId) {
	const all = readJson(challengesFile, {});
	return all[guildId] || null;
}

function setActive(guildId, state) {
	const all = readJson(challengesFile, {});
	if (state === null) {
		delete all[guildId];
	} else {
		all[guildId] = state;
	}
	writeJson(challengesFile, all);
}

function startChallenge(guildId, channelId) {
	const settings = getSettings(guildId);
	const puzzle = pickRandom(settings.challenge?.customPuzzles || []);
	if (!puzzle) return null;

	const state = {
		date: todayKey(),
		question: puzzle.question,
		answer: puzzle.answer,
		channelId,
		messageId: null,
		solved: false,
		winnerId: null,
		startedAt: Date.now(),
	};
	setActive(guildId, state);
	return state;
}

function attachMessage(guildId, messageId) {
	const active = getActive(guildId);
	if (!active) return;
	active.messageId = messageId;
	setActive(guildId, active);
}

function tryAnswer(guildId, userId, content) {
	const active = getActive(guildId);
	if (!active || active.solved) return { matched: false };
	if (!isCorrectAnswer(content, active.answer)) return { matched: false };

	active.solved = true;
	active.winnerId = userId;
	active.solvedAt = Date.now();
	setActive(guildId, active);

	const settings = getSettings(guildId);
	const reward = Math.max(0, Number(settings.challenge?.rewardKroontjes) || 0);
	if (reward > 0) addBalance(crownsFile, guildId, userId, reward);

	recordWinner(guildId, userId, active.question);
	return { matched: true, reward, answer: active.answer };
}

function recordWinner(guildId, userId, question) {
	const all = readJson(winnersFile, {});
	const guildEntries = all[guildId] || {};
	const month = monthKey();
	const monthEntries = guildEntries[month] || [];
	monthEntries.push({ userId, date: todayKey(), question });
	guildEntries[month] = monthEntries;
	all[guildId] = guildEntries;
	writeJson(winnersFile, all);
}

function getMonthlyWinners(guildId, month) {
	const all = readJson(winnersFile, {});
	return all[guildId]?.[month] || [];
}

function getTopWinners(guildId, month, limit = 3) {
	const entries = getMonthlyWinners(guildId, month);
	const counts = {};
	for (const e of entries) counts[e.userId] = (counts[e.userId] || 0) + 1;
	return Object.entries(counts)
		.map(([userId, wins]) => ({ userId, wins }))
		.sort((a, b) => b.wins - a.wins)
		.slice(0, limit);
}

module.exports = {
	challengesFile,
	winnersFile,
	todayKey,
	monthKey,
	getActive,
	setActive,
	startChallenge,
	attachMessage,
	tryAnswer,
	recordWinner,
	getMonthlyWinners,
	getTopWinners,
};
