# WhatsApp Cloud API — setup & message templates

WhatsApp is the channel Ghanaian customers actually read, but it has one rule that
catches every bakery out:

> A business may only send **plain text** to someone who messaged it in the last
> **24 hours**. Any other update must use a **template that Meta has approved**.

Our order updates — “your cake is ready”, “your order is on the way” — almost always
fall outside that window. So the app sends an approved template by default, and only
falls back to plain text when a template send is refused. Without a template in place,
those messages would silently fail in production while the app reported nothing wrong.

Everything below takes about 20 minutes, once.

---

## 1. What you need

| Thing | Where to get it | Goes into |
|---|---|---|
| WhatsApp Business account | [business.facebook.com](https://business.facebook.com) → create a Business account | — |
| A phone number | A number **not** currently on a personal WhatsApp account. The free test number Meta gives you is fine for testing | — |
| Permanent access token | Meta Business → System users → generate token with `whatsapp_business_messaging` | `WHATSAPP_TOKEN` |
| Phone number ID | WhatsApp → API Setup → “Phone number ID” | `WHATSAPP_PHONE_NUMBER_ID` |

Add both to `server/.env`:

```env
WHATSAPP_TOKEN=EAAG...your-permanent-token
WHATSAPP_PHONE_NUMBER_ID=123456789012345
```

Restart the server. **Admin → Settings → WhatsApp templates** now shows
*Connected* instead of *Not connected*, and every WhatsApp message goes out through
the Cloud API. Leave them blank and every message is simulated in the server console —
the rest of the app behaves identically, so you can build and demo without WhatsApp.

---

## 2. Create the eight templates

Meta Business Suite → **WhatsApp Manager → Message templates → Create template**.

For each one below:

1. **Category:** `Utility` (cheaper, and approved without marketing review).
2. **Name:** exactly the name in the table — capitalisation matters to Meta (lowercase).
3. **Language:** English (`en`).
4. **Body:** copy the text exactly, `{{1}}`-style placeholders included.

| # | Template name | Body text to paste |
|---|---|---|
| 1 | `order_confirmed` | `Hi {{1}}, your Homely Treats order {{2}} is confirmed. Total GH₵ {{3}}. We'll let you know as soon as it's ready.` |
| 2 | `payment_received` | `Hi {{1}}, we have received your payment of GH₵ {{2}} for order {{3}}. Thank you!` |
| 3 | `order_being_prepared` | `Hi {{1}}, order {{2}} is now being prepared fresh in our kitchen. We'll message you when it's ready.` |
| 4 | `order_ready` | `Hi {{1}}, good news — order {{2}} is ready. {{3}}` |
| 5 | `order_out_for_delivery` | `Hi {{1}}, order {{2}} is on the way with {{3}}. Track it here: {{4}}` |
| 6 | `order_delivered` | `Hi {{1}}, order {{2}} has been delivered. We hope you enjoy it — thank you for choosing Homely Treats!` |
| 7 | `order_cancelled` | `Hi {{1}}, order {{2}} has been cancelled. If this was not expected, please call us on {{3}}.` |
| 8 | `refund_issued` | `Hi {{1}}, we have issued a refund of GH₵ {{2}} for order {{3}}. It can take a few working days to reflect, depending on your provider.` |

### What each variable means (order matters)

Reviewers ask for a sample value for every variable — use these:

| Template | `{{1}}` | `{{2}}` | `{{3}}` | `{{4}}` |
|---|---|---|---|---|
| `order_confirmed` | customer first name | order number | order total | — |
| `payment_received` | customer first name | amount paid | order number | — |
| `order_being_prepared` | customer first name | order number | — | — |
| `order_ready` | customer first name | order number | pickup/delivery instruction | — |
| `order_out_for_delivery` | customer first name | order number | rider name | tracking link |
| `order_delivered` | customer first name | order number | — | — |
| `order_cancelled` | customer first name | order number | your phone number | — |
| `refund_issued` | customer first name | refund amount | order number | — |

You don't have to create all eight on day one. The app sends a template for a status
only when one exists in the registry (`server/src/services/whatsappTemplates.js`) —
and because that registry *is* the spec, the admin UI always shows the current name,
language and variable order.

---

## 3. Prove it works before you need it

**Admin → Settings → WhatsApp templates → Send a test message.**

Type a number (`0551234567`), pick a status, press **Send test**. The panel expands to
show exactly what was sent — template name, language, the ordered variables and the
message bubble the customer sees. If Meta refuses the send, its reason is shown
verbatim (usually “template not found”, i.e. the name or language doesn't match, or the
template is still *In review*).

Reviews normally take minutes; the first can take an hour. Until it's approved, the
app logs the refusal and falls back to plain text — which still works inside the
24-hour window, so customers who just messaged you are never missed.

---

## 4. How the app behaves when something is off

| Situation | What happens |
|---|---|
| No `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Simulated: printed to the server console, recorded `SIMULATED` in the order's notification log. Nothing is sent. |
| Template approved (normal case) | Template sent; the order's notification log records `SENT … template order_ready`. |
| Template still in review, or renamed in Meta | Refusal is logged, then the app retries as plain text, which succeeds if the customer messaged recently. `SIMULATED … template order_ready refused: …` appears in the notification log. |
| Both template and plain text refused | Logged `FAILED` with Meta's message. **SMS and email still went out**, so the customer is informed either way. |
| “Send approved templates” switched off in Settings | Plain text only. Fine for testing with the Meta test number, not for production. |

You can watch all of this per order: **Admin → Orders → open an order → Notification
log**, and on the customer's tracking page.

---

## 5. Renaming a template

Meta locks a template's name and language after approval — a rename means creating a
new template. When you do, update `name` (and `language`, if you use another locale) in
`server/src/services/whatsappTemplates.js`. The admin panel, previews and the variable
order all follow that file, so there is only one place to change.
