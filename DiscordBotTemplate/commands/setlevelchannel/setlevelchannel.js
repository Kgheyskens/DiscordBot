const path = require('path');
const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const levelsChannelFile = path.join(__dirname, '..', '..', 'data', 'levelsChannel.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setlevelchannel')
		.setDescription('Stelt het kanaal in voor level-up berichten')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('Kanaal waar level-ups naartoe moeten gaan')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
			return;
		}

		const channel = interaction.options.getChannel('channel');
		if (!channel || channel.type !== ChannelType.GuildText) {
			await interaction.reply({ content: 'Kies een tekstkanaal.', flags: 64 });
			return;
		}

		try {
			const allLevelsChannels = readJson(levelsChannelFile, {});
			allLevelsChannels[interaction.guildId] = { channelId: channel.id };
			writeJson(levelsChannelFile, allLevelsChannels);
			await interaction.reply({ content: `Level-up berichten gaan nu naar ${channel}.`, flags: 64 });
		} catch (err) {
			console.error('setlevelchannel failed:', err);
			await interaction.reply({ content: 'Kon het level-kanaal niet opslaan.', flags: 64 });
		}
	},
};
