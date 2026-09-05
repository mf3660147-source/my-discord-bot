const { hasAdminAccess } = require('../../utils/permissions');
const { ADMIN_ROLE_ID } = require('../../config/constants');
const { ticketMeta } = require('../../state');

// --- Combined Claim / Unclaim Toggle ---
async function handleClaimTicket(interaction) {
    const userIsAdmin = hasAdminAccess(interaction.member);
    if (!userIsAdmin) return await interaction.reply({ content: '❌ **Only Admins can claim/unclaim tickets!**', ephemeral: true });

    const meta = ticketMeta.get(interaction.channel.id) || {};

    // If already claimed → unclaim
    if (meta.claimedBy) {
        // Only the claimer or another admin can unclaim
        try {
            await interaction.channel.permissionOverwrites.edit(ADMIN_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
                AttachFiles: true,
                ReadMessageHistory: true
            });

            meta.claimedBy = null;
            ticketMeta.set(interaction.channel.id, meta);

            await interaction.reply({ content: `⚠️ Ticket unclaimed!` });
        } catch (err) {
            console.error('Unclaim Error:', err);
            await interaction.reply({ content: '❌ Failed to unclaim ticket.', ephemeral: true });
        }
        return;
    }

    // Not claimed → claim it
    try {
        await interaction.channel.permissionOverwrites.edit(ADMIN_ROLE_ID, { ViewChannel: false });
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            ReadMessageHistory: true
        });

        meta.claimedBy = interaction.user.id;
        ticketMeta.set(interaction.channel.id, meta);

        await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>!` });
    } catch (err) {
        console.error('Claim Error:', err);
        await interaction.reply({ content: '❌ Failed to claim ticket. Check bot permissions.', ephemeral: true });
    }
}

module.exports = { handleClaimTicket };
