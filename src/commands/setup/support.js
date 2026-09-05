const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BANNER_IMAGE } = require('../../config/constants');

module.exports = async function setupSupport(message) {
    const embed = new EmbedBuilder()
        .setTitle('🛡️ ONE PEACE ROLEPLAY - Support Desk')
        .setDescription('Click on the buttons below to open a ticket for general help or FRP reports.')
        .setImage(BANNER_IMAGE)
        .setColor('#3b82f6');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_frp').setLabel('FRP Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_gang_frp').setLabel('Gang FRP Ticket').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_help').setLabel('Help Support').setStyle(ButtonStyle.Success)
    );
    await message.channel.send({ embeds: [embed], components: [buttons] });
};
