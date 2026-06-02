const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} = require('discord.js');
const { readJson } = require('../../lib/jsonStore');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');

const ITEMS_PER_PAGE = 10;

function getLeaderboardData(guildId, type) {
	let data = {};
	let file = coinsFile;

	switch (type) {
		case 'coins':
			data = readJson(coinsFile, {})[guildId] || {};
			break;
		case 'levels':
			const levelsData = readJson(levelsFile, {})[guildId] || {};
			for (const [userId, userData] of Object.entries(levelsData)) {
				data[userId] = userData.level || 0;
			}
			break;
		case 'crowns':
			data = readJson(crownsFile, {})[guildId] || {};
			break;
	}

	const entries = Object.entries(data)
		.map(([userId, value]) => ({ userId, value: typeof value === 'object' ? value.level || 0 : value }))
		.sort((a, b) => b.value - a.value);

	return entries;
}

function buildLeaderboardEmbed(entries, page, type, guildId) {
	const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
	const start = page * ITEMS_PER_PAGE;
	const pageEntries = entries.slice(start, start + ITEMS_PER_PAGE);

	const medals = ['🥇', '🥈', '🥉'];
	const lines = pageEntries.map((entry, idx) => {
		const medal = medals[start + idx] || `#${start + idx + 1}`;
		const username = `<@${entry.userId}>`;
		return `${medal} ${username} — **${entry.value}** ${type === 'coins' ? 'coins' : type === 'crowns' ? 'crowns' : 'level'}`;
	});

	const titleMap = {
		coins: '💰 Coin Leaderboard',
		levels: '🎮 Level Leaderboard',
		crowns: '👑 Crown Leaderboard',
	};

	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(titleMap[type] || 'Leaderboard')
		.setDescription(lines.join('\n') || 'No data yet.')
		.setFooter({ text: `Page ${page + 1}/${totalPages}` });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('View server leaderboards')
		.addStringOption(opt =>
			opt.setName('type')
				.setDescription('Leaderboard type')
				.addChoices(
					{ name: 'Coins', value: 'coins' },
					{ name: 'Levels', value: 'levels' },
					{ name: 'Crowns', value: 'crowns' },
				)
				.setRequired(true)),
	async execute(interaction) {
		const type = interaction.options.getString('type');
		const entries = getLeaderboardData(interaction.guildId, type);

		if (entries.length === 0) {
			await interaction.reply({ content: 'No data for this leaderboard yet.', flags: 64 });
			return;
		}

		const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);

		function buildButtons(page) {
			return new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`lb:first:${type}`)
					.setLabel('First')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`lb:prev:${type}`)
					.setLabel('←')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`lb:next:${type}`)
					.setLabel('→')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === totalPages - 1),
				new ButtonBuilder()
					.setCustomId(`lb:last:${type}`)
					.setLabel('Last')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === totalPages - 1),
			);
		}

		await interaction.reply({
			embeds: [buildLeaderboardEmbed(entries, 0, type, interaction.guildId)],
			components: [buildButtons(0)],
		});
	},
	leaderboardCache: new Map(),
};
