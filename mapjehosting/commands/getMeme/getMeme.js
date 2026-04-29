const axios = require('axios');
const { SlashCommandBuilder } = require('discord.js');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('meme')
		.setDescription('Sends a random meme'),
	async execute(interaction) {
        try {
            const res = await axios.get('https://api.popcat.xyz/meme', { timeout: 8000 });
            const imageUrl = res.data?.content?.image || res.data?.url || res.data?.image;

            if (!imageUrl) {
                await interaction.reply('No meme found :(');
                return;
            }

            await interaction.reply(imageUrl);
        } catch (error) {
            console.error('Failed to fetch meme:', error.message);
            await interaction.reply('Ik kon op dit moment geen meme ophalen. Probeer het zo nog eens.');
        }
	},
};