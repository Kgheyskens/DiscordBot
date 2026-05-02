const BUILTIN_PUZZLES = [
	{ question: 'Ik heb steden, maar geen huizen. Ik heb bergen, maar geen bomen. Ik heb water, maar geen vissen. Wat ben ik?', answer: 'kaart' },
	{ question: 'Wat wordt natter naarmate het meer droogt?', answer: 'handdoek' },
	{ question: 'Hoe meer je ervan neemt, hoe meer je achterlaat. Wat is het?', answer: 'voetstappen' },
	{ question: 'Wat heeft een hals zonder hoofd, en armen zonder handen?', answer: 'shirt' },
	{ question: 'Ik praat zonder mond en hoor zonder oren. Wat ben ik?', answer: 'echo' },
	{ question: 'Wat gaat omhoog maar nooit naar beneden?', answer: 'leeftijd' },
	{ question: 'Welke maand heeft 28 dagen?', answer: 'alle' },
	{ question: 'Wat heeft sleutels maar geen sloten, ruimte maar geen kamers, en je kan ermee binnen maar niet buiten?', answer: 'toetsenbord' },
	{ question: 'Ik ben licht als een veer, maar de sterkste man kan me niet langer dan een minuut vasthouden. Wat ben ik?', answer: 'adem' },
	{ question: 'Wat heeft tanden maar kan niet bijten?', answer: 'kam' },
	{ question: 'Hoeveel keer kun je 5 aftrekken van 25?', answer: 'een' },
	{ question: 'Wat breekt zodra je het noemt?', answer: 'stilte' },
	{ question: 'Wat heeft een gezicht en twee handen, maar geen armen of benen?', answer: 'klok' },
	{ question: 'Welk woord wordt verkeerd gespeld in elk woordenboek?', answer: 'verkeerd' },
	{ question: 'Wat is zo broos dat alleen het noemen het breekt?', answer: 'stilte' },
	{ question: 'Wat heeft bladeren maar geen takken?', answer: 'boek' },
	{ question: 'Wat is altijd voor je, maar je kunt het nooit zien?', answer: 'toekomst' },
	{ question: 'Wat heeft poten maar loopt niet?', answer: 'tafel' },
	{ question: 'Hoeveel letters zitten er in het alfabet? (denk goed!)', answer: '11' },
	{ question: 'Wat is de hoofdstad van België?', answer: 'brussel' },
	{ question: 'Welk dier kan tot 3 jaar zonder water?', answer: 'kameel' },
	{ question: 'Wat is 7 × 8?', answer: '56' },
	{ question: 'Welke planeet is het dichtst bij de zon?', answer: 'mercurius' },
	{ question: 'Hoeveel continenten zijn er?', answer: '7' },
	{ question: 'Wat is het grootste oceaan?', answer: 'stille oceaan' },
	{ question: 'Hoeveel zijden heeft een hexagon?', answer: '6' },
	{ question: 'Wat is de chemische formule van water?', answer: 'h2o' },
	{ question: 'Hoeveel benen heeft een spin?', answer: '8' },
	{ question: 'Welk jaar viel de Berlijnse muur?', answer: '1989' },
	{ question: 'Wat is het tegenovergestelde van "altijd"?', answer: 'nooit' },
];

function normalize(str) {
	return String(str || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9 ]/g, '')
		.trim();
}

function pickRandom(customPuzzles = []) {
	const pool = [...BUILTIN_PUZZLES, ...customPuzzles];
	if (pool.length === 0) return null;
	const idx = Math.floor(Math.random() * pool.length);
	return { ...pool[idx], poolIndex: idx };
}

function isCorrectAnswer(userAnswer, correctAnswer) {
	return normalize(userAnswer) === normalize(correctAnswer);
}

module.exports = {
	BUILTIN_PUZZLES,
	pickRandom,
	isCorrectAnswer,
	normalize,
};
