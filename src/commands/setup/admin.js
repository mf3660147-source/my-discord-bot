const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BANNER_IMAGE } = require('../../config/constants');

module.exports = async function setupAdmin(message) {
    const embed = new EmbedBuilder()
        .setTitle('👑 Admin Application')
        .setDescription('Click the button below to submit your Admin Application.')
        .setImage(BANNER_IMAGE)
        .setColor('#6366f1');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_admin_app').setLabel('Admin Application').setStyle(ButtonStyle.Primary)
    );
    await message.channel.send({ embeds: [embed], components: [buttons] });
};
