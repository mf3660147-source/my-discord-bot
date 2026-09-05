const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { hasAdminAccess } = require('../../utils/permissions');
const { ADMIN_ROLE_ID, FACTION_ROLE_ID, GANG_ROLE_ID, CATEGORIES } = require('../../config/constants');
const { ticketMeta } = require('../../state');

const configMap = {
    'ticket_frp': { name: 'FRP', categoryId: CATEGORIES.FRP, allowAdmin: true },
    'ticket_gang_frp': { name: 'Gang FRP', categoryId: CATEGORIES.GANG_FRP, allowAdmin: true },
    'ticket_help': { name: 'Help', categoryId: CATEGORIES.HELP, allowAdmin: true },
    'ticket_faction_app': { name: 'Faction Application', categoryId: CATEGORIES.FACTION_APP, specificRoleId: FACTION_ROLE_ID, allowAdmin: false },
    'ticket_gang_app': { name: 'Gang Application', categoryId: CATEGORIES.GANG_APP, specificRoleId: GANG_ROLE_ID, allowAdmin: false },
    'ticket_vip': { name: 'VIP', categoryId: CATEGORIES.VIP, allowAdmin: false },
    'ticket_admin_app': { name: 'Admin Application', categoryId: CATEGORIES.ADMIN_APP, allowAdmin: false }
};

module.exports = async function handleCreateTicket(interaction) {
    const selectedConfig = configMap[interaction.customId];
    if (!selectedConfig) return;

    const userIsAdmin = hasAdminAccess(interaction.member);

    try {
        if (!userIsAdmin) {
            const userTickets = Array.from(ticketMeta.values()).filter(t => t.ownerId === interaction.user.id);

            if (userTickets.length >= 2) {
                return await interaction.reply({ 
                    content: '❌ **You can only have a maximum of 2 open tickets at the same time!**', 
                    ephemeral: true 
                });
            }
        }

        const ticketNumber = Math.floor(1000 + Math.random() * 9000);
        const channelName = `ticket-${ticketNumber}`;

        const permissionOverwrites = [
            {
                id: interaction.guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
            }
        ];

        if (selectedConfig.allowAdmin && ADMIN_ROLE_ID) {
            permissionOverwrites.push({
                id: ADMIN_ROLE_ID,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
            });
        } else if (ADMIN_ROLE_ID) {
            permissionOverwrites.push({
                id: ADMIN_ROLE_ID,
                deny: [PermissionFlagsBits.ViewChannel],
            });
        }

        if (selectedConfig.specificRoleId) {
            permissionOverwrites.push({
                id: selectedConfig.specificRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
            });
        }

        const channelOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: permissionOverwrites,
        };

        if (selectedConfig.categoryId && selectedConfig.categoryId.length > 10) {
            channelOptions.parent = selectedConfig.categoryId;
        }

        const channel = await interaction.guild.channels.create(channelOptions);
        ticketMeta.set(channel.id, { ownerId: interaction.user.id, roleId: selectedConfig.specificRoleId || null, claimedBy: null });

        const ticketEmbed = new EmbedBuilder()
            .setColor('#E6A100')
            .setTitle(`✨ Ticket #${ticketNumber}`)
            .setDescription(`🏷️ **Category:** \`${selectedConfig.name}\`\n👤 **Owner:** <@${interaction.user.id}>\n🛠️ **Status:** \`Not Claimed\`\n\n-------------------------\n📨 **Please state your issue clearly.**\n-------------------------`)
            .setFooter({ text: 'ONE PEACE ROLEPLAY Support Team' })
            .setTimestamp();

        const controlButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim / Unclaim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('add_user_ticket').setLabel('Add User').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('remove_user_ticket').setLabel('Remove User').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rename_ticket').setLabel('Rename').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        let tagContent = `<@${interaction.user.id}> <@&${ADMIN_ROLE_ID}>`;
        if (selectedConfig.specificRoleId) {
            tagContent += ` <@&${selectedConfig.specificRoleId}>`;
        }

        await channel.send({
            content: tagContent,
            embeds: [ticketEmbed],
            components: [controlButtons]
        });

        await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
    } catch (err) {
        console.error('Ticket Creation Error:', err);
        await interaction.reply({ content: 'Error creating ticket.', ephemeral: true });
    }
};
