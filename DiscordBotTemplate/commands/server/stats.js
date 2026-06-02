const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { readJson } = require('../../lib/jsonStore');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('View server statistics')
		.addStringOption(opt =>
			opt.setName('type')
				.setDescription('What stats to view')
				.addChoices(
					{ name: 'Server Overview', value: 'server' },
					{ name: 'Your Stats', value: 'user' },
				)
				.setRequired(true)),
	async execute(interaction) {
		const type = interaction.options.getString('type');

		if (type === 'server') {
			const levelsData = readJson(levelsFile, {})[interaction.guildId] || {};
			const coinsData = readJson(coinsFile, {})[interaction.guildId] || {};
			const crownsData = readJson(crownsFile, {})[interaction.guildId] || {};

			const userCount = Object.keys(levelsData).length;
			const totalXp = Object.values(levelsData).reduce((sum, user) => sum + (user.xp || 0), 0);
			const avgLevel = userCount > 0 ? (Object.values(levelsData).reduce((sum, user) => sum + (user.level || 0), 0) / userCount).toFixed(1) : 0;
			const totalCoins = Object.values(coinsData).reduce((sum, bal) => sum + (bal || 0), 0);
			const totalCrowns = Object.values(crownsData).reduce((sum, bal) => sum + (bal || 0), 0);

			const topUsers = Object.entries(levelsData)
				.sort(([, a], [, b]) => (b.level || 0) - (a.level || 0))
				.slice(0, 3)
				.map(([userId, data], idx) => `${idx + 1}. <@${userId}> - Level ${data.level || 0}`);

			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setTitle(`📊 Server Statistics — ${interaction.guild.name}`)
				.addFields(
					{ name: '👥 Active Members', value: `**${userCount}**`, inline: true },
					{ name: '🎮 Average Level', value: `**${avgLevel}**`, inline: true },
					{ name: '💰 Total Coins', value: `**${totalCoins}**`, inline: true },
					{ name: '👑 Total Crowns', value: `**${totalCrowns}**`, inline: true },
					{ name: '📈 Total XP', value: `**${totalXp}**`, inline: true },
					{ name: '🏆 Top 3 Members', value: topUsers.join('\n') || 'No data yet.', inline: false },
				)
				.setTimestamp();

			await interaction.reply({ embeds: [embed] });
		} else if (type === 'user') {
			const levelsData = readJson(levelsFile, {})[interaction.guildId] || {};
			const coinsData = readJson(coinsFile, {})[interaction.guildId] || {};
			const crownsData = readJson(crownsFile, {})[interaction.guildId] || {};

			const userLevel = levelsData[interaction.user.id] || { level: 0, xp: 0 };
			const userCoins = coinsData[interaction.user.id] || 0;
			const userCrowns = crownsData[interaction.user.id] || 0;

			const userRank = Object.entries(levelsData)
				.sort(([, a], [, b]) => (b.level || 0) - (a.level || 0))
				.findIndex(([userId]) => userId === interaction.user.id) + 1;

			const embed = new EmbedBuilder()
				.setColor(0xb40f0f)
				.setAuthor({
					name: interaction.user.username,
					iconURL: interaction.user.displayAvatarURL(),
				})
				.addFields(
					{ name: '🎮 Level', value: `**${userLevel.level}**`, inline: true },
					{ name: '📈 XP', value: `**${userLevel.xp}**`, inline: true },
					{ name: '🏆 Rank', value: `**#${userRank}**`, inline: true },
					{ name: '💰 Coins', value: `**${userCoins}**`, inline: true },
					{ name: '👑 Crowns', value: `**${userCrowns}**`, inline: true },
				)
				.setTimestamp();

			await interaction.reply({ embeds: [embed], flags: 64 });
		}
	},
};
