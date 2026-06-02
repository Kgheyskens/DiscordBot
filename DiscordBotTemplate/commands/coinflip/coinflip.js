const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} = require('discord.js');
const { addBalance, getBalance, subtractBalance } = require('../../lib/coinService');
const { isEconomyEnabled } = require('../../lib/economyService');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

const MAX_BET = 500_000;
const ACCEPT_TIMEOUT_MS = 60_000;

// In-memory map van actieve duels: customId-key → { challengerId, opponentId, bet, escrowed }
const activeDuels = new Map();

function buildPromptEmbed(challenger, opponent, bet) {
	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🪙 Coinflip duel')
		.setDescription([
			`<@${challenger.id}> daagt <@${opponent.id}> uit voor een coinflip!`,
			`**Inzet:** ${bet} coins per persoon (winner takes all = ${bet * 2}).`,
			'',
			`<@${opponent.id}> — accepteer of weiger binnen 60 seconden.`,
		].join('\n'));
}

function buildButtons(duelId, disabled = false) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId(`coinflip:accept:${duelId}`).setLabel('Accepteer').setStyle(ButtonStyle.Success).setDisabled(disabled),
		new ButtonBuilder().setCustomId(`coinflip:decline:${duelId}`).setLabel('Weiger').setStyle(ButtonStyle.Danger).setDisabled(disabled),
	);
}

function generateDuelId() {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('coinflip')
		.setDescription('Daag iemand uit voor een 1v1 coinflip')
		.addUserOption(opt => opt.setName('tegenstander').setDescription('Wie daag je uit').setRequired(true))
		.addIntegerOption(opt => opt.setName('inzet').setDescription('Hoeveel coins per persoon').setMinValue(1).setMaxValue(MAX_BET).setRequired(true)),
	async execute(interaction) {
		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: '❌ Het economy-systeem staat uit.', flags: 64 });
			return;
		}

		const opponent = interaction.options.getUser('tegenstander');
		const bet = interaction.options.getInteger('inzet');

		if (opponent.bot) {
			await interaction.reply({ content: '❌ Je kunt geen bot uitdagen.', flags: 64 });
			return;
		}
		if (opponent.id === interaction.user.id) {
			await interaction.reply({ content: '❌ Je kunt jezelf niet uitdagen.', flags: 64 });
			return;
		}

		const challengerBal = getBalance(coinsFile, interaction.guildId, interaction.user.id);
		const opponentBal = getBalance(coinsFile, interaction.guildId, opponent.id);
		if (challengerBal < bet) {
			await interaction.reply({ content: `❌ Je hebt maar ${challengerBal} coins.`, flags: 64 });
			return;
		}
		if (opponentBal < bet) {
			await interaction.reply({ content: `❌ <@${opponent.id}> heeft niet genoeg coins (${opponentBal}).`, flags: 64 });
			return;
		}

		// Escrow: trek inzet bij beide weg, betaal terug bij decline/timeout
		if (subtractBalance(coinsFile, interaction.guildId, interaction.user.id, bet) === null) {
			await interaction.reply({ content: '❌ Je balans veranderde net.', flags: 64 });
			return;
		}
		if (subtractBalance(coinsFile, interaction.guildId, opponent.id, bet) === null) {
			addBalance(coinsFile, interaction.guildId, interaction.user.id, bet);
			await interaction.reply({ content: '❌ Tegenstander z\'n balans veranderde net.', flags: 64 });
			return;
		}

		const duelId = generateDuelId();
		activeDuels.set(duelId, {
			challengerId: interaction.user.id,
			opponentId: opponent.id,
			guildId: interaction.guildId,
			bet,
			escrowed: true,
		});

		await interaction.reply({
			content: `<@${opponent.id}>`,
			embeds: [buildPromptEmbed(interaction.user, opponent, bet)],
			components: [buildButtons(duelId)],
		});

		setTimeout(async () => {
			const duel = activeDuels.get(duelId);
			if (!duel || !duel.escrowed) return;
			activeDuels.delete(duelId);
			addBalance(coinsFile, duel.guildId, duel.challengerId, duel.bet);
			addBalance(coinsFile, duel.guildId, duel.opponentId, duel.bet);
			await interaction.editReply({
				content: `⏰ De uitdaging is verlopen — inzetten zijn teruggegeven.`,
				embeds: [],
				components: [buildButtons(duelId, true)],
			}).catch(() => null);
		}, ACCEPT_TIMEOUT_MS);
	},
	activeDuels,
};
