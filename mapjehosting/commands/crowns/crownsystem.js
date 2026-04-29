const path = require('path');
const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { getCrownConfig, setCrownConfig } = require('../../lib/crownService');

const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('crownsystem')
		.setDescription('Zet kroontjes aan of uit')
		.addBooleanOption(option =>
			option
				.setName('enabled')
				.setDescription('Zet kroontjes aan of uit')
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('chance')
				.setDescription('Kans in procenten om een kroontje te laten spawnen')
				.setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
			return;
		}

		const enabled = interaction.options.getBoolean('enabled');
		const chance = interaction.options.getInteger('chance');
		const config = setCrownConfig(crownsConfigFile, interaction.guildId, {
			enabled,
			chancePercent: chance ?? getCrownConfig(crownsConfigFile, interaction.guildId).chancePercent,
		});

		await interaction.reply({ content: `Kroontjes zijn ${config.enabled ? 'aan' : 'uit'} gezet. Kans: ${config.chancePercent}%.`, flags: 64 });
	},
};