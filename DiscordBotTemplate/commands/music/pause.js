const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pause')
		.setDescription('Pauzeer de muziek'),
	async execute(interaction) {
		const state = musicService.getState(interaction.guildId);
		if (!state?.nowPlaying) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}
		const ok = musicService.pause(interaction.guildId);
		await interaction.reply({ content: ok ? '⏸️ Gepauzeerd.' : '❌ Kon niet pauzeren.' });
	},
};
