const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { logModAction } = require('../../lib/modService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Kick een lid uit de server')
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDMPermission(false)
		.addUserOption(opt => opt.setName('user').setDescription('Wie kicken').setRequired(true))
		.addStringOption(opt => opt.setName('reden').setDescription('Reden').setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
			await interaction.reply({ content: 'Je hebt Kick Members nodig.', flags: 64 });
			return;
		}
		const target = interaction.options.getUser('user');
		const reason = interaction.options.getString('reden');
		const member = await interaction.guild.members.fetch(target.id).catch(() => null);
		if (!member) {
			await interaction.reply({ content: 'Lid niet gevonden.', flags: 64 });
			return;
		}
		if (!member.kickable) {
			await interaction.reply({ content: 'Ik kan dit lid niet kicken (rol-hiërarchie of permissies).', flags: 64 });
			return;
		}
		await member.kick(reason || `Kicked by ${interaction.user.tag}`).catch(err => {
			console.error('kick failed:', err);
		});
		await interaction.reply({ content: `${target} is gekickt.${reason ? ` Reden: ${reason}` : ''}` });
		await logModAction(interaction.guild, { action: 'kick', moderator: interaction.user, target, reason });
	},
};
