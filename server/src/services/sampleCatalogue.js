/**
 * The sample catalogue from `src/seed.js --demo`, by exact name.
 *
 * The demo seed exists so the design can be clicked through before real products
 * exist. When the owner builds their real menu, the sample rows linger — and
 * because every one of them is flagged `featured`, they take over the homepage's
 * Featured section, which reads as "automated products" that do not belong to the
 * shop. The admin Products screen detects them by these names and offers to
 * remove them in one click (Admin → Products → "Remove sample products").
 *
 * Keep in sync with SAMPLE_PRODUCTS in seed.js if the sample menu ever changes.
 */
export const SAMPLE_PRODUCT_NAMES = [
  'Celebration Chocolate Cake',
  'Vanilla Cupcakes (Box of 6)',
  'Butter Croissants (Pack of 4)',
  'Fruit Tart Selection',
  'Macaron Gift Box',
  'Cheesecake Slice Tray',
];
