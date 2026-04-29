const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getLeaderboard, getLevelLeaderboard } = require('../../lib/economyService');

const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Bekijk de top van de server')
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription('Welk leaderboard?')
				.addChoices(
					{ name: 'kroontjes', value: 'crowns' },
					{ name: 'levels', value: 'levels' },
				)
				.setRequired(true)),
	async execute(interaction) {
		const type = interaction.options.getString('type');

		if (type === 'crowns') {
			const top = getLeaderboard({ crownsFile, guildId: interaction.guildId, limit: 10 });
			if (top.length === 0) {
				await interaction.reply({ content: 'Nog geen kroontjes verdiend op deze server.', flags: 64 });
				return;
			}

			const lines = top.map((entry, idx) => `**${idx + 1}.** <@${entry.userId}> — ${entry.balance} kroontjes`);
			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle('Kroontjes leaderboard')
				.setDescription(lines.join('\n'));
			await interaction.reply({ embeds: [embed] });
			return;
		}

		const top = getLevelLeaderboard({ levelsFile, guildId: interaction.guildId, limit: 10 });
		if (top.length === 0) {
			await interaction.reply({ content: 'Nog geen XP verdiend op deze server.', flags: 64 });
			return;
		}

		const lines = top.map((entry, idx) => `**${idx + 1}.** <@${entry.userId}> — level ${entry.level} (${entry.xp} XP)`);
		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Level leaderboard')
			.setDescription(lines.join('\n'));
		await interaction.reply({ embeds: [embed] });
	},
};
