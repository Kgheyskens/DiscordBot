const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leave')
		.setDescription('Laat de bot het voice channel verlaten'),
	async execute(interaction) {
		if (!musicService.isConnected(interaction.guildId)) {
			await interaction.reply({ content: '❌ De bot zit niet in een voice channel.', flags: 64 });
			return;
		}
		musicService.destroy(interaction.guildId);
		await interaction.reply({ content: '👋 Voice channel verlaten.' });
	},
};
