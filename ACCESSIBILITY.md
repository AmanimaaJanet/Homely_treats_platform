# Accessibility

The target is **WCAG 2.1 level AA**. This page records what was audited, what was found,
what changed, and how to check it again — so the next person does not have to redo the
audit to know where the app stands.

An audit done by reading code is only half an audit, so the findings below came from
measuring (contrast ratios computed from the actual palette, every field checked for an
accessible name, every clickable element checked for keyboard reach) rather than from
impressions.

---

## 1. What was wrong, and what changed

### Colour contrast — the brand orange failed AA

Measured against the app's own palette:

| Pair | Before | After | AA needs |
|---|---|---|---|
| Brand orange on cream (`#C4763B`) | **3.32:1** ❌ | — | 4.5:1 |
| White on the brand orange button | **3.50:1** ❌ | — | 4.5:1 |
| New text/button colour on cream (`#A65C24`) | — | **4.76:1** ✅ | 4.5:1 |
| New text/button colour on white | — | **5.03:1** ✅ | 4.5:1 |
| Body text on cream (`#2C1A0E`) | 15.8:1 ✅ | unchanged | 4.5:1 |
| Muted text on cream (`#7A5C44`) | 5.78:1 ✅ | unchanged | 4.5:1 |
| Order-status badges (green/amber/blue/red) | 6.4–7.2:1 ✅ | unchanged | 4.5:1 |
| White on the dark sidebar | 19.9:1 ✅ | unchanged | 4.5:1 |

The orange is the bakery's identity, so it was not thrown away: `--primary` stays for
borders, fills and display-size headings (where AA asks only 3:1 and it passes), and a
new `--primary-ink` (`#A65C24`) — the same hue, darkened just past the threshold — carries
text, links and every solid button. Visually the two are close enough to read as one
palette; the difference is legibility on a phone in daylight.

### 104 of 113 form fields had no accessible name

The label was *next to* the input, not attached to it: `<label>Email Address</label>` then
`<input>`. It looks correct and is announced as "edit text, blank" — the single most
common way a site is unusable with a screen reader while looking perfectly fine.

Every field is now wrapped in its own label (`<label><span class="form-label-text">Email
Address</span><input …></label>`), which associates the two without needing an `id` per
field — important because several of these forms repeat inside lists, where generated ids
would collide. The visible text moved into a span so the label's small-caps styling cannot
leak into what the customer types (an input inheriting `text-transform: uppercase` is a
real, easy-to-miss bug). **Now 109 of 109 fields have an accessible name**, including
search boxes and admin inline forms where the placeholder used to be the only clue.
`client/src/a11y.test.jsx` fails if a label stops being attached.

### Controls only a mouse could press

15 clickable `<div>`s — the cart icon, product cards, the account menu, the delivery and
payment choices, photo tiles. None could be reached with Tab or pressed with Enter.

- The cart icon is now a real `<button>` that also announces the item count.
- Product names are real links (so they can be opened in a new tab, like any link).
- The delivery and payment choices are buttons carrying `aria-pressed`, and the account
  menu items are buttons inside their list items with `aria-current` on the active tab.
- Where an element genuinely has to stay a `<div>` (a tile containing its own buttons),
  `lib/a11y.js` adds the three missing pieces — role, tab stop, Enter/Space handling.

### Motion, focus and announcements

- **Visible focus**: `:focus-visible` draws a 3px outline on every control, in gold on the
  dark sidebar where orange would vanish.
- **Skip link**: the first thing a keyboard user meets is "Skip to main content".
- **Live regions**: toasts were silent to screen readers — appearing and vanishing before
  they could be read. The toast area is now `role="status" aria-live="polite"`, and errors
  are `role="alert"`.
- **Dialogs**: the three modals carry `role="dialog"`, `aria-modal`, a heading they are
  labelled by, receive focus when they open, and close on **Escape**.
- **Reduced motion**: the hero video is replaced by its poster, and the loading shimmer
  stops, when the visitor prefers reduced motion.
- **Tables**: all 30 header cells carry `scope="col"`.
- **Loading**: page skeletons announce themselves (`role="status"`, plus screen-reader
  text) instead of silently appearing.

---

## 2. How to check it again

```bash
cd client
npm run test        # includes a11y.test.jsx: labels, keyboard, live regions, skip link
npm run lint        # eslint-plugin-react-hooks catches some interaction bugs
```

Contrast, if the palette changes — recompute, do not eyeball:

```bash
python3 - <<'PY'
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    l1,l2=lum(a),lum(b); hi,lo=max(l1,l2),min(l1,l2); return (hi+0.05)/(lo+0.05)
print(ratio('#A65C24', '#FDF8F3'))   # needs >= 4.5 for body text
PY
```

With a keyboard only (no mouse), on every page: Tab through and check the focus ring is
always visible, Enter/Space activates what is focused, Escape closes a dialog, and you can
reach and use the whole checkout without ever touching the mouse.

With a screen reader (VoiceOver on macOS, Narrator on Windows, TalkBack on Android): fill
in the sign-in, register and checkout forms and confirm each field is announced with its
name.

---

## 3. Deliberately not included

Honest scope, not an oversight:

- **A formal accessibility statement page.** Needs a business contact and a commitment
  from the owner, not something to invent in code.
- **Full screen-reader testing on a physical device.** Automated checks and jsdom tests
  cover structure; they cannot hear the result. A pass with a real screen reader on the
  checkout is the remaining gap, and it is worth doing before a public launch.
- **Text spacing / zoom testing beyond the browser default.** The layout is mobile-first
  and fluid, but 400% zoom on the admin tables has not been verified on a real display.
- **Colour-blind simulation.** Status is never conveyed by colour alone (badges carry
  words, the active tab carries `aria-current`), but this has not been verified with a
  simulator.
