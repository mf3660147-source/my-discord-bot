const { ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const { hasAdminAccess } = require('../../utils/permissions');
const { ticketMeta } = require('../../state');

// --- User Select Menu: Add User ---
async function handleAddUserSelect(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ Only Admins can use this feature!', ephemeral: true });
    }

    const targetUserId = interaction.values[0];
    try {
        await interaction.channel.permissionOverwrites.edit(targetUserId, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true,
            ReadMessageHistory: true
        });

        await interaction.reply({ content: `✅ Successfully added <@${targetUserId}> to this ticket!` });
    } catch (err) {
        console.error('Add User Error:', err);
        await interaction.reply({ content: '❌ Failed to add user. Check bot permissions.', ephemeral: true });
    }
}

// --- User Select Menu: Remove User ---
async function handleRemoveUserSelect(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ Only Admins can use this feature!', ephemeral: true });
    }

    const targetUserId = interaction.values[0];
    const meta = ticketMeta.get(interaction.channel.id);

    if (meta && meta.ownerId === targetUserId) {
        return await interaction.reply({ content: '❌ You cannot remove the ticket owner/creator!', ephemeral: true });
    }

    try {
        await interaction.channel.permissionOverwrites.delete(targetUserId);
        await interaction.reply({ content: `🚫 Successfully removed <@${targetUserId}> from this ticket!` });
    } catch (err) {
        console.error('Remove User Error:', err);
        await interaction.reply({ content: '❌ Failed to remove user.', ephemeral: true });
    }
}

// --- Button: Show Add User Select Menu ---
async function handleAddUserButton(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ **Only Admins can add users to tickets!**', ephemeral: true });
    }

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('add_user_select')
        .setPlaceholder('Select or Search a member to ADD...')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await interaction.reply({
        content: '🔍 Search and select the user you want to add:',
        components: [row],
        ephemeral: true
    });
}

// --- Button: Show Remove User Select Menu ---
async function handleRemoveUserButton(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ **Only Admins can remove users from tickets!**', ephemeral: true });
    }

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('remove_user_select')
        .setPlaceholder('Select or Search a member to REMOVE...')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await interaction.reply({
        content: '🔍 Search and select the user you want to remove:',
        components: [row],
        ephemeral: true
    });
}

module.exports = { handleAddUserSelect, handleRemoveUserSelect, handleAddUserButton, handleRemoveUserButton };
