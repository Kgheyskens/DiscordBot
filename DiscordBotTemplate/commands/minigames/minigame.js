const { SlashCommandBuilder } = require('discord.js');
const {
	pickWord,
	getActiveGame,
	setActiveGame,
	isGameAllowedInChannel,
	buildWordleEmbed,
	buildHangmanEmbed,
	generateMinesweeperBoard,
	buildMinesweeperRows,
	buildMinesweeperEmbed,
	buildHelpEmbed,
} = require('../../lib/minigameService');

const GAME_CHOICES = [
	{ name: 'wordle', value: 'wordle' },
	{ name: 'galgje (hangman)', value: 'hangman' },
	{ name: 'minesweeper', value: 'minesweeper' },
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('minigame')
		.setDescription('Speel een minigame')
		.addSubcommand(sub =>
			sub.setName('start')
				.setDescription('Start een minigame in dit kanaal')
				.addStringOption(opt => opt.setName('game').setDescription('Welke minigame').addChoices(...GAME_CHOICES).setRequired(true)))
		.addSubcommand(sub =>
			sub.setName('stop')
				.setDescription('Stop de actieve minigame in dit kanaal'))
		.addSubcommand(sub =>
			sub.setName('help')
				.setDescription('Uitleg voor een minigame')
				.addStringOption(opt => opt.setName('game').setDescription('Welke minigame').addChoices(...GAME_CHOICES).setRequired(true))),
	async execute(interaction) {
		const sub = interaction.options.getSubcommand();

		if (sub === 'help') {
			const game = interaction.options.getString('game');
			await interaction.reply({ embeds: [buildHelpEmbed(game)], flags: 64 });
			return;
		}

		if (sub === 'stop') {
			const active = getActiveGame(interaction.guildId, interaction.channelId);
			if (!active) {
				await interaction.reply({ content: 'Er is hier geen actieve minigame.', flags: 64 });
				return;
			}
			if (active.starterId !== interaction.user.id && !interaction.memberPermissions?.has('ManageMessages')) {
				await interaction.reply({ content: 'Alleen de starter (of een mod) kan stoppen.', flags: 64 });
				return;
			}
			setActiveGame(interaction.guildId, interaction.channelId, null);
			await interaction.reply({ content: 'Minigame gestopt.' });
			return;
		}

		const game = interaction.options.getString('game');
		const restriction = isGameAllowedInChannel(interaction.guildId, game, interaction.channelId);
		if (!restriction.allowed) {
			await interaction.reply({ content: restriction.reason, flags: 64 });
			return;
		}

		const existing = getActiveGame(interaction.guildId, interaction.channelId);
		if (existing && !existing.finished) {
			await interaction.reply({ content: `Er is al een **${existing.game}** actief in dit kanaal. Stop die eerst met \`/minigame stop\`.`, flags: 64 });
			return;
		}

		const starterTag = interaction.user.tag;

		if (game === 'wordle') {
			const answer = pickWord(interaction.guildId, 'wordle');
			const state = {
				game: 'wordle',
				answer,
				guesses: [],
				maxGuesses: 6,
				starterId: interaction.user.id,
				starterTag,
				channelId: interaction.channelId,
				messageId: null,
				startedAt: Date.now(),
				finished: false,
			};
			await interaction.reply({ embeds: [buildWordleEmbed(state)] });
			const sent = await interaction.fetchReply().catch(() => null);
			state.messageId = sent?.id || null;
			setActiveGame(interaction.guildId, interaction.channelId, state);
			return;
		}

		if (game === 'hangman') {
			const answer = pickWord(interaction.guildId, 'hangman');
			const state = {
				game: 'hangman',
				answer,
				guessed: [],
				wrong: [],
				starterId: interaction.user.id,
				starterTag,
				channelId: interaction.channelId,
				messageId: null,
				startedAt: Date.now(),
				finished: false,
			};
			await interaction.reply({ embeds: [buildHangmanEmbed(state)] });
			const sent = await interaction.fetchReply().catch(() => null);
			state.messageId = sent?.id || null;
			setActiveGame(interaction.guildId, interaction.channelId, state);
			return;
		}

		if (game === 'minesweeper') {
			const width = 5;
			const height = 4;
			const bombs = 7;
			const cells = generateMinesweeperBoard(width, height, bombs);
			const gameId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
			const state = {
				game: 'minesweeper',
				gameId,
				width,
				height,
				bombs,
				cells,
				flagMode: false,
				starterId: interaction.user.id,
				starterTag,
				channelId: interaction.channelId,
				startedAt: Date.now(),
				finished: false,
			};
			setActiveGame(interaction.guildId, interaction.channelId, state);
			await interaction.reply({
				embeds: [buildMinesweeperEmbed(state)],
				components: buildMinesweeperRows(state),
			});
		}
	},
};
