const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');
const { readJson, writeJson } = require('./jsonStore');
const { getSettings } = require('./guildSettings');
const { addBalance } = require('./crownService');

const minigamesFile = path.join(__dirname, '..', 'data', 'minigames.json');
const wordsFile = path.join(__dirname, '..', 'data', 'minigameWords.json');
const crownsFile = path.join(__dirname, '..', 'data', 'crowns.json');

const DEFAULT_WORDLE_WORDS = [
	'appel', 'stoel', 'koers', 'paard', 'tafel', 'klauw', 'beurs', 'fluit',
	'kruid', 'lampe', 'magie', 'plant', 'regen', 'sneep', 'tover', 'ijver',
	'water', 'zomer', 'storm', 'plein', 'vrouw', 'baard', 'noten', 'olijf',
	'kleur', 'snoep', 'reuze', 'hemel', 'cijfer'.slice(0, 5), 'jacht',
];

const DEFAULT_HANGMAN_WORDS = [
	'auto', 'fiets', 'kasteel', 'olifant', 'computer', 'discord', 'twitch',
	'koekje', 'kroontje', 'voetbal', 'wereld', 'hoofdstad', 'vlaanderen',
	'nederland', 'gitaar', 'piano', 'zonnebril', 'paraplu', 'sleutel',
	'bibliotheek', 'school', 'rugzak', 'handschoen', 'vlinder',
];

const HANGMAN_STAGES = [
	'```\n  +---+\n      |\n      |\n      |\n     ===\n```',
	'```\n  +---+\n  O   |\n      |\n      |\n     ===\n```',
	'```\n  +---+\n  O   |\n  |   |\n      |\n     ===\n```',
	'```\n  +---+\n  O   |\n /|   |\n      |\n     ===\n```',
	'```\n  +---+\n  O   |\n /|\\  |\n      |\n     ===\n```',
	'```\n  +---+\n  O   |\n /|\\  |\n /    |\n     ===\n```',
	'```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n     ===\n```',
];

const HANGMAN_MAX_WRONG = HANGMAN_STAGES.length - 1;

function readGames() {
	return readJson(minigamesFile, {});
}

function writeGames(data) {
	writeJson(minigamesFile, data);
}

function readWords() {
	return readJson(wordsFile, {});
}

function writeWords(data) {
	writeJson(wordsFile, data);
}

function getCustomWords(guildId, game) {
	const all = readWords();
	return all[guildId]?.[game] || [];
}

function setCustomWords(guildId, game, words) {
	const all = readWords();
	const guildWords = all[guildId] || {};
	guildWords[game] = words.map(w => String(w).toLowerCase().trim()).filter(Boolean).slice(0, 500);
	all[guildId] = guildWords;
	writeWords(all);
	return guildWords[game];
}

function addCustomWord(guildId, game, word) {
	const list = getCustomWords(guildId, game);
	const cleaned = String(word || '').toLowerCase().trim();
	if (!cleaned) return { error: 'Leeg woord.' };
	if (list.includes(cleaned)) return { error: 'Woord bestaat al.' };
	list.push(cleaned);
	setCustomWords(guildId, game, list);
	return { success: true };
}

function removeCustomWord(guildId, game, word) {
	const list = getCustomWords(guildId, game);
	const cleaned = String(word || '').toLowerCase().trim();
	const filtered = list.filter(w => w !== cleaned);
	if (filtered.length === list.length) return { error: 'Woord niet gevonden.' };
	setCustomWords(guildId, game, filtered);
	return { success: true };
}

function pickWord(guildId, game) {
	const custom = getCustomWords(guildId, game);
	const defaults = game === 'wordle' ? DEFAULT_WORDLE_WORDS : DEFAULT_HANGMAN_WORDS;
	const pool = [...defaults, ...custom];
	if (game === 'wordle') {
		const fives = pool.filter(w => w.length === 5 && /^[a-z]+$/i.test(w));
		const source = fives.length ? fives : DEFAULT_WORDLE_WORDS;
		return source[Math.floor(Math.random() * source.length)];
	}
	const filtered = pool.filter(w => w.length >= 3 && /^[a-z]+$/i.test(w));
	const source = filtered.length ? filtered : DEFAULT_HANGMAN_WORDS;
	return source[Math.floor(Math.random() * source.length)];
}

function getActiveGame(guildId, channelId) {
	const all = readGames();
	return all[guildId]?.[channelId] || null;
}

function setActiveGame(guildId, channelId, state) {
	const all = readGames();
	all[guildId] = all[guildId] || {};
	if (state === null) {
		delete all[guildId][channelId];
	} else {
		all[guildId][channelId] = state;
	}
	writeGames(all);
}

function isGameAllowedInChannel(guildId, game, channelId) {
	const settings = getSettings(guildId);
	const cfg = settings.minigames?.[game];
	if (!cfg?.enabled) return { allowed: false, reason: 'Deze minigame staat uit op deze server.' };
	if (cfg.channelId && cfg.channelId !== channelId) {
		return { allowed: false, reason: `Speel deze minigame in <#${cfg.channelId}>.` };
	}
	return { allowed: true };
}

function buildWordleEmbed(state) {
	const rows = state.guesses.map(({ marks }) => marks.map(m => {
		if (m === 'correct') return '🟩';
		if (m === 'present') return '🟨';
		return '⬛';
	}).join(''));
	const empty = '⬜'.repeat(state.answer.length);
	while (rows.length < state.maxGuesses) rows.push(empty);

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🟩 Wordle')
		.setDescription(`Type een **${state.answer.length}-letter** woord in de chat. Je hebt ${state.maxGuesses - state.guesses.length} pogingen over.\n\n${rows.join('\n')}`)
		.setFooter({ text: 'Speler: ' + (state.starterTag || state.starterId) });

	if (state.guesses.length > 0) {
		const list = state.guesses.map((g, i) => `${i + 1}. \`${g.word.toUpperCase()}\``).join('\n');
		embed.addFields({ name: 'Geraden woorden', value: list });
	}

	if (state.finished) {
		embed.addFields({ name: state.won ? '✅ Gewonnen!' : '❌ Verloren', value: `Het woord was **${state.answer.toUpperCase()}**.` });
	}
	return embed;
}

function evaluateWordleGuess(answer, guess) {
	const a = answer.toLowerCase().split('');
	const g = guess.toLowerCase().split('');
	const marks = Array(g.length).fill('absent');
	const taken = Array(a.length).fill(false);

	for (let i = 0; i < g.length; i += 1) {
		if (g[i] === a[i]) {
			marks[i] = 'correct';
			taken[i] = true;
		}
	}
	for (let i = 0; i < g.length; i += 1) {
		if (marks[i] === 'correct') continue;
		const idx = a.findIndex((ch, j) => !taken[j] && ch === g[i]);
		if (idx !== -1) {
			marks[i] = 'present';
			taken[idx] = true;
		}
	}
	return marks;
}

function buildHangmanEmbed(state) {
	const reveal = state.answer.split('').map(ch => state.guessed.includes(ch) ? ch.toUpperCase() : '_').join(' ');
	const wrongLetters = [...state.wrong].map(c => c.toUpperCase()).sort().join(' ') || '_geen_';
	const stage = HANGMAN_STAGES[Math.min(state.wrong.length, HANGMAN_MAX_WRONG)];
	const remaining = HANGMAN_MAX_WRONG - state.wrong.length;

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🪢 Galgje')
		.setDescription(`Type een letter (of het hele woord) in de chat. Nog **${remaining}** fout${remaining === 1 ? '' : 'en'} mogelijk.\n${stage}`)
		.addFields(
			{ name: 'Woord', value: `\`${reveal}\``, inline: false },
			{ name: 'Fout geraden', value: wrongLetters, inline: false },
		)
		.setFooter({ text: 'Speler: ' + (state.starterTag || state.starterId) });

	if (state.finished) {
		embed.addFields({ name: state.won ? '✅ Gewonnen!' : '❌ Verloren', value: `Het woord was **${state.answer.toUpperCase()}**.` });
	}
	return embed;
}

function generateMinesweeperBoard(width, height, bombs) {
	const cells = Array.from({ length: width * height }, (_, idx) => ({ idx, bomb: false, revealed: false, flagged: false, adj: 0 }));
	const indices = [...cells.keys()];
	for (let i = indices.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}
	for (let b = 0; b < bombs; b += 1) {
		cells[indices[b]].bomb = true;
	}
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const i = y * width + x;
			if (cells[i].bomb) continue;
			let count = 0;
			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					if (dx === 0 && dy === 0) continue;
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
					if (cells[ny * width + nx].bomb) count += 1;
				}
			}
			cells[i].adj = count;
		}
	}
	return cells;
}

function revealMinesweeperFlood(state, idx) {
	const stack = [idx];
	const visited = new Set();
	while (stack.length) {
		const cur = stack.pop();
		if (visited.has(cur)) continue;
		visited.add(cur);
		const cell = state.cells[cur];
		if (cell.revealed || cell.flagged) continue;
		cell.revealed = true;
		if (cell.adj === 0 && !cell.bomb) {
			const x = cur % state.width;
			const y = Math.floor(cur / state.width);
			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					if (dx === 0 && dy === 0) continue;
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
					stack.push(ny * state.width + nx);
				}
			}
		}
	}
}

function checkMinesweeperWin(state) {
	return state.cells.every(c => c.bomb ? !c.revealed : c.revealed);
}

function buildMinesweeperRows(state) {
	const rows = [];
	for (let y = 0; y < state.height; y += 1) {
		const row = new ActionRowBuilder();
		for (let x = 0; x < state.width; x += 1) {
			const idx = y * state.width + x;
			const cell = state.cells[idx];
			let label = '\u200b';
			let style = ButtonStyle.Danger;
			let disabled = false;
			if (state.finished) {
				if (cell.bomb) { label = '💣'; style = ButtonStyle.Danger; }
				else { label = cell.adj === 0 ? '·' : String(cell.adj); style = ButtonStyle.Secondary; }
				disabled = true;
			} else if (cell.flagged) {
				label = '🚩';
				style = ButtonStyle.Primary;
			} else if (cell.revealed) {
				label = cell.adj === 0 ? '·' : String(cell.adj);
				style = ButtonStyle.Secondary;
				disabled = true;
			}
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`mg:ms:${state.gameId}:${idx}`)
					.setLabel(label)
					.setStyle(style)
					.setDisabled(disabled),
			);
		}
		rows.push(row);
	}
	const ctrl = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`mg:ms:${state.gameId}:flag`).setLabel(state.flagMode ? '🚩 Vlag-modus AAN' : '🚩 Vlag-modus UIT').setStyle(state.flagMode ? ButtonStyle.Success : ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId(`mg:ms:${state.gameId}:stop`).setLabel('Stop').setStyle(ButtonStyle.Danger),
	);
	rows.push(ctrl);
	return rows;
}

function buildMinesweeperEmbed(state) {
	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('💣 Minesweeper')
		.setDescription(`Klik tegels om te onthullen. Vlag-modus markeert verdachte cellen.\nBord: ${state.width}×${state.height}. Hoeveel bommen er liggen? Dat moet je zelf uitvogelen 😈`)
		.setFooter({ text: 'Speler: ' + (state.starterTag || state.starterId) });
	if (state.finished) {
		embed.addFields({ name: state.won ? '✅ Gewonnen!' : '💥 Gefaald', value: state.won ? `Alle veilige tegels onthuld. Er waren **${state.bombs}** bommen.` : `Je raakte een bom. Er waren er **${state.bombs}** in totaal.` });
	}
	return embed;
}

async function awardMinigameWin(guildId, userId) {
	const settings = getSettings(guildId);
	const reward = Math.max(0, Number(settings.minigames?.wordle?.rewardCrowns) || 0);
	if (reward > 0) addBalance(crownsFile, guildId, userId, reward);
	return reward;
}

async function awardWin(guildId, userId, game) {
	const settings = getSettings(guildId);
	const reward = Math.max(0, Number(settings.minigames?.[game]?.rewardCrowns) || 0);
	if (reward > 0) addBalance(crownsFile, guildId, userId, reward);
	return reward;
}

function buildHelpEmbed(game) {
	if (game === 'wordle') {
		return new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Help: Wordle')
			.setDescription([
				'Raad het 5-letterwoord. Type je gok in de chat van het wordle-kanaal.',
				'',
				'🟩 Letter staat op de juiste plek.',
				'🟨 Letter zit in het woord, maar op een andere plek.',
				'⬛ Letter zit niet in het woord.',
				'',
				'Je hebt 6 pogingen. Wint? Dan krijg je kroontjes.',
			].join('\n'));
	}
	if (game === 'hangman') {
		return new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Help: Galgje (Hangman)')
			.setDescription([
				'Raad het woord letter voor letter. Type één letter, of het hele woord, in de chat.',
				`Je mag ${HANGMAN_MAX_WRONG} fouten maken voordat het mannetje hangt.`,
				'',
				'Wint? Dan krijg je kroontjes.',
			].join('\n'));
	}
	if (game === 'minesweeper') {
		return new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Help: Minesweeper')
			.setDescription([
				'Klik tegels om ze te onthullen. Cijfers tonen hoeveel bommen er aangrenzend liggen.',
				'Gebruik **Vlag-modus** om verdachte tegels te markeren in plaats van te onthullen.',
				'',
				'Onthul alle veilige tegels om te winnen — raak je een bom, dan verlies je.',
				'Wint? Dan krijg je kroontjes.',
			].join('\n'));
	}
	return new EmbedBuilder().setColor(0xb40f0f).setTitle('Onbekende minigame');
}

module.exports = {
	minigamesFile,
	wordsFile,
	HANGMAN_MAX_WRONG,
	pickWord,
	getActiveGame,
	setActiveGame,
	isGameAllowedInChannel,
	getCustomWords,
	addCustomWord,
	removeCustomWord,
	setCustomWords,
	buildWordleEmbed,
	evaluateWordleGuess,
	buildHangmanEmbed,
	generateMinesweeperBoard,
	revealMinesweeperFlood,
	checkMinesweeperWin,
	buildMinesweeperRows,
	buildMinesweeperEmbed,
	awardMinigameWin,
	awardWin,
	buildHelpEmbed,
};
