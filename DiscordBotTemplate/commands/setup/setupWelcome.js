const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { setWelcome, getSettings } = require('../../lib/guildSettings');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup-welcome')
		.setDescription('Configureer welcome berichten')
		.setDMPermission(false)
		.addSubcommand(sub => sub.setName('toggle').setDescription('Zet welcome aan/uit'))
		.addSubcommand(sub =>
			sub.setName('mode').setDescription('Kies waar welcome wordt gestuurd')
				.addStringOption(opt => opt.setName('mode').setDescription('channel of dm').addChoices(
					{ name: 'channel', value: 'channel' },
					{ name: 'dm', value: 'dm' },
				).setRequired(true)))
		.addSubcommand(sub =>
			sub.setName('message').setDescription('Stel welcome bericht in')
				.addStringOption(opt => opt.setName('text').setDescription('Gebruik {user} en {count}').setRequired(true))),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen admins.', flags: 64 });
			return;
		}

		const sub = interaction.options.getSubcommand();
		const w = getSettings(interaction.guildId).welcome;

		if (sub === 'toggle') {
			setWelcome(interaction.guildId, { enabled: !w.enabled });
			await interaction.reply({ content: `Welcome is nu **${!w.enabled ? 'aan' : 'uit'}**.`, flags: 64 });
			return;
		}
		if (sub === 'mode') {
			const mode = interaction.options.getString('mode');
			setWelcome(interaction.guildId, { mode });
			await interaction.reply({ content: `Welcome mode: **${mode}**.`, flags: 64 });
			return;
		}
		if (sub === 'message') {
			const text = interaction.options.getString('text').slice(0, 1500);
			setWelcome(interaction.guildId, { message: text });
			await interaction.reply({ content: 'Welcome bericht bijgewerkt.', flags: 64 });
		}
	},
};
