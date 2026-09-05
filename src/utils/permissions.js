const { PermissionFlagsBits } = require('discord.js');
const { ADMIN_ROLE_ID } = require('../config/constants');

// അഡ്മിൻ പെർമിഷനോ അഡ്മിൻ റോളോ ഉണ്ടോ എന്ന് പരിശോധിക്കുന്ന ഫംഗ്ഷൻ
function hasAdminAccess(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(ADMIN_ROLE_ID);
}

module.exports = { hasAdminAccess };
