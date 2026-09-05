const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BANNER_IMAGE } = require('../../config/constants');

module.exports = async function setupFaction(message) {
    const embed = new EmbedBuilder()
        .setTitle('📋 Faction Application')
        .setDescription('Click the button below to submit your Faction Application.')
        .setImage(BANNER_IMAGE)
        .setColor('#8b5cf6');

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_faction_app').setLabel('Faction Application').setStyle(ButtonStyle.Primary)
    );
    await message.channel.send({ embeds: [embed], components: [buttons] });
};
