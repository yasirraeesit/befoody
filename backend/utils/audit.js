const AuditLog = require('../models/AuditLog');

async function auditLog({ restaurantId, actorUserId, action, meta }) {
    try {
        if (!restaurantId || !actorUserId || !action) return;
        await AuditLog.create({
            restaurantId,
            actorUserId,
            action,
            meta: meta || {}
        });
    } catch {
        // never block requests on logging
    }
}

module.exports = { auditLog };

