const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getLeaderboard, getLevelLeaderboard } = require('../../lib/economyService');
const { readJson } = require('../../lib/jsonStore');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');

function getKroontjesLeaderboard(guildId, limit = 10) {
	const all = readJson(crownsFile, {});
	const guild = all[guildId] || {};
	return Object.entries(guild)
		.map(([userId, balance]) => ({ userId, balance }))
		.sort((a, b) => b.balance - a.balance)
		.slice(0, Math.max(1, limit));
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Bekijk de top van de server')
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription('Welk leaderboard?')
				.addChoices(
					{ name: 'coins', value: 'coins' },
					{ name: 'kroontjes', value: 'kroontjes' },
					{ name: 'levels', value: 'levels' },
				)
				.setRequired(true)),
	async execute(interaction) {
		const type = interaction.options.getString('type');

		if (type === 'coins') {
			const top = getLeaderboard({ coinsFile, guildId: interaction.guildId, limit: 10 });
			if (top.length === 0) {
				await interaction.reply({ content: 'Nog geen coins verdiend op deze server.', flags: 64 });
				return;
			}
			const lines = top.map((entry, idx) => `**${idx + 1}.** <@${entry.userId}> — ${entry.balance} coins`);
			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle('🪙 Coins leaderboard')
				.setDescription(lines.join('\n'));
			await interaction.reply({ embeds: [embed] });
			return;
		}

		if (type === 'kroontjes') {
			const top = getKroontjesLeaderboard(interaction.guildId, 10);
			if (top.length === 0) {
				await interaction.reply({ content: 'Nog geen kroontjes verdiend op deze server.', flags: 64 });
				return;
			}
			const lines = top.map((entry, idx) => `**${idx + 1}.** <@${entry.userId}> — ${entry.balance} kroontjes`);
			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle('👑 Kroontjes leaderboard')
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
