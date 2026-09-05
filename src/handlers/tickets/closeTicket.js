const { EmbedBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const { hasAdminAccess } = require('../../utils/permissions');
const { LOG_CHANNEL_ID } = require('../../config/constants');
const { ticketMeta, totalClosedTickets } = require('../../state');

module.exports = async function handleCloseTicket(interaction, client) {
    const userIsAdmin = hasAdminAccess(interaction.member);
    if (!userIsAdmin) {
        return await interaction.reply({ 
            content: '❌ **Only Admins can close this ticket.**', 
            ephemeral: true 
        });
    }

    await interaction.reply('🔒 Generating transcript and closing ticket in 5 seconds...');

    try {
        let ticketOwner = 'Unknown';
        const metaData = ticketMeta.get(interaction.channel.id);
        if (metaData) {
            ticketOwner = `<@${metaData.ownerId}>`;
        } else {
            const nonStaffPermissions = interaction.channel.permissionOverwrites.cache.find(
                p => p.type === 1 && p.id !== client.user.id && p.id !== interaction.guild.roles.everyone.id
            );
            if (nonStaffPermissions) ticketOwner = `<@${nonStaffPermissions.id}>`;
        }

        const categoryName = interaction.channel.parent ? interaction.channel.parent.name : 'General';
        totalClosedTickets.count += 1;

        const attachment = await discordTranscripts.createTranscript(interaction.channel, {
            limit: -1,
            returnType: 'attachment',
            filename: `${interaction.channel.name}-transcript.html`,
            saveImages: true,
            poweredBy: false
        });

        const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const closeEmbed = new EmbedBuilder()
                .setTitle('📜 Ticket Closed & Transcripts Logged')
                .setColor('#ef4444')
                .addFields(
                    { name: '👤 Ticket Owner', value: ticketOwner, inline: true },
                    { name: '🔢 Ticket No.', value: `#${interaction.channel.name.replace('ticket-', '')}`, inline: true },
                    { name: '🏷️ Category', value: categoryName, inline: true },
                    { name: '🔒 Closed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📊 Total Closed Tickets', value: `${totalClosedTickets.count}`, inline: true }
                )
                .setFooter({ text: 'ONE PEACE ROLEPLAY Support Logs' })
                .setTimestamp();

            await logChannel.send({
                embeds: [closeEmbed],
                files: [attachment]
            });
        }
    } catch (err) {
        console.error('Transcript Log Error:', err);
    }

    ticketMeta.delete(interaction.channel.id);
    setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
};
