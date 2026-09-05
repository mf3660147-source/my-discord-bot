const { EmbedBuilder } = require('discord.js');
const { hasAdminAccess } = require('../../utils/permissions');
const { NC_ACCEPT_LOG_CHANNEL_ID, NC_REJECT_LOG_CHANNEL_ID } = require('../../config/constants');

async function handleNameChangeAccept(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ Only Admins can approve applications!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const targetUserId = parts[2];
    const oldName = decodeURIComponent(parts[3]);
    const newName = decodeURIComponent(parts[4]);

    const acceptLogChannel = await interaction.guild.channels.fetch(NC_ACCEPT_LOG_CHANNEL_ID).catch(() => null);
    if (acceptLogChannel) {
        const acceptEmbed = new EmbedBuilder()
            .setTitle('✅ Name Change Approved Log')
            .setColor('#22c55e')
            .addFields(
                { name: '👤 User', value: `<@${targetUserId}>`, inline: false },
                { name: '📛 Old Name', value: `\`${oldName}\``, inline: false },
                { name: '✨ New Name', value: `\`${newName}\``, inline: false },
                { name: '🧑‍💼 Approved By', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp();

        await acceptLogChannel.send({ 
            content: `✅ Name change approved for <@${targetUserId}>`, 
            embeds: [acceptEmbed] 
        });
    }

    await interaction.update({ content: `✅ **Approved by <@${interaction.user.id}>**`, components: [] });
}

async function handleNameChangeReject(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ Only Admins can deny applications!', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const targetUserId = parts[2];
    const oldName = decodeURIComponent(parts[3]);
    const newName = decodeURIComponent(parts[4]);

    const rejectLogChannel = await interaction.guild.channels.fetch(NC_REJECT_LOG_CHANNEL_ID).catch(() => null);
    if (rejectLogChannel) {
        const rejectEmbed = new EmbedBuilder()
            .setTitle('❌ Name Change Denied Log')
            .setColor('#ef4444')
            .addFields(
                { name: '👤 User', value: `<@${targetUserId}>`, inline: false },
                { name: '📛 Old Name', value: `\`${oldName}\``, inline: false },
                { name: '✨ Requested Name', value: `\`${newName}\``, inline: false },
                { name: '🧑‍💼 Rejected By', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp();

        await rejectLogChannel.send({ 
            content: `❌ Name change denied for <@${targetUserId}>`, 
            embeds: [rejectEmbed] 
        });
    }

    await interaction.update({ content: `❌ **Denied by <@${interaction.user.id}>**`, components: [] });
}

module.exports = { handleNameChangeAccept, handleNameChangeReject };
