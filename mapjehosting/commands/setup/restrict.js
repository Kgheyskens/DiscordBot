const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { setRule, clearRule, getRule } = require('../../lib/commandRestrictions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('restrict')
		.setDescription('Beperk waar/door wie een command gebruikt mag worden')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false)
		.addSubcommand(sub =>
			sub.setName('set').setDescription('Stel een restrictie in')
				.addStringOption(opt => opt.setName('command').setDescription('Naam van het command (zonder /)').setRequired(true))
				.addStringOption(opt => opt.setName('mode').setDescription('Modus').addChoices(
					{ name: 'anywhere', value: 'anywhere' },
					{ name: 'allowlist', value: 'allowlist' },
					{ name: 'blocklist', value: 'blocklist' },
				).setRequired(true))
				.addChannelOption(opt => opt.setName('channel1').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
				.addChannelOption(opt => opt.setName('channel2').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
				.addChannelOption(opt => opt.setName('channel3').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
				.addRoleOption(opt => opt.setName('role1').setDescription('Toegestane rol'))
				.addRoleOption(opt => opt.setName('role2').setDescription('Toegestane rol')))
		.addSubcommand(sub =>
			sub.setName('clear').setDescription('Verwijder restrictie')
				.addStringOption(opt => opt.setName('command').setDescription('Command naam').setRequired(true)))
		.addSubcommand(sub =>
			sub.setName('view').setDescription('Bekijk restrictie van een command')
				.addStringOption(opt => opt.setName('command').setDescription('Command naam').setRequired(true))),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins.', flags: 64 });
			return;
		}

		const sub = interaction.options.getSubcommand();
		const cmd = interaction.options.getString('command').trim().toLowerCase();

		if (sub === 'view') {
			const rule = getRule(interaction.guildId, cmd);
			const allowed = rule.allowedChannels.map(id => `<#${id}>`).join(', ') || '_geen_';
			const blocked = rule.blockedChannels.map(id => `<#${id}>`).join(', ') || '_geen_';
			const roles = rule.allowedRoles.map(id => `<@&${id}>`).join(', ') || '_iedereen_';
			await interaction.reply({
				content: `Restrictie voor **/${cmd}**\nMode: \`${rule.mode}\`\nAllowed: ${allowed}\nBlocked: ${blocked}\nRoles: ${roles}`,
				flags: 64,
			});
			return;
		}

		if (sub === 'clear') {
			clearRule(interaction.guildId, cmd);
			await interaction.reply({ content: `Restrictie voor /${cmd} verwijderd.`, flags: 64 });
			return;
		}

		if (sub === 'set') {
			const mode = interaction.options.getString('mode');
			const channels = ['channel1', 'channel2', 'channel3']
				.map(name => interaction.options.getChannel(name))
				.filter(Boolean)
				.map(c => c.id);
			const roles = ['role1', 'role2']
				.map(name => interaction.options.getRole(name))
				.filter(Boolean)
				.map(r => r.id);

			const patch = { mode, allowedRoles: roles };
			if (mode === 'allowlist') patch.allowedChannels = channels;
			else if (mode === 'blocklist') patch.blockedChannels = channels;

			setRule(interaction.guildId, cmd, patch);
			await interaction.reply({
				content: `Restrictie voor /${cmd} ingesteld (mode: ${mode}, ${channels.length} channels, ${roles.length} rollen).`,
				flags: 64,
			});
		}
	},
};
