const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getBalance, getCrownConfig } = require('../../lib/crownService');

const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Bekijk hoeveel kroontjes je bezit'),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });
		const balance = getBalance(crownsFile, interaction.guildId, interaction.user.id);
		const config = getCrownConfig(crownsConfigFile, interaction.guildId);

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Kroontjes balans')
			.setDescription(`${interaction.user} heeft nu **${balance} kroontjes**.`)
			.addFields({
				name: 'Status',
				value: config.enabled ? `Actief met ${config.chancePercent}% spawnkans.` : 'Uitgeschakeld door een administrator.',
			});

		await interaction.editReply({ embeds: [embed] });
	},
};