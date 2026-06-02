const { ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('confess')
		.setDescription('Submit an anonymous confession'),
	async execute(interaction) {
		const modal = new ModalBuilder()
			.setCustomId('confess_modal')
			.setTitle('Anonymous Confession');

		const confessionInput = new TextInputBuilder()
			.setCustomId('confession_text')
			.setLabel('Your confession (max 4000 chars)')
			.setStyle(TextInputStyle.Paragraph)
			.setMinLength(10)
			.setMaxLength(4000)
			.setPlaceholder('Share something you want to say anonymously...')
			.setRequired(true);

		modal.addComponents(new (require('discord.js')).ActionRowBuilder().addComponents(confessionInput));

		await interaction.showModal(modal);
	},
};
