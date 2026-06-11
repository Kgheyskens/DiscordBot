const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clear')
		.setDescription('Leeg de wachtrij (huidig nummer blijft spelen)'),
	async execute(interaction) {
		const state = musicService.getState(interaction.guildId);
		if (!state || state.queue.length === 0) {
			await interaction.reply({ content: '📭 De wachtrij is al leeg.', flags: 64 });
			return;
		}
		const count = musicService.clear(interaction.guildId);
		await interaction.reply({ content: `🧹 Wachtrij geleegd (${count} nummer(s) verwijderd).` });
	},
};
