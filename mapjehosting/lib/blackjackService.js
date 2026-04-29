const suits = ['♠', '♥', '♦', '♣'];
const ranks = [
	{ rank: 'A', value: 11 },
	{ rank: '2', value: 2 },
	{ rank: '3', value: 3 },
	{ rank: '4', value: 4 },
	{ rank: '5', value: 5 },
	{ rank: '6', value: 6 },
	{ rank: '7', value: 7 },
	{ rank: '8', value: 8 },
	{ rank: '9', value: 9 },
	{ rank: '10', value: 10 },
	{ rank: 'J', value: 10 },
	{ rank: 'Q', value: 10 },
	{ rank: 'K', value: 10 },
];

function createDeck() {
	const deck = [];
	for (const suit of suits) {
		for (const card of ranks) {
			deck.push({ suit, rank: card.rank, value: card.value });
		}
	}
	return shuffle(deck);
}

function shuffle(deck) {
	for (let index = deck.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
	}
	return deck;
}

function drawCard(deck) {
	return deck.pop();
}

function handValue(hand) {
	let total = 0;
	let aces = 0;

	for (const card of hand) {
		total += card.value;
		if (card.rank === 'A') {
			aces += 1;
		}
	}

	while (total > 21 && aces > 0) {
		total -= 10;
		aces -= 1;
	}

	return total;
}

function formatHand(hand, hideSecondCard = false) {
	if (!hideSecondCard) {
		return hand.map(card => `${card.rank}${card.suit}`).join(' ');
	}

	if (!hand.length) {
		return 'Nog geen kaarten';
	}

	return `${hand[0].rank}${hand[0].suit} ??`;
}

function isBlackjack(hand) {
	return hand.length === 2 && handValue(hand) === 21;
}

function isBust(hand) {
	return handValue(hand) > 21;
}

function dealerShouldHit(hand) {
	return handValue(hand) < 17;
}

module.exports = {
	createDeck,
	drawCard,
	handValue,
	formatHand,
	isBlackjack,
	isBust,
	dealerShouldHit,
};