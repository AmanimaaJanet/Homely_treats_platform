import { prisma } from '../prisma.js';

/**
 * Append-only audit trail for privileged actions.
 *
 * Never throws: an audit failure must not break the action the admin took, but
 * it is logged loudly to the server console so it can be spotted.
 */
export async function audit(req, { action, entity = null, entityId = null, detail = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || null,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        detail: detail ? String(detail).slice(0, 500) : null,
        ip: req.ip || null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', action, err.message);
  }
}
