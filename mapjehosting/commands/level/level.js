const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { readJson } = require('../../lib/jsonStore');
const { getRequiredXp } = require('../../lib/leveling');

const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('level')
		.setDescription('Shows your current level and XP'),
	async execute(interaction) {
		const allLevels = readJson(levelsFile, {});
		const guildLevels = allLevels[interaction.guildId] || {};
		const userLevelData = guildLevels[interaction.user.id] || { xp: 0, level: 0 };
		const nextRequiredXp = getRequiredXp(userLevelData.level);

		const embed = new EmbedBuilder()
			.setColor(0xff0000)
			.setTitle(`${interaction.user.username}'s level`)
			.addFields(
				{ name: 'Level', value: String(userLevelData.level), inline: true },
				{ name: 'XP', value: `${userLevelData.xp} / ${nextRequiredXp}`, inline: true },
			)
			.setFooter({ text: 'Level systeem' });

		await interaction.reply({ embeds: [embed] });
	},
};