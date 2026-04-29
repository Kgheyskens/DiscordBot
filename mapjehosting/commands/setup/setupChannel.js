const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { setChannel } = require('../../lib/guildSettings');

const FEATURES = ['welcome', 'levels', 'counting', 'twitch', 'ticketCategory', 'ticketPanel'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup-channel')
		.setDescription('Snel een channel instellen voor een feature')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false)
		.addStringOption(opt =>
			opt.setName('feature').setDescription('Welk feature?').setRequired(true)
				.addChoices(...FEATURES.map(f => ({ name: f, value: f }))))
		.addChannelOption(opt =>
			opt.setName('channel').setDescription('Het channel').setRequired(true)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins.', flags: 64 });
			return;
		}

		const feature = interaction.options.getString('feature');
		const channel = interaction.options.getChannel('channel');

		if (feature === 'ticketCategory' && channel.type !== ChannelType.GuildCategory) {
			await interaction.reply({ content: 'ticketCategory moet een category zijn.', flags: 64 });
			return;
		}
		if (feature !== 'ticketCategory' && !channel.isTextBased()) {
			await interaction.reply({ content: 'Kies een tekst-channel.', flags: 64 });
			return;
		}

		setChannel(interaction.guildId, feature, channel.id);
		await interaction.reply({ content: `Channel voor **${feature}** ingesteld op <#${channel.id}>.`, flags: 64 });
	},
};
