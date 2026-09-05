const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BANNER_IMAGE } = require('../../config/constants');

module.exports = async function setupNameChange(message) {
    const embed = new EmbedBuilder()
        .setTitle('📝 Name Change Portal')
        .setDescription('Welcome to the official **ONE PEACE ROLEPLAY** name change system.\n\nSubmit your request below and wait for management approval.\n\n-------------------------\n\n✍️ **Name Format**\n```\n✅ Firstname_Lastname\n✅ Example: Oggy_Ftw\n```\n-------------------------\n\n📊 **Status**\n🟢 System: **Online**\n🧑‍💼 Managed by: **OPRP Staff**\n📅 Review Time: **Within 24 Hours**')
        .setImage(BANNER_IMAGE)
        .setColor('#ef4444')
        .setFooter({ text: 'ONE PEACE ROLEPLAY • Name Change Department' })
        .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('nc_apply_btn')
            .setLabel('Apply for Name Change')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [button] });
    await message.delete().catch(() => {});
};
