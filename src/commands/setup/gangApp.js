const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BANNER_IMAGE } = require('../../config/constants');

module.exports = async function setupGangApp(message) {
    const embed = new EmbedBuilder()
        .setTitle('💀 Gang Application')
        .setDescription('Click the button below to register your gang.')
        .setImage(BANNER_IMAGE)
        .setColor('#10b981');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_gang_app').setLabel('Gang Application').setStyle(ButtonStyle.Success)
    );
    await message.channel.send({ embeds: [embed], components: [buttons] });
};
