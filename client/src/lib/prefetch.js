/**
 * Warm up the next page's code while the customer is still reading the current one.
 *
 * Routes are split into separate files so the first screen is small, but that trade is
 * only worth it if the *second* screen is still instant. Nobody enjoys a spinner on the
 * way from the homepage to the menu, which is the single most likely tap on the site.
 *
 * This runs at idle, after the page the customer is actually looking at has painted, so
 * it never competes with the critical path for bandwidth. Browsers that do not support
 * requestIdleCallback fall back to a short timer, and nothing here is required for the
 * app to work — a failed prefetch is silently ignored.
 */

const LOADERS = {
  menu: () => import('../pages/Menu.jsx'),
  product: () => import('../pages/ProductDetail.jsx'),
  cart: () => import('../pages/Cart.jsx'),
  customOrder: () => import('../pages/CustomOrder.jsx'),
  track: () => import('../pages/Track.jsx'),
  account: () => import('../pages/Account.jsx'),
};

function whenIdle(fn) {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 2500 });
    return;
  }
  window.setTimeout(fn, 1200);
}

/**
 * Prefetch the routes a customer is most likely to open next.
 * @param {...string} names keys of LOADERS, e.g. prefetchRoutes('menu', 'cart')
 */
export function prefetchRoutes(...names) {
  whenIdle(() => {
    names
      .map((name) => LOADERS[name])
      .filter(Boolean)
      // Sequential, not Promise.all: on a slow connection it is better to fetch the most
      // likely page first than to split the bandwidth across four files at once.
      .reduce(
        (chain, load) => chain.then(() => load().catch(() => {})),
        Promise.resolve()
      );
  });
}
