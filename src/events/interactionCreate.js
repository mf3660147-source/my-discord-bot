const { hasAdminAccess } = require('../utils/permissions');

// Handlers
const { handleAddUserSelect, handleRemoveUserSelect, handleAddUserButton, handleRemoveUserButton } = require('../handlers/tickets/addRemoveUser');
const { handleRenameModal, handleRenameButton } = require('../handlers/tickets/renameTicket');
const { handleNameChangeModalSubmit, handleNameChangeApplyButton } = require('../handlers/nameChange/applyModal');
const { handleNameChangeAccept, handleNameChangeReject } = require('../handlers/nameChange/reviewAction');
const handleAttendanceLeaderboard = require('../commands/slash/attendanceLeaderboard');
const handleMarkAttendance = require('../handlers/attendance/markAttendance');
const handleCreateTicket = require('../handlers/tickets/createTicket');
const { handleClaimTicket } = require('../handlers/tickets/claimTicket');
const handleCloseTicket = require('../handlers/tickets/closeTicket');

module.exports = function (client) {
    client.on('interactionCreate', async (interaction) => {

        // --- 1. USER SELECT MENU HANDLERS ---
        if (interaction.isUserSelectMenu()) {
            if (interaction.customId === 'add_user_select') {
                return await handleAddUserSelect(interaction);
            }
            if (interaction.customId === 'remove_user_select') {
                return await handleRemoveUserSelect(interaction);
            }
        }

        // --- 2. MODAL SUBMIT HANDLERS ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'rename_ticket_modal') {
                return await handleRenameModal(interaction);
            }
            if (interaction.customId === 'nc_modal_submit') {
                return await handleNameChangeModalSubmit(interaction);
            }
        }

        // --- 3. SLASH COMMAND HANDLER ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'attendance-leaderboard') {
            return await handleAttendanceLeaderboard(interaction);
        }

        if (!interaction.isButton()) return;

        // --- 4. NAME CHANGE BUTTON CLICK HANDLERS ---
        if (interaction.customId === 'nc_apply_btn') {
            return await handleNameChangeApplyButton(interaction);
        }

        if (interaction.customId.startsWith('nc_accept_')) {
            return await handleNameChangeAccept(interaction);
        }

        if (interaction.customId.startsWith('nc_reject_')) {
            return await handleNameChangeReject(interaction);
        }

        // --- 5. ATTENDANCE BUTTON CLICK HANDLER ---
        if (interaction.customId === 'mark_attendance_btn') {
            return await handleMarkAttendance(interaction);
        }

        // --- 6. TICKET SYSTEM HANDLERS ---
        if (interaction.customId === 'claim_ticket') {
            return await handleClaimTicket(interaction);
        }

        if (interaction.customId === 'add_user_ticket') {
            return await handleAddUserButton(interaction);
        }

        if (interaction.customId === 'remove_user_ticket') {
            return await handleRemoveUserButton(interaction);
        }

        if (interaction.customId === 'rename_ticket') {
            return await handleRenameButton(interaction);
        }

        if (interaction.customId === 'close_ticket') {
            return await handleCloseTicket(interaction, client);
        }

        // Ticket creation buttons
        const ticketButtons = ['ticket_frp', 'ticket_gang_frp', 'ticket_help', 'ticket_faction_app', 'ticket_gang_app', 'ticket_vip', 'ticket_admin_app'];
        if (ticketButtons.includes(interaction.customId)) {
            return await handleCreateTicket(interaction);
        }
    });
};
