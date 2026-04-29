const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { setRole } = require('../../lib/guildSettings');

const FEATURES = ['ticketSupport'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup-role')
		.setDescription('Snel een rol instellen voor een feature')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false)
		.addStringOption(opt =>
			opt.setName('feature').setDescription('Welk feature?').setRequired(true)
				.addChoices(...FEATURES.map(f => ({ name: f, value: f }))))
		.addRoleOption(opt =>
			opt.setName('role').setDescription('De rol').setRequired(true)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins.', flags: 64 });
			return;
		}

		const feature = interaction.options.getString('feature');
		const role = interaction.options.getRole('role');
		setRole(interaction.guildId, feature, role.id);
		await interaction.reply({ content: `Rol voor **${feature}** ingesteld op <@&${role.id}>.`, flags: 64 });
	},
};
