const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const effectsFile = path.join(__dirname, '..', 'data', 'activeEffects.json');

// Effect-keys
const EFFECTS = {
	xpBooster: { defaultDurationMs: 60 * 60 * 1000, multiplier: 2, label: 'XP Booster (2x XP, 1u)' },
	luckyCharm: { defaultDurationMs: 60 * 60 * 1000, bonus: 20, label: 'Lucky Charm (+20% rob, 1u)' },
};

function readAll() {
	return readJson(effectsFile, {});
}

function writeAll(data) {
	writeJson(effectsFile, data);
}

function getActiveEffects(guildId, userId) {
	const all = readAll();
	const userEffects = all[guildId]?.[userId] || {};
	const now = Date.now();
	const active = {};
	let mutated = false;
	for (const [key, exp] of Object.entries(userEffects)) {
		if (exp > now) active[key] = exp;
		else mutated = true;
	}
	if (mutated) {
		const guild = all[guildId] || {};
		guild[userId] = active;
		all[guildId] = guild;
		writeAll(all);
	}
	return active;
}

function activateEffect(guildId, userId, key, durationMs) {
	const config = EFFECTS[key];
	if (!config) return { error: 'Onbekend effect.' };
	const all = readAll();
	const guild = all[guildId] || {};
	const user = guild[userId] || {};
	const now = Date.now();
	const currentExp = user[key] && user[key] > now ? user[key] : now;
	const dur = durationMs || config.defaultDurationMs;
	user[key] = currentExp + dur;
	guild[userId] = user;
	all[guildId] = guild;
	writeAll(all);
	return { success: true, expiresAt: user[key] };
}

function hasEffect(guildId, userId, key) {
	const effects = getActiveEffects(guildId, userId);
	return Boolean(effects[key]);
}

function getEffectExpiry(guildId, userId, key) {
	const effects = getActiveEffects(guildId, userId);
	return effects[key] || null;
}

function getXpMultiplier(guildId, userId) {
	return hasEffect(guildId, userId, 'xpBooster') ? EFFECTS.xpBooster.multiplier : 1;
}

function getRobBonus(guildId, userId) {
	return hasEffect(guildId, userId, 'luckyCharm') ? EFFECTS.luckyCharm.bonus : 0;
}

module.exports = {
	EFFECTS,
	effectsFile,
	getActiveEffects,
	activateEffect,
	hasEffect,
	getEffectExpiry,
	getXpMultiplier,
	getRobBonus,
};
