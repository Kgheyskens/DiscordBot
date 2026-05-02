const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} = require('discord.js');
const { addBalance, getBalance, subtractBalance } = require('../../lib/coinService');
const { isEconomyEnabled } = require('../../lib/economyService');
const {
	createDeck,
	drawCard,
	handValue,
	formatHand,
	isBlackjack,
	isBust,
} = require('../../lib/blackjackService');
const { readJson, writeJson } = require('../../lib/jsonStore');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');
const blackjackGamesFile = path.join(__dirname, '..', '..', 'data', 'blackjackGames.json');

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function createGameId() {
	return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildGambleEmbed(title, description, color = 0xb40f0f) {
	return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}

function getRouletteResult() {
	const slots = [...Array(18).fill('rood'), ...Array(18).fill('zwart'), 'groen'];
	return slots[Math.floor(Math.random() * slots.length)];
}

function getRouletteMultiplier(choice) {
	return choice === 'groen' ? 14 : 2;
}

function formatCurrency(amount) {
	return `${amount} coins`;
}

function buildCountdownText(secondsLeft) {
	return `Het resultaat komt over **${secondsLeft}** seconden.`;
}

async function resolveMessage(channel, messageId, fallbackMessage = null) {
	if (!channel?.messages?.fetch || !messageId) {
		return fallbackMessage;
	}

	return channel.messages.fetch(messageId).catch(() => fallbackMessage);
}

async function editGameMessage(channel, messageId, fallbackMessage, payload, errorLabel) {
	const targetMessage = await resolveMessage(channel, messageId, fallbackMessage);
	if (!targetMessage) {
		console.error(`Could not resolve message for ${errorLabel}.`);
		return null;
	}

	await targetMessage.edit(payload).catch(error => {
		console.error(`Failed to edit ${errorLabel}:`, error);
	});

	return targetMessage;
}

async function runResultCountdown(channel, messageId, fallbackMessage, title, finalDescriptionBuilder, mentionText = '', seconds = 10) {
	// Initial edit shows the mention + countdown
	await editGameMessage(channel, messageId, fallbackMessage, {
		content: `${mentionText} ${buildCountdownText(seconds)}`.trim(),
		embeds: [buildGambleEmbed(title, buildCountdownText(seconds))],
	}, `${title} initial countdown`);

	for (let remaining = seconds - 1; remaining >= 1; remaining -= 1) {
		await sleep(1000);
		await editGameMessage(channel, messageId, fallbackMessage, {
			content: `${mentionText} ${buildCountdownText(remaining)}`.trim(),
			embeds: [buildGambleEmbed(title, buildCountdownText(remaining))],
		}, `${title} countdown tick ${remaining}`);
	}

	await sleep(1000);
	await editGameMessage(channel, messageId, fallbackMessage, {
		content: `${mentionText} ${finalDescriptionBuilder()}`.trim(),
		embeds: [buildGambleEmbed(title, finalDescriptionBuilder())],
	}, `${title} final result`);
}

function loadBlackjackGames() {
	return readJson(blackjackGamesFile, {});
}

function saveBlackjackGames(games) {
	writeJson(blackjackGamesFile, games);
}

function buildBlackjackEmbed(state, revealDealer = false, statusText = '') {
	const playerTotal = handValue(state.playerHand);
	const dealerTotal = revealDealer ? handValue(state.dealerHand) : '??';
	const dealerCards = formatHand(state.dealerHand, !revealDealer);
	const playerCards = formatHand(state.playerHand, false);

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Blackjack is nu draaiende')
		.setDescription(statusText || 'Hit of stand? Kies wat je wilt doen.');

	embed.addFields(
		{ name: 'Inzet', value: formatCurrency(state.bet), inline: true },
		{ name: 'Dealer', value: `${dealerCards}\nTotaal: ${dealerTotal}`, inline: true },
		{ name: 'Jij', value: `${playerCards}\nTotaal: ${playerTotal}`, inline: true },
	);

	return embed;
}

function buildBlackjackButtons(gameId, disabled = false) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`blackjack:${gameId}:hit`).setLabel('Hit').setStyle(ButtonStyle.Danger).setDisabled(disabled),
		new ButtonBuilder().setCustomId(`blackjack:${gameId}:stand`).setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
	);
}

async function settleBlackjackGame(interaction, state, reason) {
	while (handValue(state.dealerHand) < 17) {
		state.dealerHand.push(drawCard(state.deck));
	}

	const playerTotal = handValue(state.playerHand);
	const dealerTotal = handValue(state.dealerHand);
	const dealerBust = isBust(state.dealerHand);
	const playerBlackjack = isBlackjack(state.playerHand);
	const dealerBlackjack = isBlackjack(state.dealerHand);

	let resultText = 'Gelijkspel.';
	if (playerTotal > 21) {
		resultText = `Je bent busted en verliest ${formatCurrency(state.bet)}.`;
	} else if (dealerBust) {
		addBalance(coinsFile, interaction.guildId, interaction.user.id, state.bet * 2);
		resultText = `Dealer is busted. Je wint ${formatCurrency(state.bet)}!`;
	} else if (playerBlackjack && !dealerBlackjack) {
		addBalance(coinsFile, interaction.guildId, interaction.user.id, Math.ceil(state.bet * 2.5));
		resultText = `Blackjack! Je wint extra veel en krijgt ${Math.ceil(state.bet * 2.5)} coins terug.`;
	} else if (dealerBlackjack && !playerBlackjack) {
		resultText = `Dealer heeft blackjack. Je verliest ${formatCurrency(state.bet)}.`;
	} else if (playerTotal > dealerTotal) {
		addBalance(coinsFile, interaction.guildId, interaction.user.id, state.bet * 2);
		resultText = `Je hebt gewonnen met ${playerTotal} tegen ${dealerTotal}.`;
	} else if (playerTotal < dealerTotal) {
		resultText = `Dealer wint met ${dealerTotal} tegen ${playerTotal}. Je verliest ${formatCurrency(state.bet)}.`;
	} else {
		addBalance(coinsFile, interaction.guildId, interaction.user.id, state.bet);
		resultText = `Gelijkspel met ${playerTotal}. Je krijgt je inzet terug.`;
	}

	state.finished = true;
	state.reason = reason;
	const games = loadBlackjackGames();
	games[state.gameId] = state;
	saveBlackjackGames(games);

	return {
		embed: buildBlackjackEmbed(state, true, resultText),
		components: [buildBlackjackButtons(state.gameId, true)],
	};
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gamble')
		.setDescription('Speel gokspellen met coins')
		.addSubcommand(subcommand =>
			subcommand
				.setName('coinflip')
				.setDescription('Gooi een munt en kies een kant')
				.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins je inzet').setRequired(true))
				.addStringOption(option =>
					option
						.setName('choice')
						.setDescription('Welke kant je kiest')
						.addChoices(
							{ name: 'kop', value: 'kop' },
							{ name: 'munt', value: 'munt' },
						)
						.setRequired(true)),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('roulette')
					.setDescription('Speel roulette met een kleur')
					.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins je inzet').setRequired(true))
					.addStringOption(option =>
						option
							.setName('choice')
							.setDescription('Welke kleur je kiest')
							.addChoices(
								{ name: 'rood', value: 'rood' },
								{ name: 'zwart', value: 'zwart' },
								{ name: 'groen', value: 'groen' },
							)
							.setRequired(true)),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('blackjack')
					.setDescription('Speel blackjack tegen de dealer')
					.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins je inzet').setRequired(true))),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: 'Het economy-systeem staat uit. Een admin moet het inschakelen via /setup.', flags: 64 });
			return;
		}

		await interaction.deferReply();

		if (subcommand === 'coinflip') {
			const amount = interaction.options.getInteger('amount');
			const choice = interaction.options.getString('choice');
			const balance = getBalance(coinsFile, interaction.guildId, interaction.user.id);

			if (balance < amount) {
				await interaction.reply({ content: `Je hebt maar ${balance} coins.`, flags: 64 });
				return;
			}

			subtractBalance(coinsFile, interaction.guildId, interaction.user.id, amount);
			const initialCoinContent = `<@${interaction.user.id}> heeft ${formatCurrency(amount)} ingezet — ${buildCountdownText(10)}`;
			const replyMessage = await interaction.editReply({
				content: initialCoinContent,
				embeds: [buildGambleEmbed('Coinflip', buildCountdownText(10))],
			});

			const result = Math.random() < 0.5 ? 'kop' : 'munt';
			const won = result === choice;
			if (won) {
				addBalance(coinsFile, interaction.guildId, interaction.user.id, amount * 2);
			}

			await runResultCountdown(interaction.channel, replyMessage.id, replyMessage, 'Coinflip', () => (
				won
					? `Het werd **${result}**. Je wint en krijgt ${formatCurrency(amount * 2)} terug.`
					: `Het werd **${result}**. Jammer, je bent ${formatCurrency(amount)} kwijt.`
			), `<@${interaction.user.id}> heeft ${formatCurrency(amount)} ingezet —`, 10);
			return;
		}

		if (subcommand === 'roulette') {
			const amount = interaction.options.getInteger('amount');
			const choice = interaction.options.getString('choice');
			const balance = getBalance(coinsFile, interaction.guildId, interaction.user.id);

			if (balance < amount) {
				await interaction.reply({ content: `Je hebt maar ${balance} coins.`, flags: 64 });
				return;
			}

			subtractBalance(coinsFile, interaction.guildId, interaction.user.id, amount);
			const initialRouletteContent = `<@${interaction.user.id}> heeft ${formatCurrency(amount)} ingezet — ${buildCountdownText(10)}`;
			const replyMessage = await interaction.editReply({
				content: initialRouletteContent,
				embeds: [buildGambleEmbed('Roulette', buildCountdownText(10))],
			});

			const result = getRouletteResult();
			const won = result === choice;
			const multiplier = getRouletteMultiplier(choice);
			if (won) {
				addBalance(coinsFile, interaction.guildId, interaction.user.id, amount * multiplier);
			}

			await runResultCountdown(interaction.channel, replyMessage.id, replyMessage, 'Roulette', () => (
				won
					? `De bal viel op **${result}**. Je wint en krijgt ${formatCurrency(amount * multiplier)} terug.`
					: `De bal viel op **${result}**. Jammer, je bent ${formatCurrency(amount)} kwijt.`
			), `<@${interaction.user.id}> heeft ${formatCurrency(amount)} ingezet —`, 10);
			return;
		}

		if (subcommand === 'blackjack') {
			const amount = interaction.options.getInteger('amount');
			const balance = getBalance(coinsFile, interaction.guildId, interaction.user.id);

			if (balance < amount) {
				await interaction.reply({ content: `Je hebt maar ${balance} coins.`, flags: 64 });
				return;
			}

			subtractBalance(coinsFile, interaction.guildId, interaction.user.id, amount);

			const gameId = createGameId();
			const state = {
				gameId,
				guildId: interaction.guildId,
				channelId: interaction.channelId,
				messageId: null,
				userId: interaction.user.id,
				bet: amount,
				deck: createDeck(),
				playerHand: [],
				dealerHand: [],
				finished: false,
			};

			state.playerHand.push(drawCard(state.deck));
			state.dealerHand.push(drawCard(state.deck));
			state.playerHand.push(drawCard(state.deck));
			state.dealerHand.push(drawCard(state.deck));

			const games = loadBlackjackGames();
			games[gameId] = state;
			saveBlackjackGames(games);

			if (isBlackjack(state.playerHand) || isBlackjack(state.dealerHand)) {
				const result = await settleBlackjackGame(interaction, state, 'start');
				const replyMessage = await interaction.editReply({
					embeds: [result.embed],
					components: result.components,
				}).catch(error => {
					console.error('Failed to send blackjack start reply:', error);
					return null;
				});
				if (replyMessage) {
					state.messageId = replyMessage.id;
				}
				games[gameId] = state;
				saveBlackjackGames(games);
				return;
			}

			const replyMessage = await interaction.editReply({
				embeds: [buildBlackjackEmbed(state, false, 'Blackjack is nu draaiende. Gebruik Hit of Stand.')],
				components: [buildBlackjackButtons(gameId)],
			});
			if (replyMessage) {
				state.messageId = replyMessage.id;
			}
			games[gameId] = state;
			saveBlackjackGames(games);
			return;
		}

		await interaction.reply({ content: 'Onbekende gamble actie.', flags: 64 });
	},
};