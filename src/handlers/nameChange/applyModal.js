const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { NC_REVIEW_CHANNEL_ID } = require('../../config/constants');

// --- Button: Show Name Change Application Modal ---
async function handleNameChangeApplyButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('nc_modal_submit')
        .setTitle('📝 Name Change Application');

    const newNameInput = new TextInputBuilder()
        .setCustomId('nc_new_name')
        .setLabel('New Name (Firstname_Lastname)')
        .setPlaceholder('e.g. Oggy_Ftw')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const currentNameInput = new TextInputBuilder()
        .setCustomId('nc_current_name')
        .setLabel('Current In-Game Name')
        .setPlaceholder('e.g. Itz_Thor')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const levelInput = new TextInputBuilder()
        .setCustomId('nc_level')
        .setLabel('In-Game Level')
        .setPlaceholder('e.g. Level 3')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId('nc_reason')
        .setLabel('Reason for Name Change')
        .setPlaceholder('Explain why you want to change your RP name...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(newNameInput),
        new ActionRowBuilder().addComponents(currentNameInput),
        new ActionRowBuilder().addComponents(levelInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    return await interaction.showModal(modal);
}

// --- Modal Submit: Process Name Change Application ---
async function handleNameChangeModalSubmit(interaction) {
    const newName = interaction.fields.getTextInputValue('nc_new_name');
    const currentName = interaction.fields.getTextInputValue('nc_current_name');
    const level = interaction.fields.getTextInputValue('nc_level');
    const reason = interaction.fields.getTextInputValue('nc_reason');

    await interaction.reply({ content: '✅ Your Name Change Application has been submitted for staff review!', ephemeral: true });

    const reviewChannel = await interaction.guild.channels.fetch(NC_REVIEW_CHANNEL_ID).catch(() => null);
    if (reviewChannel) {
        const reviewEmbed = new EmbedBuilder()
            .setTitle('📝 New Name Change Application')
            .setColor('#f59e0b')
            .addFields(
                { name: '👤 User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
                { name: '📛 Current In-Game Name', value: `\`${currentName}\``, inline: true },
                { name: '✨ Requested New Name', value: `\`${newName}\``, inline: true },
                { name: '📊 In-Game Level', value: `\`${level}\``, inline: true },
                { name: '📝 Reason', value: reason, inline: false }
            )
            .setFooter({ text: 'ONE PEACE ROLEPLAY • NC Review System' })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`nc_accept_${interaction.user.id}_${encodeURIComponent(currentName)}_${encodeURIComponent(newName)}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`nc_reject_${interaction.user.id}_${encodeURIComponent(currentName)}_${encodeURIComponent(newName)}`)
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger)
        );

        await reviewChannel.send({ embeds: [reviewEmbed], components: [buttons] });
    }
}

module.exports = { handleNameChangeApplyButton, handleNameChangeModalSubmit };
