const path = require('path');
const { ChannelType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { readJson, writeJson } = require('./jsonStore');
const { getRequiredXp } = require('./leveling');
const { getXpMultiplier } = require('./effectService');

function readLevelStore(levelsFile) {
	return readJson(levelsFile, {});
}

function writeLevelStore(levelsFile, data) {
	writeJson(levelsFile, data);
}

function applyXpGain(currentData = {}, amount = 0) {
	const previousLevel = currentData.level || 0;
	let xp = (currentData.xp || 0) + amount;
	let level = currentData.level || 0;

	while (xp >= getRequiredXp(level)) {
		xp -= getRequiredXp(level);
		level += 1;
	}

	return {
		xp,
		level,
		previousLevel,
		leveledUp: level > previousLevel,
	};
}

async function resolveLevelsChannel(guild, levelsChannelFile) {
	const allLevelChannels = readJson(levelsChannelFile, {});
	const configuredChannelId = allLevelChannels[guild.id]?.channelId;
	let levelsChannel = configuredChannelId ? guild.channels.cache.get(configuredChannelId) : null;

	if (levelsChannel && levelsChannel.isTextBased()) {
		return levelsChannel;
	}

	if (configuredChannelId && !levelsChannel) {
		const fetchedConfiguredChannel = await guild.channels.fetch(configuredChannelId).catch(() => null);
		if (fetchedConfiguredChannel && fetchedConfiguredChannel.isTextBased()) {
			return fetchedConfiguredChannel;
		}
	}

	levelsChannel = guild.channels.cache.find(channel => channel.name === 'levels' && channel.isTextBased());
	if (levelsChannel) {
		allLevelChannels[guild.id] = { channelId: levelsChannel.id };
		writeJson(levelsChannelFile, allLevelChannels);
		return levelsChannel;
	}

	const fetchedChannels = await guild.channels.fetch().catch(() => null);
	if (fetchedChannels) {
		levelsChannel = fetchedChannels.find(channel => channel && channel.name === 'levels' && channel.isTextBased());
		if (levelsChannel) {
			allLevelChannels[guild.id] = { channelId: levelsChannel.id };
			writeJson(levelsChannelFile, allLevelChannels);
			return levelsChannel;
		}
	}

	const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
	if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
		return null;
	}

	try {
		const createdChannel = await guild.channels.create({
			name: 'levels',
			type: ChannelType.GuildText,
			reason: 'Level-up announcements channel',
		});
		allLevelChannels[guild.id] = { channelId: createdChannel.id };
		writeJson(levelsChannelFile, allLevelChannels);
		return createdChannel;
	} catch (error) {
		console.error(`Failed to create #levels in guild ${guild.id}:`, error);
		return null;
	}
}

async function sendLevelUpAnnouncement({ guild, user, member, level, rewardNames = [], levelsChannelFile }) {
	const levelsChannel = await resolveLevelsChannel(guild, levelsChannelFile);
	if (!levelsChannel) {
		console.warn(`No levels channel available in guild ${guild.id}; level-up message suppressed.`);
		return false;
	}

	const userDisplay = member?.displayName || member?.user?.username || user?.username || user?.tag || 'Onbekende gebruiker';
	const levelUpEmbed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Level up')
		.setDescription(`Gefeliciteerd ${userDisplay}, je hebt level ${level} bereikt.`)
		.setFooter({ text: 'Level systeem' });

	if (rewardNames.length) {
		levelUpEmbed.addFields({
			name: 'Ontvangen rollen',
			value: rewardNames.map(roleName => `- ${roleName}`).join('\n'),
		});
	}

	await levelsChannel.send({ content: user?.id ? `<@${user.id}>` : '', embeds: [levelUpEmbed] }).catch(error => {
		console.error('Failed to send level-up message:', error);
	});

	return true;
}

async function processLevelGain({
	guild,
	user,
	member,
	amount,
	levelsFile,
	rewardsFile,
	levelsChannelFile,
	updateLastMessageAt = false,
}) {
	const allLevels = readLevelStore(levelsFile);
	const guildLevels = allLevels[guild.id] || {};
	const currentData = guildLevels[user.id] || { xp: 0, level: 0, lastMessageAt: 0 };
	const multiplier = getXpMultiplier(guild.id, user.id);
	const boostedAmount = Math.floor(amount * multiplier);
	const result = applyXpGain(currentData, boostedAmount);
	const nextData = {
		xp: result.xp,
		level: result.level,
		lastMessageAt: updateLastMessageAt ? Date.now() : (currentData.lastMessageAt || 0),
	};

	guildLevels[user.id] = nextData;
	allLevels[guild.id] = guildLevels;
	writeLevelStore(levelsFile, allLevels);

	const rewardNames = [];
	let resolvedMember = member;
	if (!resolvedMember) {
		resolvedMember = await guild.members.fetch(user.id).catch(() => null);
	}

	if (result.leveledUp && resolvedMember) {
		const allRewards = readJson(rewardsFile, {});
		const guildRewards = allRewards[guild.id] || [];
		for (const reward of guildRewards) {
			if (reward.level > result.level) {
				continue;
			}

			const role = guild.roles.cache.get(reward.roleId);
			if (!role || resolvedMember.roles.cache.has(role.id)) {
				continue;
			}

			await resolvedMember.roles.add(role).catch(() => null);
			rewardNames.push(role.name);
		}
	}

	if (result.leveledUp) {
		await sendLevelUpAnnouncement({
			guild,
			user,
			member: resolvedMember,
			level: result.level,
			rewardNames,
			levelsChannelFile,
		});
	}

	return {
		...result,
		rewardNames,
		member: resolvedMember,
		currentData: nextData,
	};
}

module.exports = {
	getRequiredXp,
	applyXpGain,
	processLevelGain,
	sendLevelUpAnnouncement,
	resolveLevelsChannel,
};