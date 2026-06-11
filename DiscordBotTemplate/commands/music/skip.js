const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription('Sla het huidige nummer over'),
	async execute(interaction) {
		if (!musicService.isConnected(interaction.guildId)) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}
		const state = musicService.getState(interaction.guildId);
		if (!state?.nowPlaying) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}
		const skipped = musicService.skip(interaction.guildId);
		await interaction.reply({ content: `⏭️ Overgeslagen: **${skipped?.title || 'nummer'}**.` });
	},
};
