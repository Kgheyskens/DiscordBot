const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const jackpotFile = path.join(__dirname, '..', 'data', 'slotsJackpot.json');

const SYMBOLS = [
	{ emoji: '🍒', weight: 30, payouts: { three: 2, two: 0.5 } },
	{ emoji: '🍋', weight: 25, payouts: { three: 3, two: 0 } },
	{ emoji: '🔔', weight: 18, payouts: { three: 5, two: 0 } },
	{ emoji: '⭐', weight: 12, payouts: { three: 10, two: 0 } },
	{ emoji: '💎', weight: 6, payouts: { three: 25, two: 0 } },
	{ emoji: '7️⃣', weight: 3, payouts: { three: 'jackpot', two: 0 } },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((a, b) => a + b.weight, 0);
const MIN_JACKPOT_SEED = 500;
const JACKPOT_CONTRIBUTION = 0.05; // 5% van losses

function pickSymbol() {
	let r = Math.random() * TOTAL_WEIGHT;
	for (const s of SYMBOLS) {
		if (r < s.weight) return s;
		r -= s.weight;
	}
	return SYMBOLS[0];
}

function spin() {
	return [pickSymbol(), pickSymbol(), pickSymbol()];
}

function getJackpot(guildId) {
	const all = readJson(jackpotFile, {});
	return all[guildId] || MIN_JACKPOT_SEED;
}

function setJackpot(guildId, value) {
	const all = readJson(jackpotFile, {});
	all[guildId] = Math.max(MIN_JACKPOT_SEED, Math.floor(value));
	writeJson(jackpotFile, all);
	return all[guildId];
}

function addToJackpot(guildId, amount) {
	return setJackpot(guildId, getJackpot(guildId) + amount);
}

function evaluate(spinResult, bet, guildId) {
	const [a, b, c] = spinResult;
	const emojiA = a.emoji;
	const emojiB = b.emoji;
	const emojiC = c.emoji;

	// Drie gelijk
	if (emojiA === emojiB && emojiB === emojiC) {
		const payout = a.payouts.three;
		if (payout === 'jackpot') {
			const jackpot = getJackpot(guildId);
			setJackpot(guildId, MIN_JACKPOT_SEED);
			return { outcome: 'jackpot', payout: jackpot, label: '🎰 JACKPOT 🎰' };
		}
		return { outcome: 'win', payout: bet * payout, label: `3x ${emojiA}` };
	}

	// Twee gelijk (alleen kersen geven payout)
	const counts = new Map();
	for (const s of spinResult) counts.set(s.emoji, (counts.get(s.emoji) || 0) + 1);
	for (const s of SYMBOLS) {
		if (counts.get(s.emoji) === 2 && s.payouts.two > 0) {
			return { outcome: 'small', payout: Math.floor(bet * s.payouts.two), label: `2x ${s.emoji}` };
		}
	}

	return { outcome: 'loss', payout: 0, label: 'Geen winnende combinatie' };
}

function formatRow(symbols) {
	return symbols.map(s => s.emoji).join(' | ');
}

function randomRow() {
	return formatRow(spin());
}

module.exports = {
	SYMBOLS,
	MIN_JACKPOT_SEED,
	JACKPOT_CONTRIBUTION,
	spin,
	evaluate,
	getJackpot,
	setJackpot,
	addToJackpot,
	formatRow,
	randomRow,
};
