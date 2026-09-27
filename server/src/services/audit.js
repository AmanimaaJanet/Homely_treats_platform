import { prisma } from '../prisma.js';

/**
 * Append-only audit trail for privileged actions.
 *
 * Never throws: an audit failure must not break the action the admin took, but
 * it is logged loudly to the server console so it can be spotted.
 */
export async function audit(req, { action, entity = null, entityId = null, detail = null }) {
  // `req` may be null for system actions (a background job, a restock notification).
  const actor = req?.user || null;
  const ip = req?.ip || null;
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorEmail: actor?.email || null,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        detail: detail ? String(detail).slice(0, 500) : null,
        ip,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', action, err.message);
  }
}
