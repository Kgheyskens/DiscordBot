const { SlashCommandBuilder } = require('discord.js');
const reminderService = require('../../lib/reminderService');

function parseTime(timeStr) {
	const lower = timeStr.toLowerCase().trim();

	// "2h30m" or "2h" or "30m"
	const match = lower.match(/^(\d+)\s*([hm])(?:\s*(\d+)\s*([hm]))?$/);
	if (match) {
		let ms = 0;
		const [, val1, unit1, val2, unit2] = match;
		ms += parseInt(val1, 10) * (unit1 === 'h' ? 3600000 : 60000);
		if (val2) {
			ms += parseInt(val2, 10) * (unit2 === 'h' ? 3600000 : 60000);
		}
		return ms;
	}

	// "tomorrow", "tomorrow 3pm", etc.
	if (lower.includes('tomorrow')) {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);

		const timeMatch = lower.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/i);
		if (timeMatch) {
			let hour = parseInt(timeMatch[1], 10);
			if (timeMatch[4]?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
			if (timeMatch[4]?.toLowerCase() === 'am' && hour === 12) hour = 0;
			tomorrow.setHours(hour, parseInt(timeMatch[3] || 0, 10), 0, 0);
		}

		return tomorrow.getTime() - Date.now();
	}

	return null;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remind')
		.setDescription('Set a reminder')
		.addStringOption(opt =>
			opt.setName('when')
				.setDescription('When to remind (e.g., "2h", "30m", "2h30m", "tomorrow 3pm")')
				.setRequired(true))
		.addStringOption(opt =>
			opt.setName('text')
				.setDescription('What to remind you about')
				.setMaxLength(200)
				.setRequired(true)),
	async execute(interaction) {
		const timeStr = interaction.options.getString('when');
		const text = interaction.options.getString('text');

		const delayMs = parseTime(timeStr);
		if (!delayMs || delayMs < 60000) {
			await interaction.reply({
				content: '❌ Invalid time format. Use: "2h", "30m", "2h30m", or "tomorrow 3pm".',
				flags: 64,
			});
			return;
		}

		const fireAt = Date.now() + delayMs;

		try {
			const reminderId = reminderService.createReminder(
				interaction.guildId,
				interaction.user.id,
				interaction.channel.id,
				text,
				fireAt,
				'user',
			);

			const delayMins = Math.round(delayMs / 60000);
			const delayHours = Math.floor(delayMins / 60);
			const minsRem = delayMins % 60;

			let timeDisplay;
			if (delayHours > 0 && minsRem > 0) {
				timeDisplay = `${delayHours}h ${minsRem}m`;
			} else if (delayHours > 0) {
				timeDisplay = `${delayHours}h`;
			} else {
				timeDisplay = `${delayMins}m`;
			}

			await interaction.reply({
				content: `✅ Reminder set! You'll be reminded in **${timeDisplay}**: ${text}`,
				flags: 64,
			});
		} catch (err) {
			await interaction.reply({ content: `❌ Error: ${err.message}`, flags: 64 });
		}
	},
};
