const path = require('path');
const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('levelreward')
		.setDescription('Adds a role reward for a level')
		.addIntegerOption(option =>
			option
				.setName('level')
				.setDescription('Level required for the role')
				.setRequired(true))
		.addRoleOption(option =>
			option
				.setName('role')
				.setDescription('Role to give at this level')
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
		const existingRewardIndex = guildRewards.findIndex(reward => reward.level === level);
		const rewardData = { level, roleId: role.id };

		if (existingRewardIndex >= 0) {
			guildRewards[existingRewardIndex] = rewardData;
		} else {
			guildRewards.push(rewardData);
		}

		guildRewards.sort((left, right) => left.level - right.level);
		allRewards[interaction.guildId] = guildRewards;
		writeJson(rewardsFile, allRewards);

		await interaction.reply({ content: `Rol ${role.name} is nu gekoppeld aan level ${level}.`, flags: 64 });
	},
};