const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { hasAdminAccess } = require('../../utils/permissions');

// --- Button: Show Rename Modal ---
async function handleRenameButton(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ **Only Admins can rename tickets!**', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('rename_ticket_modal').setTitle('Rename Ticket');
    const nameInput = new TextInputBuilder()
        .setCustomId('new_ticket_name')
        .setLabel('Enter new channel name')
        .setStyle(TextInputStyle.Short)
        .setValue(interaction.channel.name)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    await interaction.showModal(modal);
}

// --- Modal Submit: Process Rename ---
async function handleRenameModal(interaction) {
    if (!hasAdminAccess(interaction.member)) {
        return await interaction.reply({ content: '❌ Only Admins can rename tickets!', ephemeral: true });
    }

    const newName = interaction.fields.getTextInputValue('new_ticket_name');
    try {
        await interaction.channel.setName(newName);
        await interaction.reply({ content: `✅ Ticket renamed to **${newName}**!`, ephemeral: true });
    } catch (err) {
        console.error('Rename Error:', err);
        await interaction.reply({ content: '❌ Failed to rename channel. Check bot permissions.', ephemeral: true });
    }
}

module.exports = { handleRenameButton, handleRenameModal };
