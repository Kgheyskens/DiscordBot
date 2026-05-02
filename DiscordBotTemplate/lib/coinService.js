const { readJson, writeJson } = require('./jsonStore');

function readCoinBalances(coinsFile) {
	return readJson(coinsFile, {});
}

function writeCoinBalances(coinsFile, data) {
	writeJson(coinsFile, data);
}

function getBalance(coinsFile, guildId, userId) {
	const all = readCoinBalances(coinsFile);
	return all[guildId]?.[userId] || 0;
}

function setBalance(coinsFile, guildId, userId, balance) {
	const all = readCoinBalances(coinsFile);
	const guild = all[guildId] || {};
	guild[userId] = Math.max(0, balance);
	all[guildId] = guild;
	writeCoinBalances(coinsFile, all);
	return guild[userId];
}

function addBalance(coinsFile, guildId, userId, amount) {
	const current = getBalance(coinsFile, guildId, userId);
	return setBalance(coinsFile, guildId, userId, current + amount);
}

function subtractBalance(coinsFile, guildId, userId, amount) {
	const current = getBalance(coinsFile, guildId, userId);
	if (current < amount) return null;
	return setBalance(coinsFile, guildId, userId, current - amount);
}

module.exports = {
	getBalance,
	setBalance,
	addBalance,
	subtractBalance,
};
