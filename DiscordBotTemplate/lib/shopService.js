const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const { getBalance, subtractBalance } = require('./coinService');

const shopFile = path.join(__dirname, '..', 'data', 'shopItems.json');
const coinsFile = path.join(__dirname, '..', 'data', 'coins.json');

const VALID_TYPES = new Set(['role', 'xp', 'custom']);

function readAll() {
	return readJson(shopFile, {});
}

function writeAll(data) {
	writeJson(shopFile, data);
}

function generateId() {
	return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function listItems(guildId) {
	const all = readAll();
	return all[guildId] || [];
}

function addItem(guildId, item) {
	if (!VALID_TYPES.has(item.type)) {
		return { error: `Onbekend itemtype. Gebruik: ${[...VALID_TYPES].join(', ')}.` };
	}
	if (!item.name || typeof item.name !== 'string') {
		return { error: 'Item heeft een naam nodig.' };
	}
	if (!Number.isInteger(item.price) || item.price <= 0) {
		return { error: 'Prijs moet een positief geheel getal zijn.' };
	}
	if (item.currency && item.currency !== 'coins' && item.currency !== 'kroontjes') {
		return { error: 'Currency moet "coins" of "kroontjes" zijn.' };
	}
	if (item.type === 'role' && !item.payload) {
		return { error: 'Een role-item heeft een role ID nodig als payload.' };
	}
	if (item.type === 'xp' && (!Number.isInteger(Number(item.payload)) || Number(item.payload) <= 0)) {
		return { error: 'Een xp-item heeft een positief XP-aantal nodig als payload.' };
	}

	const all = readAll();
	const items = all[guildId] || [];
	const newItem = {
		id: generateId(),
		type: item.type,
		name: item.name.slice(0, 80),
		price: item.price,
		currency: item.currency || 'coins',
		payload: item.payload,
		description: (item.description || '').slice(0, 200),
	};
	items.push(newItem);
	all[guildId] = items;
	writeAll(all);
	return { success: true, item: newItem };
}

function removeItem(guildId, itemId) {
	const all = readAll();
	const items = all[guildId] || [];
	const idx = items.findIndex(i => i.id === itemId);
	if (idx === -1) return { error: 'Item niet gevonden.' };
	const [removed] = items.splice(idx, 1);
	all[guildId] = items;
	writeAll(all);
	return { success: true, item: removed };
}

function findItem(guildId, itemId) {
	return listItems(guildId).find(i => i.id === itemId) || null;
}

function purchaseItem({ guildId, userId, itemId }) {
	const item = findItem(guildId, itemId);
	if (!item) return { error: 'Item niet gevonden.' };

	const balance = getBalance(coinsFile, guildId, userId);
	if (balance < item.price) {
		return { error: `Je hebt ${item.price} coins nodig maar hebt er ${balance}.` };
	}

	subtractBalance(coinsFile, guildId, userId, item.price);
	return { success: true, item, newBalance: getBalance(coinsFile, guildId, userId) };
}

module.exports = {
	shopFile,
	listItems,
	addItem,
	removeItem,
	findItem,
	purchaseItem,
};
