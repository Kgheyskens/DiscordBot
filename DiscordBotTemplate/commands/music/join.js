const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('join')
		.setDescription('Laat de bot je voice channel binnenkomen'),
	async execute(interaction) {
		const voiceChannel = interaction.member?.voice?.channel;
		if (!voiceChannel) {
			await interaction.reply({ content: '❌ Je moet eerst in een voice channel zitten.', flags: 64 });
			return;
		}

		try {
			await musicService.joinChannel(voiceChannel, interaction.channel);
		} catch (err) {
			await interaction.reply({ content: `❌ ${err.message}`, flags: 64 });
			return;
		}

		await interaction.reply({ content: `✅ Verbonden met **${voiceChannel.name}**.` });
	},
};
