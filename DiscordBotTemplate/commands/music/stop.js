const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stop de muziek en leeg de wachtrij'),
	async execute(interaction) {
		if (!musicService.isConnected(interaction.guildId)) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}
		musicService.stop(interaction.guildId);
		await interaction.reply({ content: '⏹️ Muziek gestopt en wachtrij geleegd.' });
	},
};
