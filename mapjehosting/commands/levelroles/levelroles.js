const path = require('path');
const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('levelroles')
		.setDescription('Stel een rolbeloning in voor een level')
		.addIntegerOption(option =>
			option
				.setName('level')
				.setDescription('Vereist level')
				.setRequired(true))
		.addRoleOption(option =>
			option
				.setName('role')
				.setDescription('Rol die je krijgt')
				.setRequired(true)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
			await interaction.reply({ content: 'Je hebt Manage Roles nodig om dit in te stellen.', flags: 64 });
			return;
		}

		const level = interaction.options.getInteger('level');
		const role = interaction.options.getRole('role');
		const allRewards = readJson(rewardsFile, {});
		const guildRewards = allRewards[interaction.guildId] || [];
		const index = guildRewards.findIndex(entry => entry.level === level);
		const rewardData = { level, roleId: role.id };

		if (index >= 0) {
			guildRewards[index] = rewardData;
		} else {
			guildRewards.push(rewardData);
		}

		guildRewards.sort((left, right) => left.level - right.level);
		allRewards[interaction.guildId] = guildRewards;
		writeJson(rewardsFile, allRewards);

		await interaction.reply({ content: `Rol ${role.name} is ingesteld voor level ${level}.`, flags: 64 });
	},
};