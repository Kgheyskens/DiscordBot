const path = require('path');
const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const welcomeConfigFile = path.join(__dirname, '..', '..', 'data', 'welcomeConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setwelcomechannel')
		.setDescription('Stel het welkomstkanaal in')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('Tekstkanaal voor welkomstberichten')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
			return;
		}

		const channel = interaction.options.getChannel('channel');
		if (!channel || !channel.isTextBased()) {
			await interaction.reply({ content: 'Kies een tekstkanaal.', flags: 64 });
			return;
		}

		const allConfigs = readJson(welcomeConfigFile, {});
		allConfigs[interaction.guildId] = { channelId: channel.id };
		writeJson(welcomeConfigFile, allConfigs);

		await interaction.reply({ content: `Welkomstberichten gaan nu naar ${channel}.`, flags: 64 });
	},
};