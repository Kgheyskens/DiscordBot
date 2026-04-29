const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editembed')
		.setDescription('Bewerk een bestaande embed boodschap')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('Kanaal van de boodschap')
				.setRequired(true))
			.addStringOption(option =>
				option
					.setName('messageid')
					.setDescription('ID van de te bewerken boodschap')
					.setRequired(true))
			.addStringOption(option =>
				option
					.setName('title')
					.setDescription('Nieuwe titel')
					.setRequired(false))
			.addStringOption(option =>
				option
					.setName('description')
					.setDescription('Nieuwe beschrijving')
					.setRequired(false))
			.addStringOption(option =>
				option
					.setName('color')
					.setDescription('Hex kleur zonder #, default b40f0f')
					.setRequired(false))
			.addStringOption(option =>
				option
					.setName('footer')
					.setDescription('Footer tekst')
					.setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Je hebt Manage Messages nodig om dit te doen.', flags: 64 });
			return;
		}

		const channel = interaction.options.getChannel('channel');
		const messageId = interaction.options.getString('messageid');
		const title = interaction.options.getString('title');
		const description = interaction.options.getString('description');
		const color = interaction.options.getString('color') || 'b40f0f';
		const footer = interaction.options.getString('footer');

		if (!channel?.isTextBased()) {
			await interaction.reply({ content: 'Kies een tekstkanaal.', flags: 64 });
			return;
		}

		const message = await channel.messages.fetch(messageId).catch(() => null);
		if (!message) {
			await interaction.reply({ content: 'Kon de boodschap niet vinden.', flags: 64 });
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(parseInt(color.replace('#', ''), 16) || 0xb40f0f);

		if (title) embed.setTitle(title);
		if (description) embed.setDescription(description);
		if (footer) embed.setFooter({ text: footer });

		await message.edit({ embeds: [embed] });
		await interaction.reply({ content: 'De embed is aangepast.', flags: 64 });
	},
};