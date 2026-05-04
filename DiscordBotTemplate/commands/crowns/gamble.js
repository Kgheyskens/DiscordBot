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

const MAX_BET = 1_000_000;

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

function validateBet(amount, balance) {
	if (!Number.isInteger(amount) || amount <= 0) {
		return { error: '❌ Je inzet moet een positief geheel getal zijn (minimaal 1 coin).' };
	}
	if (amount > MAX_BET) {
		return { error: `❌ Maximum inzet is ${MAX_BET.toLocaleString('nl-BE')} coins.` };
	}
	if (balance < amount) {
		return { error: `❌ Niet genoeg coins. Je hebt **${balance}** coins, je probeerde **${amount}** in te zetten.` };
	}
	return { ok: true };
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

function settleInitialBlackjack(state, guildId, userId) {
	const playerTotal = handValue(state.playerHand);
	const dealerTotal = handValue(state.dealerHand);
	const playerBlackjack = isBlackjack(state.playerHand);
	const dealerBlackjack = isBlackjack(state.dealerHand);

	let net = 0;
	let resultText;
	if (playerBlackjack && dealerBlackjack) {
		addBalance(coinsFile, guildId, userId, state.bet);
		resultText = `Beide blackjack! Gelijkspel — je krijgt je inzet (${formatCurrency(state.bet)}) terug.`;
	} else if (playerBlackjack) {
		const payout = Math.ceil(state.bet * 2.5);
		addBalance(coinsFile, guildId, userId, payout);
		net = payout - state.bet;
		resultText = `🎉 Blackjack! Je wint **+${formatCurrency(net)}** (uitbetaling ${formatCurrency(payout)}).`;
	} else {
		net = -state.bet;
		resultText = `💥 Dealer heeft blackjack. Je verliest **${formatCurrency(state.bet)}**.`;
	}

	state.finished = true;
	state.netResult = net;
	state.reason = 'initial-blackjack';
	return { resultText, net };
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gamble')
		.setDescription('Speel gokspellen met coins')
		.addSubcommand(subcommand =>
			subcommand
				.setName('coinflip')
				.setDescription('Gooi een munt en kies een kant')
				.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins je inzet').setMinValue(1).setMaxValue(MAX_BET).setRequired(true))
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
					.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins je inzet').setMinValue(1).setMaxValue(MAX_BET).setRequired(true))
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
					.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel coins je inzet').setMinValue(1).setMaxValue(MAX_BET).setRequired(true))),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: '❌ Het economy-systeem staat uit. Een admin moet het inschakelen via `/setup → Economy`.', flags: 64 });
			return;
		}

		const amount = interaction.options.getInteger('amount');
		const balance = getBalance(coinsFile, interaction.guildId, interaction.user.id);
		const validation = validateBet(amount, balance);
		if (validation.error) {
			await interaction.reply({ content: validation.error, flags: 64 });
			return;
		}

		await interaction.deferReply();

		if (subcommand === 'coinflip') {
			const choice = interaction.options.getString('choice');

			if (subtractBalance(coinsFile, interaction.guildId, interaction.user.id, amount) === null) {
				await interaction.editReply({ content: '❌ Je balans is intussen veranderd; je hebt nu niet genoeg coins meer.' });
				return;
			}

			const initialCoinContent = `<@${interaction.user.id}> heeft ${formatCurrency(amount)} ingezet — ${buildCountdownText(3)}`;
			const replyMessage = await interaction.editReply({
				content: initialCoinContent,
				embeds: [buildGambleEmbed('Coinflip', buildCountdownText(3))],
			});

			const result = Math.random() < 0.5 ? 'kop' : 'munt';
			const won = result === choice;
			if (won) {
				addBalance(coinsFile, interaction.guildId, interaction.user.id, amount * 2);
			}

			await runResultCountdown(interaction.channel, replyMessage.id, replyMessage, 'Coinflip', () => (
				won
					? `🎉 Het werd **${result}**. Je wint **+${formatCurrency(amount)}** (uitbetaling ${formatCurrency(amount * 2)}).`
					: `💸 Het werd **${result}**. Jammer, je verliest **${formatCurrency(amount)}**.`
			), `<@${interaction.user.id}>`, 3);
			return;
		}

		if (subcommand === 'roulette') {
			const choice = interaction.options.getString('choice');

			if (subtractBalance(coinsFile, interaction.guildId, interaction.user.id, amount) === null) {
				await interaction.editReply({ content: '❌ Je balans is intussen veranderd; je hebt nu niet genoeg coins meer.' });
				return;
			}

			const initialRouletteContent = `<@${interaction.user.id}> heeft ${formatCurrency(amount)} ingezet — ${buildCountdownText(3)}`;
			const replyMessage = await interaction.editReply({
				content: initialRouletteContent,
				embeds: [buildGambleEmbed('Roulette', buildCountdownText(3))],
			});

			const result = getRouletteResult();
			const won = result === choice;
			const multiplier = getRouletteMultiplier(choice);
			if (won) {
				addBalance(coinsFile, interaction.guildId, interaction.user.id, amount * multiplier);
			}

			await runResultCountdown(interaction.channel, replyMessage.id, replyMessage, 'Roulette', () => (
				won
					? `🎉 De bal viel op **${result}**. Je wint **+${formatCurrency(amount * (multiplier - 1))}** (uitbetaling ${formatCurrency(amount * multiplier)}).`
					: `💸 De bal viel op **${result}**. Jammer, je verliest **${formatCurrency(amount)}**.`
			), `<@${interaction.user.id}>`, 3);
			return;
		}

		if (subcommand === 'blackjack') {
			if (subtractBalance(coinsFile, interaction.guildId, interaction.user.id, amount) === null) {
				await interaction.editReply({ content: '❌ Je balans is intussen veranderd; je hebt nu niet genoeg coins meer.' });
				return;
			}

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
				const { resultText } = settleInitialBlackjack(state, interaction.guildId, interaction.user.id);
				const replyMessage = await interaction.editReply({
					content: `<@${interaction.user.id}> ${resultText}`,
					embeds: [buildBlackjackEmbed(state, true, resultText)],
					components: [buildBlackjackButtons(gameId, true)],
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
				content: `<@${interaction.user.id}> blackjack gestart met inzet ${formatCurrency(amount)}.`,
				embeds: [buildBlackjackEmbed(state, false, 'Blackjack is nu draaiende. Gebruik Hit of Stand.')],
				components: [buildBlackjackButtons(gameId)],
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

		await interaction.editReply({ content: '❌ Onbekende gamble actie.' }).catch(() => null);
	},
};
