import { Router } from 'express';
import { getSettings } from '../services/settings.js';

const router = Router();

// GET /api/settings/public — non-sensitive settings the storefront needs
router.get('/public', async (req, res) => {
  try {
    const s = await getSettings();
    res.json({
      settings: {
        businessName: s.businessName,
        businessAddress: s.businessAddress,
        businessPhone: s.businessPhone,
        businessEmail: s.businessEmail,
        deliveryFee: s.deliveryFee,
        minLeadDays: s.minLeadDays,
        allowPickup: s.allowPickup,
        acceptOrders: s.acceptOrders,
        enableMomo: s.enableMomo,
        enableAtl: s.enableAtl,
        enableCard: s.enableCard,
        enableCod: s.enableCod,
        enableLoyalty: s.enableLoyalty,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

export default router;
