require('dotenv').config(); //This will be used to store private keys

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Dit zorgt ervoor dat de URL (https://onrender.com) iets terugstuurt
app.get('/', (req, res) => {
  res.send('Bot is succesvol aan het draaien!');
});

app.listen(port, () => {
  console.log(`Webserver luistert op poort ${port}`);
});

const path = require('path');
const fs = require('fs');
const deployCommands = require('./deploy/deployCommands');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Client,
	Collection,
	EmbedBuilder,
	Events,
	GatewayIntentBits,
	ModalBuilder,
	PermissionFlagsBits,
	PermissionsBitField,
	Partials,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const getMeme = require('./commands/getMeme/getMeme');
const { readJson, writeJson, preloadDirectory } = require('./lib/jsonStore');
const { processLevelGain, getRequiredXp, resolveLevelsChannel } = require('./lib/levelingService');
const { addBalance: addCrownBalance, getBalance: getCrownBalance, getCrownConfig } = require('./lib/crownService');
const { addBalance: addCoinBalance, getBalance: getCoinBalance } = require('./lib/coinService');
const { getSettings } = require('./lib/guildSettings');
const { checkCommandAllowed } = require('./lib/commandRestrictions');
const { migrateGuildConfigs } = require('./lib/migrateConfigs');
const setupWizard = require('./lib/setupWizard');
const roleCategoryService = require('./lib/roleCategoryService');
const minigameService = require('./lib/minigameService');
const wordList = require('./lib/wordList');
const challengeService = require('./lib/challengeService');
const { buildChallengeEmbed } = require('./commands/challenge/challenge');
const menuCommand = require('./commands/menu/menu');
const redembedCommand = require('./commands/redembed/redembed');
const afkService = require('./lib/afkService');
const { isEconomyEnabled } = require('./lib/economyService');
const coinflipCommand = require('./commands/coinflip/coinflip');
const coinService = require('./lib/coinService');
const warningsService = require('./lib/warningsService');
const reminderService = require('./lib/reminderService');
const birthdayService = require('./lib/birthdayService');
const confessionService = require('./lib/confessionService');
const bumpService = require('./lib/bumpService');
const customRoleRequestsFile = path.join(__dirname, 'data', 'customRoleRequests.json');
const {
	drawCard,
	handValue,
	formatHand,
	isBlackjack,
	isBust,
	dealerShouldHit,
} = require('./lib/blackjackService');

const levelsFile = path.join(__dirname, 'data', 'levels.json');
const rewardsFile = path.join(__dirname, 'data', 'roleRewards.json');
const roleMenusFile = path.join(__dirname, 'data', 'roleMenus.json');
const reactionRolesFile = path.join(__dirname, 'data', 'reactionRoles.json');
const levelsChannelFile = path.join(__dirname, 'data', 'levelsChannel.json');
const welcomeConfigFile = path.join(__dirname, 'data', 'welcomeConfig.json');
const countingConfigFile = path.join(__dirname, 'data', 'countingConfig.json');
const crownsConfigFile = path.join(__dirname, 'data', 'crownsConfig.json');
const crownsFile = path.join(__dirname, 'data', 'crowns.json');
const coinsFile = path.join(__dirname, 'data', 'coins.json');
const crownsClaimsFile = path.join(__dirname, 'data', 'crownsClaims.json');
const blackjackGamesFile = path.join(__dirname, 'data', 'blackjackGames.json');
const ticketPanelsFile = path.join(__dirname, 'data', 'ticketPanels.json');
const minigamesFile = path.join(__dirname, 'data', 'minigames.json');
const countingSavesFile = path.join(__dirname, 'data', 'countingSaves.json');
const levelCooldownMs = 60_000;
const xpPerMessageMin = 15;
const xpPerMessageMax = 25;
const ENABLE_PRIVILEGED_INTENTS = process.env.ENABLE_PRIVILEGED_INTENTS === 'true';

const BOT_TOKEN = process.env.CLIENT_TOKEN;

const clientIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions];

if (ENABLE_PRIVILEGED_INTENTS) {
	clientIntents.push(GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent);
} else {
	console.warn('Privileged intents are disabled. Enable ENABLE_PRIVILEGED_INTENTS=true only after turning them on in the Discord Developer Portal.');
}

const client = new Client({
	intents: clientIntents,
	partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

async function ensureLevelsChannel(guild) {
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
			return levelsChannel;
		}
	}

	const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
	if (!botMember?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
		console.warn(`Cannot create #levels in guild ${guild.id}: missing ManageChannels permission.`);
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
	} catch (err) {
		console.error(`Failed to create #levels in guild ${guild.id}:`, err);
		return null;
	}
}

async function sendLevelUpAnnouncement(guild, user, member, level, rewardMessages) {
	const levelsChannel = await ensureLevelsChannel(guild);
	if (!levelsChannel) {
		console.warn(`No levels channel available in guild ${guild.id}; level-up message suppressed.`);
		return;
	}

	const userDisplay = member?.displayName || member?.user?.username || member?.user?.tag || 'Onbekende gebruiker';
	const levelUpEmbed = new EmbedBuilder()
		.setColor(0xff0000)
		.setTitle('Level up')
		.setDescription(`Gefeliciteerd ${userDisplay}, je hebt level ${level} bereikt.`)
		.setFooter({ text: 'Level systeem' });

	if (rewardMessages.length) {
		levelUpEmbed.addFields({
			name: 'Ontvangen rollen',
			value: rewardMessages.map(roleName => `- ${roleName}`).join('\n'),
		});
	}

	await levelsChannel.send({ content: `<@${user.id}>`, embeds: [levelUpEmbed] }).catch(err => {
		console.error('Failed to send level-up message to levels channel:', err);
	});
}

function isTicketChannel(channel) {
	if (!channel) {
		return false;
	}

	const channelName = channel.name?.toLowerCase() || '';
	const channelTopic = channel.topic?.toLowerCase() || '';
	const parentName = channel.parent?.name?.toLowerCase() || '';
	if (channelName.includes('ticket') || channelTopic.includes('ticket') || parentName.includes('ticket')) {
		return true;
	}

	if (channel.guild) {
		const settings = getSettings(channel.guild.id);
		const ticketCategoryId = settings.channels.ticketCategory;
		if (ticketCategoryId && channel.parentId === ticketCategoryId) {
			return true;
		}
	}
	return false;
}

function getGuildConfig(filePath, guildId, fallback = {}) {
	const allConfigs = readJson(filePath, {});
	return allConfigs[guildId] || fallback;
}

function getCountingSaves(guildId, userId) {
	const all = readJson(countingSavesFile, {});
	return all[guildId]?.[userId] || 0;
}

function setCountingSaves(guildId, userId, amount) {
	const all = readJson(countingSavesFile, {});
	const guildSaves = all[guildId] || {};
	guildSaves[userId] = Math.max(0, amount);
	all[guildId] = guildSaves;
	writeJson(countingSavesFile, all);
	return guildSaves[userId];
}

function addCountingSaves(guildId, userId, amount) {
	return setCountingSaves(guildId, userId, getCountingSaves(guildId, userId) + amount);
}

async function handleCountingMessage(message) {
	const settings = getSettings(message.guild.id);
	const channelId = settings.channels.counting || getGuildConfig(countingConfigFile, message.guild.id, null)?.channelId;
	if (!channelId || message.channel.id !== channelId) {
		return false;
	}
	if (!settings.counting.enabled && settings.channels.counting) {
		return false;
	}
	const config = getGuildConfig(countingConfigFile, message.guild.id, { channelId, lastNumber: 0, lastUserId: null });

	const nextNumber = (config.lastNumber || 0) + 1;
	const trimmed = message.content.trim();
	const guessedNumber = Number(trimmed);

	if (!trimmed || !Number.isInteger(guessedNumber)) {
		return false;
	}

	const isWrongUser = message.author.id === config.lastUserId;
	const isWrongNumber = guessedNumber !== nextNumber;

	if (isWrongUser || isWrongNumber) {
		const saves = getCountingSaves(message.guild.id, message.author.id);
		if (saves > 0) {
			setCountingSaves(message.guild.id, message.author.id, saves - 1);
			await message.react('🛡️').catch(() => null);
			await message.channel.send({
				content: `<@${message.author.id}> gebruikte een save (${saves - 1} over). De count blijft op **${config.lastNumber || 0}**, volgende getal is **${nextNumber}**.`,
			}).catch(() => null);
			await message.delete().catch(() => null);
			return true;
		}

		const allConfigs = readJson(countingConfigFile, {});
		allConfigs[message.guild.id] = {
			channelId,
			lastNumber: 0,
			lastUserId: null,
		};
		writeJson(countingConfigFile, allConfigs);

		const reason = isWrongUser
			? 'mocht niet 2 keer na elkaar tellen'
			: `typte **${guessedNumber}** in plaats van **${nextNumber}**`;
		const saveCost = settings.counting?.saveCost ?? 50;
		await message.channel.send({
			content: `❌ <@${message.author.id}> heeft het verpest (${reason}). Het volgende getal is **1**.\nTip: koop saves voor ${saveCost} kroontjes met \`/crownshop buysave\` zodat een fout automatisch opgevangen wordt.`,
		}).catch(() => null);
		return true;
	}

	const allConfigs = readJson(countingConfigFile, {});
	allConfigs[message.guild.id] = {
		channelId,
		lastNumber: guessedNumber,
		lastUserId: message.author.id,
	};
	writeJson(countingConfigFile, allConfigs);
	await message.react('✅').catch(() => null);
	return true;
}

async function editOrSendMinigame(message, state, builder, finalContent = null) {
	if (state.messageId) {
		const target = await message.channel.messages.fetch(state.messageId).catch(() => null);
		if (target) {
			await target.edit({ embeds: [builder(state)] }).catch(() => null);
			if (finalContent) {
				await message.channel.send({ content: finalContent }).catch(() => null);
			}
			await message.delete().catch(() => null);
			return;
		}
	}
	await message.channel.send({ embeds: [builder(state)], content: finalContent || undefined }).catch(() => null);
}

async function handleMinesweeperMessage(message, state) {
	const raw = message.content.trim();
	if (!raw) return false;
	if (state.starterId !== message.author.id) return false;

	if (raw.toLowerCase() === 'stop') {
		state.finished = true;
		state.won = false;
		minigameService.setActiveGame(message.guild.id, message.channel.id, null);
		await editOrSendMinigame(message, state, minigameService.buildMinesweeperEmbed, '🛑 Minesweeper gestopt.');
		await message.delete().catch(() => null);
		return true;
	}

	const parsed = minigameService.parseMinesweeperInput(state, raw);
	if (!parsed) {
		await message.delete().catch(() => null);
		return false;
	}

	const cell = state.cells[parsed.idx];
	if (cell.revealed) {
		await message.delete().catch(() => null);
		return true;
	}

	if (parsed.flag) {
		cell.flagged = !cell.flagged;
		minigameService.setActiveGame(message.guild.id, message.channel.id, state);
		await editOrSendMinigame(message, state, minigameService.buildMinesweeperEmbed);
		setTimeout(() => message.delete().catch(() => null), 1000);
		return true;
	}

	if (cell.flagged) {
		await message.delete().catch(() => null);
		return true;
	}

	if (cell.bomb) {
		cell.revealed = true;
		state.finished = true;
		state.won = false;
		minigameService.setActiveGame(message.guild.id, message.channel.id, null);
		await editOrSendMinigame(message, state, minigameService.buildMinesweeperEmbed, '💥 Boem! Je raakte een bom.');
		setTimeout(() => message.delete().catch(() => null), 1000);
		return true;
	}

	minigameService.revealMinesweeperFlood(state, parsed.idx);
	if (minigameService.checkMinesweeperWin(state)) {
		state.finished = true;
		state.won = true;
		const reward = await minigameService.awardWin(message.guild.id, message.author.id, 'minesweeper');
		minigameService.setActiveGame(message.guild.id, message.channel.id, null);
		await editOrSendMinigame(message, state, minigameService.buildMinesweeperEmbed,
			reward > 0 ? `🎉 <@${message.author.id}> wint en krijgt **${reward}** kroontjes!` : `🎉 <@${message.author.id}> wint!`);
		setTimeout(() => message.delete().catch(() => null), 1000);
		return true;
	}

	minigameService.setActiveGame(message.guild.id, message.channel.id, state);
	await editOrSendMinigame(message, state, minigameService.buildMinesweeperEmbed);
	setTimeout(() => message.delete().catch(() => null), 1000);
	return true;
}

async function handleMinigameMessage(message) {
	const state = minigameService.getActiveGame(message.guild.id, message.channel.id);
	if (!state || state.finished) return false;
	if (state.game !== 'wordle' && state.game !== 'hangman' && state.game !== 'minesweeper') return false;

	if (state.game === 'minesweeper') {
		return handleMinesweeperMessage(message, state);
	}

	const text = message.content.trim().toLowerCase();
	if (!text || !/^[a-z]+$/.test(text)) return false;

	if (state.game === 'wordle') {
		if (text.length !== state.answer.length) return false;
		let valid = minigameService.isValidWord('wordle', text);
		if (!valid) {
			valid = await wordList.isValidWordleWordOnline(text).catch(() => false);
			if (valid) wordList.addWordleDictionaryWord(text);
		}
		if (!valid) {
			await message.reply({ content: `❌ \`${text.toUpperCase()}\` is geen geldig woord.` })
				.then(reply => setTimeout(() => reply.delete().catch(() => null), 4000))
				.catch(() => null);
			await message.delete().catch(() => null);
			return true;
		}
		const marks = minigameService.evaluateWordleGuess(state.answer, text);
		state.guesses.push({ word: text, marks, userId: message.author.id });
		const won = marks.every(m => m === 'correct');
		if (won) {
			state.finished = true;
			state.won = true;
			const reward = await minigameService.awardWin(message.guild.id, message.author.id, 'wordle');
			minigameService.setActiveGame(message.guild.id, message.channel.id, null);
			await editOrSendMinigame(message, state, minigameService.buildWordleEmbed,
				reward > 0 ? `🎉 <@${message.author.id}> wint en krijgt **${reward}** kroontjes!` : `🎉 <@${message.author.id}> wint!`);
			return true;
		}
		if (state.guesses.length >= state.maxGuesses) {
			state.finished = true;
			state.won = false;
			minigameService.setActiveGame(message.guild.id, message.channel.id, null);
		} else {
			minigameService.setActiveGame(message.guild.id, message.channel.id, state);
		}
		await editOrSendMinigame(message, state, minigameService.buildWordleEmbed);
		return true;
	}

	if (state.game === 'hangman') {
		if (text.length === 1) {
			if (state.guessed.includes(text) || state.wrong.includes(text)) return false;
			if (state.answer.includes(text)) state.guessed.push(text);
			else state.wrong.push(text);
		} else if (text.length === state.answer.length) {
			if (text === state.answer) {
				state.guessed = [...new Set(state.answer.split(''))];
			} else {
				state.wrong.push(text);
			}
		} else {
			return false;
		}

		const allRevealed = state.answer.split('').every(ch => state.guessed.includes(ch));
		const dead = state.wrong.length >= minigameService.HANGMAN_MAX_WRONG;
		if (allRevealed) {
			state.finished = true;
			state.won = true;
			const reward = await minigameService.awardWin(message.guild.id, message.author.id, 'hangman');
			minigameService.setActiveGame(message.guild.id, message.channel.id, null);
			await editOrSendMinigame(message, state, minigameService.buildHangmanEmbed,
				reward > 0 ? `🎉 <@${message.author.id}> wint en krijgt **${reward}** kroontjes!` : `🎉 <@${message.author.id}> wint!`);
			return true;
		}
		if (dead) {
			state.finished = true;
			state.won = false;
			minigameService.setActiveGame(message.guild.id, message.channel.id, null);
		} else {
			minigameService.setActiveGame(message.guild.id, message.channel.id, state);
		}
		await editOrSendMinigame(message, state, minigameService.buildHangmanEmbed);
		return true;
	}

	return false;
}

async function handleChallengeMessage(message) {
	const settings = getSettings(message.guild.id);
	const challengeChannelId = settings.channels?.challenge;
	if (!challengeChannelId || message.channel.id !== challengeChannelId) return false;

	const active = challengeService.getActive(message.guild.id);
	if (!active || active.solved) return false;
	if (active.date !== challengeService.todayKey()) return false;

	const result = challengeService.tryAnswer(message.guild.id, message.author.id, message.content);
	if (!result.matched) return false;

	const reward = result.reward || 0;
	const replyEmbed = new EmbedBuilder()
		.setColor(0x57f287)
		.setTitle('🎉 Opgelost!')
		.setDescription(`<@${message.author.id}> had het juiste antwoord: **${result.answer}**.${reward > 0 ? `\n\nBeloning: **${reward} kroontjes** 👑` : ''}`);

	if (active.messageId) {
		const original = await message.channel.messages.fetch(active.messageId).catch(() => null);
		if (original) {
			const updated = new EmbedBuilder()
				.setColor(0x57f287)
				.setTitle('🧩 Daily Challenge — opgelost')
				.setDescription(`**${active.question}**\n\n✅ Antwoord: **${result.answer}**\n🏆 Winnaar: <@${message.author.id}>`)
				.setFooter({ text: `Datum: ${active.date}` });
			await original.edit({ embeds: [updated] }).catch(() => null);
		}
	}
	await message.reply({ embeds: [replyEmbed], allowedMentions: { repliedUser: false } }).catch(() => null);
	return true;
}

async function postDailyChallenge(guild) {
	const settings = getSettings(guild.id);
	const channelId = settings.channels?.challenge;
	if (!channelId) return;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel?.isTextBased()) return;

	const state = challengeService.startChallenge(guild.id, channelId);
	if (!state) return;
	const sent = await channel.send({ embeds: [buildChallengeEmbed(state)] }).catch(() => null);
	if (sent) challengeService.attachMessage(guild.id, sent.id);
}

async function postHallOfFame(guild) {
	const now = new Date();
	const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const month = challengeService.monthKey(prev);
	const top = challengeService.getTopWinners(guild.id, month, 3);

	const settings = getSettings(guild.id);
	const channelId = settings.channels?.halloffame;
	if (!channelId) return;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel?.isTextBased()) return;

	const monthLabel = prev.toLocaleString('nl-NL', { month: 'long', year: 'numeric' });
	const lines = top.length === 0
		? ['Geen winnaars deze maand.']
		: top.map((w, i) => `${['🥇', '🥈', '🥉'][i]} <@${w.userId}> — **${w.wins}** challenge${w.wins === 1 ? '' : 's'} gewonnen`);

	const embed = new EmbedBuilder()
		.setColor(0xffd700)
		.setTitle(`🏆 Hall of Fame — ${monthLabel}`)
		.setDescription(lines.join('\n'))
		.setFooter({ text: 'Doe mee aan de daily challenges om volgende maand op deze lijst te staan!' });

	await channel.send({ embeds: [embed] }).catch(() => null);
}

async function checkSchedules() {
	try {
		const halloffameStateFile = path.join(__dirname, 'data', 'halloffameState.json');
		const hofState = readJson(halloffameStateFile, {});
		const now = new Date();
		const todayDate = challengeService.todayKey(now);
		const hour = now.getHours();
		const day = now.getDate();

		for (const [, guild] of client.guilds.cache) {
			const settings = getSettings(guild.id);

			if (settings.challenge?.enabled && settings.channels?.challenge) {
				const active = challengeService.getActive(guild.id);
				const postHour = Number(settings.challenge.postHour) || 9;
				if (hour === postHour && (!active || active.date !== todayDate)) {
					await postDailyChallenge(guild);
				}
			}

			if (settings.hallOfFame?.enabled && settings.channels?.halloffame) {
				const postDay = Number(settings.hallOfFame.postDay) || 1;
				const postHour = Number(settings.hallOfFame.postHour) || 10;
				if (day === postDay && hour === postHour) {
					const lastPosted = hofState[guild.id]?.lastPostedDate;
					if (lastPosted !== todayDate) {
						await postHallOfFame(guild);
						hofState[guild.id] = { lastPostedDate: todayDate };
						writeJson(halloffameStateFile, hofState);
					}
				}
			}

			// NEW: Check reminders
			if (settings.reminders?.enabled) {
				const expiredReminders = reminderService.getExpiredReminders(guild.id);
				for (const reminder of expiredReminders) {
					try {
						const channel = await guild.channels.fetch(reminder.channelId).catch(() => null);
						const user = await client.users.fetch(reminder.userId).catch(() => null);

						if (reminder.type === 'user' && user) {
							try {
								await user.send(`⏰ **Reminder**: ${reminder.content}`);
							} catch (dmErr) {
								if (channel) {
									await channel.send(`<@${reminder.userId}> ⏰ **Reminder**: ${reminder.content}`);
								}
							}
						} else if (reminder.type === 'bump' && channel) {
							const roleId = bumpService.getBumpReminderRole(guild.id);
							const roleTag = roleId ? `<@&${roleId}>` : '@everyone';
							await channel.send(`${roleTag} ⏰ Time to bump! \`/bump\``);
						}
					} catch (reminderErr) {
						console.error(`Failed to send reminder ${reminder.id}:`, reminderErr);
					}
					reminderService.deleteReminder(guild.id, reminder.id);
				}
			}

			// NEW: Check birthdays (daily at UTC midnight)
			if (settings.birthdays?.enabled && settings.channels?.modlog) {
				const birthdayChannelId = settings.birthdays.notificationChannelId || settings.channels.modlog;
				const channel = await guild.channels.fetch(birthdayChannelId).catch(() => null);
				if (channel) {
					const birthdayUsers = birthdayService.getTodaysBirthdays(guild.id);
					for (const userId of birthdayUsers) {
						try {
							const member = await guild.members.fetch(userId).catch(() => null);
							if (member) {
								const message = settings.birthdays.message || 'Happy Birthday {user}! 🎉';
								const finalMessage = message.replace('{user}', member.toString());
								await channel.send(finalMessage);

								// Award birthday bonus coins
								const bonus = settings.birthdays.bonusCoins || 100;
								addCoinBalance(coinsFile, guild.id, userId, bonus);
							}
						} catch (birthdayErr) {
							console.error(`Failed to process birthday for ${userId}:`, birthdayErr);
						}
					}
				}
			}

			// NEW: Check bump reminders
			if (settings.bumpReminders?.enabled && settings.channels?.modlog) {
				const bumpChannelId = settings.bumpReminders.bumpChannelId || settings.channels.modlog;
				const channel = await guild.channels.fetch(bumpChannelId).catch(() => null);
				if (channel && bumpService.shouldPostBumpReminder(guild.id)) {
					const roleId = bumpService.getBumpReminderRole(guild.id);
					const roleTag = roleId ? `<@&${roleId}>` : '@everyone';
					const lastBump = bumpService.getLastBumpTime(guild.id);
					const nextReminder = bumpService.getNextBumpReminderTime(guild.id);

					let embed = new EmbedBuilder()
						.setTitle('🚀 Bump Reminder')
						.setDescription(`${roleTag} - Time to bump the server!`)
						.setColor(0x00ff00);

					if (lastBump) {
						const bumpDate = new Date(lastBump);
						embed.addFields({ name: 'Last Bump', value: bumpDate.toLocaleString(), inline: false });
					}

					await channel.send({ content: roleTag, embeds: [embed] });
				}
			}
		}
	} catch (err) {
		console.error('checkSchedules failed:', err);
	}
}

async function maybeSpawnCrown(message) {
	if (isTicketChannel(message.channel)) {
		return;
	}

	const settings = getSettings(message.guild.id);
	const econ = settings.economy;
	const legacyConfig = getCrownConfig(crownsConfigFile, message.guild.id);
	const enabled = econ.enabled || Boolean(legacyConfig?.enabled);
	if (!enabled) {
		return;
	}

	const chancePercent = econ.crownSpawnChance || legacyConfig?.chancePercent || 5;
	if (Math.random() * 100 > chancePercent) {
		return;
	}

	const claimId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	const allClaims = readJson(crownsClaimsFile, {});
	allClaims[claimId] = {
		guildId: message.guild.id,
		channelId: message.channel.id,
		messageId: null,
		claimedBy: null,
	};
	writeJson(crownsClaimsFile, allClaims);

	const claimButton = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`crownclaim:${claimId}`)
			.setLabel('Claim kroontje')
			.setStyle(ButtonStyle.Danger),
	);

	const crownEmbed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Kroontje verschenen!')
		.setDescription('Klik op de knop om het kroontje te claimen.');

	const sentMessage = await message.channel.send({ embeds: [crownEmbed], components: [claimButton] }).catch(() => null);
	if (!sentMessage) {
		return;
	}

	allClaims[claimId].messageId = sentMessage.id;
	writeJson(crownsClaimsFile, allClaims);
}

function renderWelcomeMessage(template, member) {
	return (template || 'Welkom {user}, je bent nu lid nummer **{count}**.')
		.replace(/\{user\}/g, `<@${member.id}>`)
		.replace(/\{count\}/g, String(member.guild.memberCount));
}

async function sendWelcomeMessage(member) {
	const settings = getSettings(member.guild.id);
	const welcomeSettings = settings.welcome;
	const channelId = settings.channels.welcome;

	const legacyChannelId = !channelId
		? getGuildConfig(welcomeConfigFile, member.guild.id, null)?.channelId
		: null;
	const effectiveChannelId = channelId || legacyChannelId;

	const enabled = welcomeSettings.enabled || (!channelId && !!legacyChannelId);
	if (!enabled) return;

	const description = renderWelcomeMessage(welcomeSettings.message, member);
	const welcomeEmbed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Welkom!')
		.setDescription(description);

	if (welcomeSettings.mode === 'dm') {
		await member.send({ embeds: [welcomeEmbed] }).catch(err => {
			console.error('Failed to DM welcome message:', err);
		});
		return;
	}

	if (!effectiveChannelId) return;
	const welcomeChannel = member.guild.channels.cache.get(effectiveChannelId)
		|| await member.guild.channels.fetch(effectiveChannelId).catch(() => null);
	if (!welcomeChannel?.isTextBased()) return;

	await welcomeChannel.send({ content: `<@${member.id}>`, embeds: [welcomeEmbed] }).catch(err => {
		console.error('Failed to send welcome message:', err);
	});
}

function loadBlackjackGames() {
	return readJson(blackjackGamesFile, {});
}

function saveBlackjackGames(games) {
	writeJson(blackjackGamesFile, games);
}

function buildBlackjackEmbed(state, revealDealer = false, statusText = '') {
	const playerTotal = handValue(state.playerHand);
	const dealerTotal = revealDealer ? handValue(state.dealerHand) : '??';
	const dealerCards = formatHand(state.dealerHand, !revealDealer);
	const playerCards = formatHand(state.playerHand, false);

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('Blackjack is nu draaiende')
		.setDescription(statusText || 'Hit of stand? Kies wat je wilt doen.');

	embed.addFields(
		{ name: 'Inzet', value: `${state.bet} kroontjes`, inline: true },
		{ name: 'Dealer', value: `${dealerCards}\nTotaal: ${dealerTotal}`, inline: true },
		{ name: 'Jij', value: `${playerCards}\nTotaal: ${playerTotal}`, inline: true },
	);

	return embed;
}

function buildBlackjackButtons(gameId, disabled = false) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`blackjack:${gameId}:hit`).setLabel('Hit').setStyle(ButtonStyle.Danger).setDisabled(disabled),
		new ButtonBuilder().setCustomId(`blackjack:${gameId}:stand`).setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
	);
}

async function resolveBlackjackMessage(interaction) {
	if (interaction?.channel?.messages?.fetch) {
		return interaction.channel.messages.fetch(interaction.message.id).catch(() => interaction.message);
	}

	return interaction.message;
}

async function runBlackjackCountdown(channel, messageId, fallbackMessage, state, seconds = 10) {
	for (let remaining = seconds; remaining >= 1; remaining -= 1) {
		const targetMessage = channel?.messages?.fetch ? await channel.messages.fetch(messageId).catch(() => fallbackMessage) : fallbackMessage;
		if (!targetMessage) {
			console.error('Could not resolve blackjack message for countdown.');
			return;
		}

		await targetMessage.edit({
			content: `Dealer denkt na... resultaat over ${remaining} seconden.`,
			embeds: [buildBlackjackEmbed(state, false, `Dealer denkt na... resultaat over ${remaining} seconden.`)],
			components: [buildBlackjackButtons(state.gameId)],
		}).catch(error => {
			console.error('Failed to edit blackjack countdown message:', error);
		});
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
}

async function settleBlackjackState(interaction, state, reason) {
	let dealerTotal = handValue(state.dealerHand);
	while (dealerShouldHit(state.dealerHand)) {
		state.dealerHand.push(drawCard(state.deck));
		dealerTotal = handValue(state.dealerHand);
	}

	const playerTotal = handValue(state.playerHand);
	const dealerBust = isBust(state.dealerHand);
	const playerBlackjack = isBlackjack(state.playerHand);
	const dealerBlackjack = isBlackjack(state.dealerHand);

	let resultText = 'Gelijkspel.';
	let net = 0;
	let outcome = 'push';
	if (playerTotal > 21) {
		net = -state.bet;
		outcome = 'loss';
		resultText = `💥 Je bent busted (${playerTotal}). Je verliest **${state.bet} coins**.`;
	} else if (dealerBust) {
		addCoinBalance(coinsFile, interaction.guildId, interaction.user.id, state.bet * 2);
		net = state.bet;
		outcome = 'win';
		resultText = `🎉 Dealer is busted (${dealerTotal}). Je wint **+${state.bet} coins** (uitbetaling ${state.bet * 2}).`;
	} else if (playerBlackjack && !dealerBlackjack) {
		const payout = Math.ceil(state.bet * 2.5);
		addCoinBalance(coinsFile, interaction.guildId, interaction.user.id, payout);
		net = payout - state.bet;
		outcome = 'win';
		resultText = `🎉 Blackjack! Je wint **+${net} coins** (uitbetaling ${payout}).`;
	} else if (dealerBlackjack && !playerBlackjack) {
		net = -state.bet;
		outcome = 'loss';
		resultText = `💥 Dealer heeft blackjack. Je verliest **${state.bet} coins**.`;
	} else if (playerTotal > dealerTotal) {
		addCoinBalance(coinsFile, interaction.guildId, interaction.user.id, state.bet * 2);
		net = state.bet;
		outcome = 'win';
		resultText = `🎉 Je wint met **${playerTotal}** tegen ${dealerTotal}: **+${state.bet} coins**.`;
	} else if (playerTotal < dealerTotal) {
		net = -state.bet;
		outcome = 'loss';
		resultText = `💥 Dealer wint met **${dealerTotal}** tegen ${playerTotal}. Je verliest **${state.bet} coins**.`;
	} else {
		addCoinBalance(coinsFile, interaction.guildId, interaction.user.id, state.bet);
		net = 0;
		outcome = 'push';
		resultText = `🤝 Gelijkspel met ${playerTotal}. Je inzet (${state.bet} coins) komt terug.`;
	}

	state.finished = true;
	state.reason = reason;
	state.netResult = net;
	state.outcome = outcome;

	const games = loadBlackjackGames();
	games[state.gameId] = state;
	saveBlackjackGames(games);

	return {
		embed: buildBlackjackEmbed(state, true, resultText),
		components: [buildBlackjackButtons(state.gameId, true)],
		resultText,
		net,
		outcome,
	};
}

async function handleReactionRoleUpdate(reaction, user, shouldAdd) {
	try {
		if (user.bot) {
			return;
		}

		const fetchedReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
		if (!fetchedReaction?.message?.guild) {
			return;
		}

		const guild = fetchedReaction.message.guild;
		const allReactionRoles = readJson(reactionRolesFile, {});
		const mapping = allReactionRoles[fetchedReaction.message.id];
		if (!mapping || mapping.guildId !== guild.id) {
			return;
		}

		const roleEntry = mapping.roles.find(role => role.emoji === fetchedReaction.emoji.toString());
		if (!roleEntry) {
			return;
		}

		const member = await guild.members.fetch(user.id).catch(() => null);
		if (!member) {
			return;
		}

		const role = guild.roles.cache.get(roleEntry.roleId) || await guild.roles.fetch(roleEntry.roleId).catch(() => null);
		if (!role) {
			return;
		}

		if (shouldAdd) {
			await member.roles.add(role).catch(err => {
				console.error('Failed to add reaction role:', err);
			});
		} else {
			await member.roles.remove(role).catch(err => {
				console.error('Failed to remove reaction role:', err);
			});
		}
	} catch (error) {
		console.error('handleReactionRoleUpdate failed:', error);
	}
}

function buildTicketModal(ticketType) {
	const definition = {
		partnerships: {
			title: 'Partnership ticket',
			fields: [
				{ id: 'server_name', label: 'Server naam', placeholder: 'Hoe heet jullie server?', required: true },
				{ id: 'member_count', label: 'Aantal leden', placeholder: 'Hoeveel leden hebben jullie?', required: true },
				{ id: 'discord_link', label: 'Discord link', placeholder: 'Plak de invite link', required: true },
				{ id: 'goal', label: 'Wat wil je bespreken?', placeholder: 'Wat zoek je in de partnership?', required: true },
			],
		},
		vragen: {
			title: 'Vragen ticket',
			fields: [
				{ id: 'question', label: 'Je vraag', placeholder: 'Waarmee kunnen we helpen?', required: true },
				{ id: 'context', label: 'Context', placeholder: 'Geef wat extra uitleg', required: false },
				{ id: 'priority', label: 'Prioriteit', placeholder: 'Laag, gemiddeld, hoog', required: false },
			],
		},
		twitch_promotie: {
			title: 'Twitch promotie ticket',
			fields: [
				{ id: 'twitch_name', label: 'Twitch naam', placeholder: 'Hoe heet je op Twitch?', required: true },
				{ id: 'stream_link', label: 'Stream link', placeholder: 'Link naar je stream', required: true },
				{ id: 'promotion_goal', label: 'Wat wil je promoten?', placeholder: 'Bijv. je stream of een event', required: true },
				{ id: 'extra', label: 'Extra info', placeholder: 'Aanvullende info', required: false },
			],
		},
		sollicitaties: {
			title: 'Sollicitatie ticket',
			fields: [
				{ id: 'name', label: 'Naam', placeholder: 'Hoe mogen we je noemen?', required: true },
				{ id: 'position', label: 'Positie', placeholder: 'Waar solliciteer je voor?', required: true },
				{ id: 'experience', label: 'Ervaring', placeholder: 'Welke ervaring heb je?', required: true },
				{ id: 'motivation', label: 'Motivatie', placeholder: 'Waarom wil je dit doen?', required: true },
			],
		},
	}[ticketType];

	if (!definition) {
		return null;
	}

	const modal = new ModalBuilder()
		.setCustomId(`ticketmodal:${ticketType}`)
		.setTitle(definition.title);

	for (const field of definition.fields) {
		const input = new TextInputBuilder()
			.setCustomId(field.id)
			.setLabel(field.label)
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(Boolean(field.required));

		if (field.placeholder) {
			input.setPlaceholder(field.placeholder);
		}

		modal.addComponents(new ActionRowBuilder().addComponents(input));
	}

	return modal;
}

async function createTicketChannel(interaction, ticketType, fields) {
	const panelConfig = getGuildConfig(ticketPanelsFile, interaction.guildId, null) || {};
	const guildSettings = require('./lib/guildSettings').getSettings(interaction.guildId);
	const supportRoleId = panelConfig.supportRoleId || guildSettings.roles?.ticketSupport || null;
	const categoryId = panelConfig.categoryId || guildSettings.channels?.ticketCategory || null;
	const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'user';
	const channelName = `ticket-${ticketType}-${safeName}`.slice(0, 90);

	const overwrites = [
		{
			id: interaction.guild.roles.everyone.id,
			deny: [PermissionFlagsBits.ViewChannel],
		},
		{
			id: interaction.user.id,
			allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
		},
		{
			id: interaction.client.user.id,
			allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
		},
	];

	if (supportRoleId) {
		overwrites.push({
			id: supportRoleId,
			allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
		});
	}

	const ticketChannel = await interaction.guild.channels.create({
		name: channelName,
		type: ChannelType.GuildText,
		parent: categoryId || undefined,
		topic: `ticket:${ticketType}:${interaction.user.id}`,
		permissionOverwrites: overwrites,
		reason: `Ticket created by ${interaction.user.tag}`,
	});

	const ticketEmbed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(`Ticket: ${ticketType}`)
		.setDescription(`Ticket aangemaakt door ${interaction.user}.`);

	for (const [key, value] of Object.entries(fields)) {
		ticketEmbed.addFields({ name: key.replace(/_/g, ' '), value: value || 'Geen antwoord', inline: false });
	}

	const pingText = supportRoleId ? `<@&${supportRoleId}>` : '';
	const controlRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`ticket:claim:${interaction.user.id}`).setLabel('Claim ticket').setStyle(ButtonStyle.Primary).setEmoji('🙋'),
		new ButtonBuilder().setCustomId(`ticket:close:${interaction.user.id}`).setLabel('Sluit ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
	);
	await ticketChannel.send({
		content: `${pingText} ${interaction.user}`.trim(),
		embeds: [ticketEmbed],
		components: [controlRow],
	}).catch(err => {
		console.error('Failed to send ticket summary:', err);
	});

	return ticketChannel;
}

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);


for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Register our commands
deployCommands();


client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
	try {
		const migrated = migrateGuildConfigs();
		if (migrated > 0) {
			console.log(`Migrated config for ${migrated} guild(s) into guildSettings.json`);
		}
	} catch (err) {
		console.error('Config migration failed:', err);
	}
	checkSchedules();
	setInterval(checkSchedules, 60_000);
});

client.on(Events.MessageCreate, async message => {
	try {
		if (!message.guild || message.author.bot) return;

		const ownAfk = afkService.getAfk(message.guild.id, message.author.id);
		if (ownAfk) {
			const removed = afkService.clearAfk(message.guild.id, message.author.id);
			const dur = afkService.formatDuration(Date.now() - removed.since);
			await message.channel.send({ content: `👋 Welkom terug ${message.author}, je was ${dur} AFK.` }).catch(() => null);
		}

		if (message.mentions.users.size > 0) {
			const mentioned = [];
			for (const [id, user] of message.mentions.users) {
				if (id === message.author.id) continue;
				const afk = afkService.getAfk(message.guild.id, id);
				if (afk) {
					const dur = afkService.formatDuration(Date.now() - afk.since);
					mentioned.push(`💤 ${user.username} is AFK (${dur}): *${afk.reason}*`);
				}
			}
			if (mentioned.length) {
				await message.reply({ content: mentioned.join('\n'), allowedMentions: { repliedUser: false } }).catch(() => null);
			}
		}

		if (await handleCountingMessage(message)) {
			return;
		}

		if (await handleMinigameMessage(message)) {
			return;
		}

		if (await handleChallengeMessage(message)) {
			// challenge answer handled — still award XP and maybe crown spawn below
		}

		const gainedXp = Math.floor(Math.random() * (xpPerMessageMax - xpPerMessageMin + 1)) + xpPerMessageMin;
		await processLevelGain({
			guild: message.guild,
			user: message.author,
			member: message.member,
			amount: gainedXp,
			levelsFile,
			rewardsFile,
			levelsChannelFile,
			updateLastMessageAt: true,
		});

		await maybeSpawnCrown(message);
	} catch (err) {
		console.error('messageCreate handler failed:', err);
	}
});

client.on(Events.GuildCreate, async guild => {
	try {
		console.log(`Bot toegevoegd aan nieuwe server ${guild.name} (${guild.id}) — commands deployen...`);
		await deployCommands.deployToGuild(guild.id);
	} catch (err) {
		console.error('GuildCreate command deploy failed:', err);
	}
});

client.on(Events.GuildMemberAdd, async member => {
	try {
		await sendWelcomeMessage(member);
	} catch (error) {
		console.error('GuildMemberAdd handler failed:', error);
	}
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
	await handleReactionRoleUpdate(reaction, user, true);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
	await handleReactionRoleUpdate(reaction, user, false);
});

client.on(Events.InteractionCreate, async interaction => {
	try {
		const isWizardCandidate = interaction.customId && interaction.customId.startsWith('setup:') && (
			interaction.isButton?.() ||
			interaction.isStringSelectMenu?.() ||
			interaction.isChannelSelectMenu?.() ||
			interaction.isRoleSelectMenu?.() ||
			interaction.isModalSubmit?.()
		);
		if (isWizardCandidate) {
			await setupWizard.dispatch(interaction);
			return;
		}

		if (interaction.isButton()) {
			if (interaction.customId.startsWith('coinflip:')) {
				const [, action, duelId] = interaction.customId.split(':');
				const duel = coinflipCommand.activeDuels.get(duelId);
				if (!duel || !duel.escrowed) {
					await interaction.reply({ content: 'Dit duel is verlopen.', flags: 64 });
					return;
				}
				if (interaction.user.id !== duel.opponentId) {
					await interaction.reply({ content: 'Alleen de uitgedaagde persoon kan dit beslissen.', flags: 64 });
					return;
				}

				if (action === 'decline') {
					coinflipCommand.activeDuels.delete(duelId);
					duel.escrowed = false;
					coinService.addBalance(coinsFile, duel.guildId, duel.challengerId, duel.bet);
					coinService.addBalance(coinsFile, duel.guildId, duel.opponentId, duel.bet);
					await interaction.update({
						content: `❌ <@${duel.opponentId}> heeft de uitdaging geweigerd. Inzetten zijn teruggegeven.`,
						embeds: [],
						components: [],
					}).catch(() => null);
					return;
				}

				if (action === 'accept') {
					coinflipCommand.activeDuels.delete(duelId);
					duel.escrowed = false;
					const winnerId = Math.random() < 0.5 ? duel.challengerId : duel.opponentId;
					const pot = duel.bet * 2;
					coinService.addBalance(coinsFile, duel.guildId, winnerId, pot);
					await interaction.update({
						content: `🪙 De munt wordt geworpen...`,
						embeds: [],
						components: [],
					}).catch(() => null);
					await new Promise(r => setTimeout(r, 2000));
					await interaction.editReply({
						content: `🎉 <@${winnerId}> wint de coinflip en krijgt **${pot}** coins! (<@${duel.challengerId}> vs <@${duel.opponentId}>)`,
					}).catch(() => null);
					return;
				}
			}

			if (interaction.customId.startsWith('lb:')) {
				const [, action, type] = interaction.customId.split(':');
				const leaderboardCommand = require('./commands/social/leaderboard');

				const { readJson } = require('./lib/jsonStore');
				const coinsFile = path.join(__dirname, 'data', 'coins.json');
				const levelsFile = path.join(__dirname, 'data', 'levels.json');
				const crownsFile = path.join(__dirname, 'data', 'crowns.json');

				function getLeaderboardData(guildId, type) {
					let data = {};
					switch (type) {
						case 'coins':
							data = readJson(coinsFile, {})[guildId] || {};
							break;
						case 'levels':
							const levelsData = readJson(levelsFile, {})[guildId] || {};
							for (const [userId, userData] of Object.entries(levelsData)) {
								data[userId] = userData.level || 0;
							}
							break;
						case 'crowns':
							data = readJson(crownsFile, {})[guildId] || {};
							break;
					}
					return Object.entries(data)
						.map(([userId, value]) => ({ userId, value: typeof value === 'object' ? value.level || 0 : value }))
						.sort((a, b) => b.value - a.value);
				}

				const ITEMS_PER_PAGE = 10;
				const entries = getLeaderboardData(interaction.guildId, type);
				const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
				let page = 0;

				if (action === 'first') {
					page = 0;
				} else if (action === 'last') {
					page = totalPages - 1;
				} else if (action === 'next') {
					const current = parseInt(interaction.message?.embeds?.[0]?.footer?.text?.match(/\d+/)?.[0] || 1) - 1;
					page = Math.min(current + 1, totalPages - 1);
				} else if (action === 'prev') {
					const current = parseInt(interaction.message?.embeds?.[0]?.footer?.text?.match(/\d+/)?.[0] || 1) - 1;
					page = Math.max(current - 1, 0);
				}

				const titleMap = { coins: '💰 Coin Leaderboard', levels: '🎮 Level Leaderboard', crowns: '👑 Crown Leaderboard' };
				const start = page * ITEMS_PER_PAGE;
				const pageEntries = entries.slice(start, start + ITEMS_PER_PAGE);

				const medals = ['🥇', '🥈', '🥉'];
				const lines = pageEntries.map((entry, idx) => {
					const medal = medals[start + idx] || `#${start + idx + 1}`;
					return `${medal} <@${entry.userId}> — **${entry.value}** ${type === 'coins' ? 'coins' : type === 'crowns' ? 'crowns' : 'level'}`;
				});

				const embed = new EmbedBuilder()
					.setColor(0xb40f0f)
					.setTitle(titleMap[type] || 'Leaderboard')
					.setDescription(lines.join('\n') || 'No data yet.')
					.setFooter({ text: `Page ${page + 1}/${totalPages}` });

				const buttons = new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`lb:first:${type}`).setLabel('First').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
					new ButtonBuilder().setCustomId(`lb:prev:${type}`).setLabel('←').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
					new ButtonBuilder().setCustomId(`lb:next:${type}`).setLabel('→').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
					new ButtonBuilder().setCustomId(`lb:last:${type}`).setLabel('Last').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
				);

				await interaction.update({ embeds: [embed], components: [buttons] }).catch(() => null);
				return;
			}

			if (interaction.customId.startsWith('customrole:')) {
				const parts = interaction.customId.split(':');
				const action = parts[1];

				if (action === 'request') {
					const buyerId = parts[2];
					const pricePaid = Number(parts[3]) || 0;
					if (interaction.user.id !== buyerId) {
						await interaction.reply({ content: 'Alleen de koper kan deze aanvraag invullen.', flags: 64 });
						return;
					}
					const modal = new ModalBuilder()
						.setCustomId(`customrole:submit:${buyerId}:${pricePaid}`)
						.setTitle('Eigen rol aanvragen');
					modal.addComponents(
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId('rolename').setLabel('Rol naam').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true),
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId('rolecolor').setLabel('Hex kleur (bv. #b40f0f)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(true).setPlaceholder('#b40f0f'),
						),
						new ActionRowBuilder().addComponents(
							new TextInputBuilder().setCustomId('reason').setLabel('Waarom wil je deze rol?').setStyle(TextInputStyle.Paragraph).setRequired(false),
						),
					);
					await interaction.showModal(modal);
					return;
				}

				if (action === 'approve' || action === 'deny') {
					const requestId = parts[2];
					const allReq = readJson(customRoleRequestsFile, {});
					const guildReq = allReq[interaction.guildId] || {};
					const req = guildReq[requestId];
					if (!req || req.handled) {
						await interaction.reply({ content: 'Deze aanvraag is al afgehandeld of bestaat niet meer.', flags: 64 });
						return;
					}
					const settings = getSettings(interaction.guildId);
					const supportRoleId = settings.roles?.ticketSupport;
					const isMod = (supportRoleId && interaction.member?.roles?.cache?.has(supportRoleId))
						|| interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles);
					if (!isMod) {
						await interaction.reply({ content: '❌ Alleen mods kunnen aanvragen afhandelen.', flags: 64 });
						return;
					}

					if (action === 'deny') {
						req.handled = true;
						req.deniedBy = interaction.user.id;
						guildReq[requestId] = req;
						allReq[interaction.guildId] = guildReq;
						writeJson(customRoleRequestsFile, allReq);
						// Refund
						coinService.addBalance(coinsFile, interaction.guildId, req.userId, req.pricePaid);
						await interaction.update({
							content: `❌ Aanvraag afgewezen door <@${interaction.user.id}>. <@${req.userId}> heeft **${req.pricePaid}** coins teruggekregen.`,
							components: [],
						}).catch(() => null);
						return;
					}

					// Approve: maak rol aan
					try {
						const guild = interaction.guild;
						const role = await guild.roles.create({
							name: req.roleName,
							color: req.roleColor,
							reason: `Custom role purchase by ${req.userId}, approved by ${interaction.user.id}`,
						});
						const member = await guild.members.fetch(req.userId).catch(() => null);
						if (member) {
							await member.roles.add(role.id).catch(() => null);
						}
						req.handled = true;
						req.approvedBy = interaction.user.id;
						req.roleId = role.id;
						guildReq[requestId] = req;
						allReq[interaction.guildId] = guildReq;
						writeJson(customRoleRequestsFile, allReq);
						await interaction.update({
							content: `✅ Aanvraag goedgekeurd door <@${interaction.user.id}>. Rol <@&${role.id}> is aangemaakt en toegekend aan <@${req.userId}>.`,
							components: [],
						}).catch(() => null);
					} catch (err) {
						console.error('Failed to create custom role:', err);
						await interaction.reply({ content: `❌ Kon rol niet aanmaken: ${err.message}`, flags: 64 });
					}
					return;
				}
			}

			if (interaction.customId.startsWith('blackjack:')) {
				const [, gameId, action] = interaction.customId.split(':');
				const games = loadBlackjackGames();
				const state = games[gameId];

				if (!state || state.guildId !== interaction.guildId) {
					await interaction.reply({ content: 'Deze blackjack game bestaat niet meer.', flags: 64 });
					return;
				}

				if (state.userId !== interaction.user.id) {
					await interaction.reply({ content: 'Alleen de speler die de game startte kan dit doen.', flags: 64 });
					return;
				}

				if (state.finished) {
					await interaction.reply({ content: 'Deze blackjack game is al afgelopen.', flags: 64 });
					return;
				}

				if (action === 'hit') {
					await interaction.deferUpdate().catch(() => null);
					state.playerHand.push(drawCard(state.deck));
					games[gameId] = state;
					saveBlackjackGames(games);
					const targetMessage = await resolveBlackjackMessage(interaction);

					if (isBust(state.playerHand)) {
						const result = await settleBlackjackState(interaction, state, 'bust');
						await targetMessage.edit({ content: `<@${state.userId}> ${result.resultText}`, embeds: [result.embed], components: result.components }).catch(error => {
							console.error('Failed to edit blackjack bust message:', error);
						});
						return;
					}

					await targetMessage.edit({
						content: `<@${state.userId}> Blackjack is nu draaiende. Gebruik Hit of Stand.`,
						embeds: [buildBlackjackEmbed(state, false, 'Blackjack is nu draaiende. Gebruik Hit of Stand.')],
						components: [buildBlackjackButtons(gameId)],
					}).catch(error => {
						console.error('Failed to edit blackjack hit message:', error);
					});
					return;
				}

				if (action === 'stand') {
					await interaction.deferUpdate().catch(() => null);
					const targetMessage = await resolveBlackjackMessage(interaction);
					const result = await settleBlackjackState(interaction, state, 'stand');
					await targetMessage.edit({ content: `<@${state.userId}> ${result.resultText}`, embeds: [result.embed], components: result.components }).catch(error => {
						console.error('Failed to edit blackjack stand message:', error);
					});
					return;
				}
			}

			if (interaction.customId.startsWith('crownclaim:')) {
				const claimId = interaction.customId.split(':')[1];
				const allClaims = readJson(crownsClaimsFile, {});
				const claim = allClaims[claimId];

				if (!claim || claim.guildId !== interaction.guildId) {
					await interaction.reply({ content: 'Dit kroontje bestaat niet meer.', flags: 64 });
					return;
				}

				if (claim.claimedBy) {
					await interaction.reply({ content: 'Dit kroontje is al geclaimd.', flags: 64 });
					return;
				}

				await interaction.deferUpdate().catch(() => null);
				claim.claimedBy = interaction.user.id;
				claim.claimedAt = Date.now();
				writeJson(crownsClaimsFile, allClaims);

				addCrownBalance(crownsFile, interaction.guildId, interaction.user.id, 1);

				const disabledRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(interaction.customId)
						.setLabel('Geclaimd')
						.setStyle(ButtonStyle.Success)
						.setDisabled(true),
				);

				await interaction.message.edit({ components: [disabledRow] }).catch(() => null);
				await interaction.followUp({ content: 'Je hebt 1 kroontje geclaimd!', ephemeral: true }).catch(() => null);
				return;
			}

			if (interaction.customId.startsWith('menu:')) {
				const section = interaction.customId.split(':')[1];
				await interaction.update({
					embeds: [menuCommand.buildEmbed(section)],
					components: menuCommand.buildButtons(section),
				}).catch(() => null);
				return;
			}

			if (interaction.customId.startsWith('mg:ms:')) {
				const parts = interaction.customId.split(':');
				const gameId = parts[2];
				const action = parts[3];
				const state = minigameService.getActiveGame(interaction.guildId, interaction.channelId);
				if (!state || state.game !== 'minesweeper' || state.gameId !== gameId) {
					await interaction.reply({ content: 'Deze minesweeper-game bestaat niet meer.', flags: 64 });
					return;
				}
				if (state.starterId !== interaction.user.id) {
					await interaction.reply({ content: 'Alleen de speler kan dit bord bedienen.', flags: 64 });
					return;
				}

				if (action === 'flag') {
					state.flagMode = !state.flagMode;
					minigameService.setActiveGame(interaction.guildId, interaction.channelId, state);
					await interaction.update({
						embeds: [minigameService.buildMinesweeperEmbed(state)],
						components: minigameService.buildMinesweeperRows(state),
					}).catch(() => null);
					return;
				}

				if (action === 'stop') {
					state.finished = true;
					state.won = false;
					minigameService.setActiveGame(interaction.guildId, interaction.channelId, null);
					await interaction.update({
						embeds: [minigameService.buildMinesweeperEmbed(state)],
						components: minigameService.buildMinesweeperRows(state),
					}).catch(() => null);
					return;
				}

				const idx = Number(action);
				if (!Number.isInteger(idx) || idx < 0 || idx >= state.cells.length) {
					await interaction.reply({ content: 'Ongeldige cel.', flags: 64 });
					return;
				}
				const cell = state.cells[idx];
				if (cell.revealed) {
					await interaction.deferUpdate().catch(() => null);
					return;
				}

				if (state.flagMode) {
					cell.flagged = !cell.flagged;
				} else if (cell.flagged) {
					await interaction.deferUpdate().catch(() => null);
					return;
				} else if (cell.bomb) {
					cell.revealed = true;
					state.finished = true;
					state.won = false;
					minigameService.setActiveGame(interaction.guildId, interaction.channelId, null);
					await interaction.update({
						embeds: [minigameService.buildMinesweeperEmbed(state)],
						components: minigameService.buildMinesweeperRows(state),
					}).catch(() => null);
					return;
				} else {
					minigameService.revealMinesweeperFlood(state, idx);
					if (minigameService.checkMinesweeperWin(state)) {
						state.finished = true;
						state.won = true;
						const reward = await minigameService.awardWin(interaction.guildId, interaction.user.id, 'minesweeper');
						minigameService.setActiveGame(interaction.guildId, interaction.channelId, null);
						await interaction.update({
							embeds: [minigameService.buildMinesweeperEmbed(state)],
							components: minigameService.buildMinesweeperRows(state),
						}).catch(() => null);
						if (reward > 0) {
							await interaction.followUp({ content: `🎉 Je wint **${reward}** kroontjes!`, flags: 64 }).catch(() => null);
						}
						return;
					}
				}

				minigameService.setActiveGame(interaction.guildId, interaction.channelId, state);
				await interaction.update({
					embeds: [minigameService.buildMinesweeperEmbed(state)],
					components: minigameService.buildMinesweeperRows(state),
				}).catch(() => null);
				return;
			}

			if (interaction.customId.startsWith('rolecat:toggle:')) {
				const [, , categoryId, roleId] = interaction.customId.split(':');
				const category = roleCategoryService.getCategory(interaction.guildId, categoryId);
				if (!category) {
					await interaction.reply({ content: 'Deze categorie bestaat niet meer.', flags: 64 });
					return;
				}
				if (!category.roleIds.includes(roleId)) {
					await interaction.reply({ content: 'Deze rol zit niet meer in deze categorie.', flags: 64 });
					return;
				}

				const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
				if (!member) {
					await interaction.reply({ content: 'Kon je lid niet ophalen.', flags: 64 });
					return;
				}

				const hasRole = member.roles.cache.has(roleId);
				if (hasRole) {
					await member.roles.remove(roleId).catch(() => null);
					await interaction.reply({ content: `Rol <@&${roleId}> verwijderd.`, flags: 64 });
					return;
				}

				if (category.exclusive) {
					for (const otherRoleId of category.roleIds) {
						if (otherRoleId !== roleId && member.roles.cache.has(otherRoleId)) {
							await member.roles.remove(otherRoleId).catch(() => null);
						}
					}
				}

				await member.roles.add(roleId).catch(() => null);
				await interaction.reply({ content: `Rol <@&${roleId}> toegevoegd.`, flags: 64 });
				return;
			}

			if (interaction.customId.startsWith('ticket:claim:')) {
				const creatorId = interaction.customId.split(':')[2];
				const member = interaction.member;
				const settings = getSettings(interaction.guildId);
				const supportRoleId = settings.roles?.ticketSupport;
				const isSupport = supportRoleId && member?.roles?.cache?.has(supportRoleId);
				const isAdmin = member?.permissions?.has(PermissionFlagsBits.ManageChannels);
				if (!isSupport && !isAdmin) {
					await interaction.reply({ content: '❌ Alleen support-rol of admins kunnen dit ticket claimen.', flags: 64 });
					return;
				}

				const closeButton = new ButtonBuilder().setCustomId(`ticket:close:${creatorId}`).setLabel('Sluit ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒');
				const updatedRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId(`ticket:claimed:${interaction.user.id}`).setLabel(`Geclaimd door ${interaction.user.username}`).setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(true),
					closeButton,
				);

				await interaction.update({ components: [updatedRow] }).catch(() => null);
				await interaction.followUp({
					content: `<@${creatorId}> ✅ Je ticket is geclaimd door <@${interaction.user.id}> — ze gaan ernaar kijken.`,
					allowedMentions: { users: [creatorId] },
				}).catch(err => console.error('Failed to ping creator on claim:', err));
				return;
			}

			if (interaction.customId.startsWith('ticket:close:')) {
				const creatorId = interaction.customId.split(':')[2];
				const member = interaction.member;
				const settings = getSettings(interaction.guildId);
				const supportRoleId = settings.roles?.ticketSupport;
				const isSupport = supportRoleId && member?.roles?.cache?.has(supportRoleId);
				const isAdmin = member?.permissions?.has(PermissionFlagsBits.ManageChannels);
				const isCreator = interaction.user.id === creatorId;
				if (!isSupport && !isAdmin && !isCreator) {
					await interaction.reply({ content: '❌ Alleen de aanmaker, support-rol of admins kunnen dit ticket sluiten.', flags: 64 });
					return;
				}

				const disabledRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('ticket:closing').setLabel('Sluiten...').setStyle(ButtonStyle.Secondary).setEmoji('🔒').setDisabled(true),
				);
				await interaction.update({ components: [disabledRow] }).catch(() => null);
				await interaction.followUp({ content: `🔒 Ticket gesloten door <@${interaction.user.id}>. Dit kanaal wordt over **5 seconden** verwijderd.` }).catch(() => null);

				const channel = interaction.channel;
				setTimeout(() => {
					channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(err => {
						console.error('Failed to delete ticket channel:', err);
					});
				}, 5000);
				return;
			}

			if (interaction.customId.startsWith('ticketpanel:')) {
				const ticketType = interaction.customId.split(':')[1];

				if (ticketType === 'sollicitaties') {
					const apps = require('./lib/guildSettings').getApplicationRoles(interaction.guildId);
					if (!apps.length) {
						await interaction.reply({ content: '❌ Er staan momenteel geen sollicitatie-rollen ingesteld. Een admin moet ze eerst aanmaken via `/setup → Rollen → Sollicitatie-rollen`.', flags: 64 });
						return;
					}
					const available = apps.filter(a => a.available);
					if (!available.length) {
						const list = apps.map(a => `• ${a.label} — _niet beschikbaar momenteel_`).join('\n');
						await interaction.reply({ content: `❌ Er zijn momenteel geen rollen open voor sollicitatie.\n\n${list}`, flags: 64 });
						return;
					}

					const select = new StringSelectMenuBuilder()
						.setCustomId('applyrole:select')
						.setPlaceholder('Kies de rol waarvoor je solliciteert');

					for (const a of apps.slice(0, 25)) {
						select.addOptions({
							label: a.available ? a.label.slice(0, 100) : `${a.label} (niet beschikbaar momenteel)`.slice(0, 100),
							value: a.available ? `open:${a.id}` : `closed:${a.id}`,
							description: a.available ? 'Beschikbaar voor sollicitatie' : 'Niet beschikbaar momenteel',
						});
					}

					await interaction.reply({
						content: '📨 **Sollicitatie starten**\nKies hieronder voor welke rol je solliciteert. Rollen met _"(niet beschikbaar momenteel)"_ kunnen niet gekozen worden.',
						components: [new ActionRowBuilder().addComponents(select)],
						flags: 64,
					});
					return;
				}

				const modal = buildTicketModal(ticketType);
				if (!modal) {
					await interaction.reply({ content: 'Onbekend tickettype.', flags: 64 });
					return;
				}

				await interaction.showModal(modal);
				return;
			}
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('redembed:submit:')) {
			await redembedCommand.handleModal(interaction);
			return;
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('customrole:submit:')) {
			const parts = interaction.customId.split(':');
			const buyerId = parts[2];
			const pricePaid = Number(parts[3]) || 0;
			if (interaction.user.id !== buyerId) {
				await interaction.reply({ content: 'Alleen de koper kan deze aanvraag indienen.', flags: 64 });
				return;
			}
			const roleName = interaction.fields.getTextInputValue('rolename').trim().slice(0, 80);
			let roleColor = interaction.fields.getTextInputValue('rolecolor').trim();
			if (!/^#[0-9A-Fa-f]{6}$/.test(roleColor)) {
				await interaction.reply({ content: '❌ Kleur moet een hex zijn zoals `#b40f0f`. Aanvraag NIET ingediend, je coins zijn nog niet uitgegeven aan een mod-aanvraag. Probeer opnieuw via /shop buy.', flags: 64 });
				// Refund omdat aanvraag faalt
				coinService.addBalance(coinsFile, interaction.guildId, buyerId, pricePaid);
				return;
			}
			const reason = (interaction.fields.getTextInputValue('reason') || '').slice(0, 500);

			const requestId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
			const allReq = readJson(customRoleRequestsFile, {});
			const guildReq = allReq[interaction.guildId] || {};
			guildReq[requestId] = {
				userId: buyerId,
				roleName,
				roleColor,
				reason,
				pricePaid,
				createdAt: Date.now(),
				handled: false,
			};
			allReq[interaction.guildId] = guildReq;
			writeJson(customRoleRequestsFile, allReq);

			// Post bericht in modlog of in eerste beschikbaar kanaal voor mods
			const settings = getSettings(interaction.guildId);
			const modChannelId = settings.channels?.modlog || settings.channels?.ticketPanel;
			let target = null;
			if (modChannelId) {
				target = interaction.guild.channels.cache.get(modChannelId) || await interaction.guild.channels.fetch(modChannelId).catch(() => null);
			}

			const embed = new EmbedBuilder()
				.setColor(roleColor)
				.setTitle('🎨 Custom rol aanvraag')
				.setDescription(`Aanvrager: <@${buyerId}>\nNaam: **${roleName}**\nKleur: \`${roleColor}\`\nReden: ${reason || '_geen_'}`)
				.setFooter({ text: `Request ID: ${requestId} • Mods kunnen beslissen` });

			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId(`customrole:approve:${requestId}`).setLabel('Goedkeuren').setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId(`customrole:deny:${requestId}`).setLabel('Afwijzen').setStyle(ButtonStyle.Danger),
			);

			if (target?.isTextBased?.()) {
				await target.send({ embeds: [embed], components: [row] }).catch(() => null);
				await interaction.reply({ content: '✅ Je aanvraag is verstuurd naar de mods. Je krijgt bericht zodra ze hebben beslist.', flags: 64 });
			} else {
				await interaction.reply({
					content: '✅ Aanvraag opgeslagen, maar er is geen mod-kanaal ingesteld. Vraag een admin om een **modlog** of **ticketPanel** kanaal in te stellen via /setup.',
					embeds: [embed],
					components: [row],
					flags: 64,
				});
			}
			return;
		}

		if (interaction.isModalSubmit() && interaction.customId === 'confess_modal') {
			const content = interaction.fields.getTextInputValue('confession_text').trim();

			if (!content) {
				await interaction.reply({ content: '❌ Confession cannot be empty.', flags: 64 });
				return;
			}

			const settings = getSettings(interaction.guildId);
			const confessionChannelId = settings.channels?.modlog;

			if (!confessionChannelId) {
				await interaction.reply({
					content: '❌ Confession channel not set. Ask admin to configure via `/setup`.',
					flags: 64,
				});
				return;
			}

			try {
				const channel = await interaction.guild.channels.fetch(confessionChannelId).catch(() => null);
				if (!channel || !channel.isTextBased?.()) {
					await interaction.reply({ content: '❌ Confession channel not found or invalid.', flags: 64 });
					return;
				}

				const confessionId = confessionService.submitConfession(interaction.guildId, content);
				const confessionNumber = confessionId.split('_')[1] || Math.floor(Math.random() * 10000);

				const embed = new EmbedBuilder()
					.setColor(0x9b59b6)
					.setTitle(`📝 Anonymous Confession #${confessionNumber}`)
					.setDescription(content)
					.setFooter({ text: `React with reactions to engage` });

				await channel.send({ embeds: [embed] });
				await interaction.reply({
					content: '✅ Your confession has been posted anonymously!',
					flags: 64,
				});
			} catch (err) {
				console.error('Confession submission failed:', err);
				await interaction.reply({
					content: `❌ Failed to post confession: ${err.message}`,
					flags: 64,
				});
			}
			return;
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith('ticketmodal:')) {
			const parts = interaction.customId.split(':');
			const ticketType = parts[1];
			const extraId = parts[2] || null;

			const fieldDefinitions = {
				partnerships: ['server_name', 'member_count', 'discord_link', 'goal'],
				vragen: ['question', 'context', 'priority'],
				twitch_promotie: ['twitch_name', 'stream_link', 'promotion_goal', 'extra'],
				sollicitaties: ['name', 'experience', 'motivation'],
			}[ticketType];

			if (!fieldDefinitions) {
				await interaction.reply({ content: 'Onbekend tickettype.', flags: 64 });
				return;
			}

			const ticketFields = {};
			for (const fieldId of fieldDefinitions) {
				ticketFields[fieldId] = interaction.fields.getTextInputValue(fieldId);
			}

			if (ticketType === 'sollicitaties' && extraId) {
				const apps = require('./lib/guildSettings').getApplicationRoles(interaction.guildId);
				const app = apps.find(a => a.id === extraId);
				if (!app) {
					await interaction.reply({ content: '❌ De gekozen rol bestaat niet meer.', flags: 64 });
					return;
				}
				if (!app.available) {
					await interaction.reply({ content: '❌ Deze rol is intussen niet meer beschikbaar voor sollicitatie.', flags: 64 });
					return;
				}
				ticketFields.position = app.roleId ? `${app.label} (<@&${app.roleId}>)` : app.label;
			}

			await interaction.deferReply({ flags: 64 }).catch(() => null);

			let ticketChannel;
			try {
				ticketChannel = await createTicketChannel(interaction, ticketType, ticketFields);
			} catch (err) {
				console.error('Failed to create ticket channel:', err);
				await interaction.editReply({ content: '❌ Er ging iets mis bij het aanmaken van het ticket. Controleer of het ticket-panel correct is ingesteld via `/setup → Tickets`.' }).catch(() => null);
				return;
			}

			if (!ticketChannel) {
				await interaction.editReply({ content: '❌ Kon ticket niet aanmaken. Heb je het ticket-panel al geplaatst via `/setup → Tickets → Plaats panel`?' }).catch(() => null);
				return;
			}

			await interaction.editReply({ content: `✅ Ticket aangemaakt: ${ticketChannel}` }).catch(() => null);
			return;
		}

	if (interaction.isStringSelectMenu() && interaction.customId === 'applyrole:select') {
		const value = interaction.values?.[0] || '';
		if (value.startsWith('closed:')) {
			await interaction.reply({ content: '🚫 Deze rol is momenteel niet beschikbaar voor sollicitatie. Kies een andere of probeer later opnieuw.', flags: 64 });
			return;
		}
		const id = value.replace(/^open:/, '');
		const apps = require('./lib/guildSettings').getApplicationRoles(interaction.guildId);
		const app = apps.find(a => a.id === id);
		if (!app || !app.available) {
			await interaction.reply({ content: '❌ Deze rol is niet meer beschikbaar.', flags: 64 });
			return;
		}

		const modal = new ModalBuilder()
			.setCustomId(`ticketmodal:sollicitaties:${app.id}`)
			.setTitle(`Sollicitatie: ${app.label}`.slice(0, 45));
		modal.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('name').setLabel('Naam').setStyle(TextInputStyle.Short).setPlaceholder('Hoe mogen we je noemen?').setRequired(true),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('experience').setLabel('Ervaring').setStyle(TextInputStyle.Paragraph).setPlaceholder('Welke ervaring heb je?').setRequired(true),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('motivation').setLabel('Motivatie').setStyle(TextInputStyle.Paragraph).setPlaceholder('Waarom wil je dit doen?').setRequired(true),
			),
		);
		await interaction.showModal(modal);
		return;
	}

	if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rolemenu:')) {
		const menuId = interaction.customId.split(':')[1];
		const allMenus = readJson(roleMenusFile, {});
		const menuConfig = allMenus[menuId];

		if (!menuConfig || menuConfig.guildId !== interaction.guildId) {
			await interaction.reply({ content: 'Dit rolmenu bestaat niet meer.', flags: 64 });
			return;
		}

		const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
		if (!member) {
			await interaction.reply({ content: 'Kon je lid niet ophalen.', flags: 64 });
			return;
		}

		const selectedRoleIds = new Set(interaction.values);
		const menuRoleIds = menuConfig.roles.map(role => role.roleId);

		const errors = [];
		for (const roleId of menuRoleIds) {
			if (selectedRoleIds.has(roleId)) {
				await member.roles.add(roleId).catch(err => {
					errors.push(`Kon rol <@&${roleId}> niet toevoegen: ${err.message}`);
				});
			} else {
				await member.roles.remove(roleId).catch(err => {
					errors.push(`Kon rol <@&${roleId}> niet verwijderen: ${err.message}`);
				});
			}
		}

		if (errors.length > 0) {
			await interaction.reply({ content: `❌ Enkele rollen konden niet worden bijgewerkt:\n${errors.join('\n')}`, flags: 64 });
		} else {
			await interaction.reply({ content: '✅ Je rollen zijn bijgewerkt.', flags: 64 });
		}
		return;
	}

		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
		}

		const restriction = checkCommandAllowed(interaction, interaction.commandName);
		if (!restriction.allowed) {
			await interaction.reply({ content: restriction.reason || 'Dit command is hier niet toegestaan.', flags: 64 }).catch(() => null);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(`Command /${interaction.commandName} failed:`, error);
			const errorMessage = '❌ Er ging iets mis bij het uitvoeren van dit command. Probeer het opnieuw of contacteer een admin als het blijft falen.';
			try {
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: errorMessage, flags: 64 });
				} else {
					await interaction.reply({ content: errorMessage, flags: 64 });
				}
			} catch (replyError) {
				console.error('Failed to send error message:', replyError);
			}
		}
	} catch (error) {
		console.error('InteractionCreate handler failed:', error);
	}
});

(async () => {
	try {
		// Preload data uit MongoDB (en seed bestaande JSON-bestanden als ze nog niet in Mongo staan)
		await preloadDirectory(path.join(__dirname, 'data'));
	} catch (err) {
		console.error('preloadDirectory failed (continuing with file fallback):', err.message);
	}
	await client.login(BOT_TOKEN);
})();