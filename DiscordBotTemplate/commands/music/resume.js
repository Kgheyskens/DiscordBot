const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('resume')
		.setDescription('Hervat de muziek'),
	async execute(interaction) {
		const state = musicService.getState(interaction.guildId);
		if (!state?.nowPlaying) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}
		const ok = musicService.resume(interaction.guildId);
		await interaction.reply({ content: ok ? '▶️ Hervat.' : '❌ Kon niet hervatten.' });
	},
};
