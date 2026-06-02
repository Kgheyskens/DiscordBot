const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const inventoryFile = path.join(__dirname, '..', 'data', 'inventory.json');

function readAll() {
	return readJson(inventoryFile, {});
}

function writeAll(data) {
	writeJson(inventoryFile, data);
}

function getInventory(guildId, userId) {
	const all = readAll();
	return all[guildId]?.[userId] || {};
}

function addItem(guildId, userId, itemKey, amount = 1) {
	const all = readAll();
	const guild = all[guildId] || {};
	const user = guild[userId] || {};
	user[itemKey] = (user[itemKey] || 0) + amount;
	guild[userId] = user;
	all[guildId] = guild;
	writeAll(all);
	return user[itemKey];
}

function consumeItem(guildId, userId, itemKey, amount = 1) {
	const all = readAll();
	const guild = all[guildId] || {};
	const user = guild[userId] || {};
	const have = user[itemKey] || 0;
	if (have < amount) return { error: `Je hebt geen ${itemKey} in je inventory.` };
	user[itemKey] = have - amount;
	if (user[itemKey] === 0) delete user[itemKey];
	guild[userId] = user;
	all[guildId] = guild;
	writeAll(all);
	return { success: true, remaining: user[itemKey] || 0 };
}

function getCount(guildId, userId, itemKey) {
	return getInventory(guildId, userId)[itemKey] || 0;
}

module.exports = {
	inventoryFile,
	getInventory,
	addItem,
	consumeItem,
	getCount,
};
