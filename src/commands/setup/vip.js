const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BANNER_IMAGE } = require('../../config/constants');

module.exports = async function setupVip(message) {
    const embed = new EmbedBuilder()
        .setTitle('👑 VIP & Donation Ticket')
        .setDescription('Click the button below regarding VIP perks, vehicles, or donations.')
        .setImage(BANNER_IMAGE)
        .setColor('#ef4444');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_vip').setLabel('VIP Ticket').setStyle(ButtonStyle.Danger)
    );
    await message.channel.send({ embeds: [embed], components: [buttons] });
};
