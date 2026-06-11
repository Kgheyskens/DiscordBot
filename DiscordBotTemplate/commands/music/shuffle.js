const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription('Husselt de wachtrij'),
	async execute(interaction) {
		const state = musicService.getState(interaction.guildId);
		if (!state || state.queue.length < 2) {
			await interaction.reply({ content: '❌ Niet genoeg nummers in de wachtrij om te husselen.', flags: 64 });
			return;
		}
		musicService.shuffle(interaction.guildId);
		await interaction.reply({ content: `🔀 Wachtrij gehusseld (${state.queue.length} nummers).` });
	},
};
