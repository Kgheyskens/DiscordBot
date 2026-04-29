const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { processLevelGain } = require('../../lib/levelingService');

const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');
const levelsChannelFile = path.join(__dirname, '..', '..', 'data', 'levelsChannel.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givexp')
    .setDescription('Geef XP aan een gebruiker (admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of XP').setRequired(true)),
  async execute(interaction) {
    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
        return;
      }

      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (!target || typeof amount !== 'number' || amount <= 0) {
        await interaction.reply({ content: 'Ongeldige invoer. Zorg dat je een gebruiker en een positief aantal XP opgeeft.', flags: 64 });
        return;
      }

      const result = await processLevelGain({
        guild: interaction.guild,
        user: target,
        amount,
        levelsFile,
        rewardsFile,
        levelsChannelFile,
        updateLastMessageAt: false,
      });

      let reply = `Gegeven ${amount} XP aan ${target.tag}. Huidige XP: ${result.xp}, level: ${result.level}.`;
      if (result.rewardNames.length) reply += `\nToegekende rollen: ${result.rewardNames.join(', ')}`;
      if (result.leveledUp) reply += `\n${target.tag} is gestegen van level ${result.previousLevel} naar ${result.level}!`;

      await interaction.reply({ content: reply, flags: 64 });
    } catch (err) {
      console.error('givexp failed:', err);
      try {
        if (!interaction.replied) await interaction.reply({ content: 'Er is iets misgegaan bij het uitvoeren van /givexp.', flags: 64 });
      } catch (e) {
        console.error('Failed to send error reply for /givexp:', e);
      }
    }
  },
};
