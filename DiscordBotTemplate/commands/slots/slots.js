const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { addBalance, getBalance, subtractBalance } = require('../../lib/coinService');
const { isEconomyEnabled } = require('../../lib/economyService');
const slotsService = require('../../lib/slotsService');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

const MAX_BET = 100_000;
const MIN_BET = 10;

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

function buildEmbed(rowText, statusText, jackpot) {
	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🎰 Slot Machine')
		.setDescription(`╔═══════════════╗\n  **${rowText}**\n╚═══════════════╝\n\n${statusText}`)
		.setFooter({ text: `Jackpot pool: ${jackpot} coins` });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('slots')
		.setDescription('Speel de slot machine')
		.addIntegerOption(opt =>
			opt.setName('inzet')
				.setDescription('Hoeveel coins je inzet')
				.setMinValue(MIN_BET)
				.setMaxValue(MAX_BET)
				.setRequired(true)),
	async execute(interaction) {
		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: '❌ Het economy-systeem staat uit.', flags: 64 });
			return;
		}

		const bet = interaction.options.getInteger('inzet');
		const balance = getBalance(coinsFile, interaction.guildId, interaction.user.id);
		if (balance < bet) {
			await interaction.reply({ content: `❌ Je hebt maar ${balance} coins.`, flags: 64 });
			return;
		}

		if (subtractBalance(coinsFile, interaction.guildId, interaction.user.id, bet) === null) {
			await interaction.reply({ content: '❌ Je balans is intussen veranderd.', flags: 64 });
			return;
		}

		await interaction.deferReply();

		const jackpotBefore = slotsService.getJackpot(interaction.guildId);

		// Animatie: 3 keer een willekeurige rij tonen, dan het echte resultaat
		await interaction.editReply({
			embeds: [buildEmbed(slotsService.randomRow(), `🎲 Spinning... (inzet: **${bet}** coins)`, jackpotBefore)],
		});
		await sleep(900);
		await interaction.editReply({
			embeds: [buildEmbed(slotsService.randomRow(), `🎲 Spinning...`, jackpotBefore)],
		});
		await sleep(900);

		const result = slotsService.spin();
		const evaluation = slotsService.evaluate(result, bet, interaction.guildId);
		const finalRow = slotsService.formatRow(result);

		let statusText;
		if (evaluation.outcome === 'jackpot') {
			addBalance(coinsFile, interaction.guildId, interaction.user.id, evaluation.payout);
			statusText = `🎉 **JACKPOT!** Je wint **${evaluation.payout}** coins! Pool reset.`;
		} else if (evaluation.outcome === 'win') {
			addBalance(coinsFile, interaction.guildId, interaction.user.id, evaluation.payout);
			statusText = `🎉 **${evaluation.label}** — je wint **${evaluation.payout}** coins!`;
		} else if (evaluation.outcome === 'small') {
			addBalance(coinsFile, interaction.guildId, interaction.user.id, evaluation.payout);
			statusText = `🙂 **${evaluation.label}** — kleine winst van **${evaluation.payout}** coins.`;
		} else {
			// Loss: bijdrage aan jackpot
			const contribution = Math.floor(bet * slotsService.JACKPOT_CONTRIBUTION);
			if (contribution > 0) {
				slotsService.addToJackpot(interaction.guildId, contribution);
			}
			statusText = `💸 ${evaluation.label}. Je verliest **${bet}** coins.`;
		}

		const jackpotAfter = slotsService.getJackpot(interaction.guildId);
		const newBalance = getBalance(coinsFile, interaction.guildId, interaction.user.id);
		statusText += `\nBalans: **${newBalance}** coins.`;

		await interaction.editReply({
			content: `<@${interaction.user.id}>`,
			embeds: [buildEmbed(finalRow, statusText, jackpotAfter)],
		});
	},
};
