const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const coinService = require('../../lib/coinService');
const crownService = require('../../lib/crownService');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Bekijk je coins en kroontjes')
		.addUserOption(option => option.setName('user').setDescription('Bekijk de balans van iemand anders')),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });
		const target = interaction.options.getUser('user') || interaction.user;
		const coins = coinService.getBalance(coinsFile, interaction.guildId, target.id);
		const kroontjes = crownService.getBalance(crownsFile, interaction.guildId, target.id);
		const config = crownService.getCrownConfig(crownsConfigFile, interaction.guildId);

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle(`Balans van ${target.username}`)
			.addFields(
				{ name: '🪙 Coins', value: `${coins}`, inline: true },
				{ name: '👑 Kroontjes', value: `${kroontjes}`, inline: true },
			)
			.setFooter({ text: config.enabled ? `Kroontjes-spawn ${config.chancePercent}%` : 'Kroontjes-spawn uitgeschakeld' });

		await interaction.editReply({ embeds: [embed] });
	},
};
