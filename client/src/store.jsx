import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { api, setToken, getToken } from './api.js';

const AppContext = createContext(null);

// --------------------------- Reducers -------------------------------------
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const items = [...state.items];
      const idx = items.findIndex((i) => i.key === action.item.key);
      if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + action.item.quantity };
      else items.push(action.item);
      return { ...state, items };
    }
    case 'SET_QTY': {
      const items = state.items
        .map((i) => (i.key === action.key ? { ...i, quantity: Math.max(1, action.quantity) } : i))
        .filter((i) => i.quantity > 0);
      return { ...state, items };
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.key !== action.key) };
    case 'CLEAR':
      return { ...state, items: [] };
    case 'SET_CHECKOUT':
      return { ...state, checkout: { ...state.checkout, ...action.patch } };
    default:
      return state;
  }
}

function cartInit() {
  try {
    const saved = JSON.parse(localStorage.getItem('ht_cart') || '{}');
    return { items: saved.items || [], checkout: saved.checkout || {} };
  } catch {
    return { items: [], checkout: {} };
  }
}

// --------------------------- Provider --------------------------------------
export function AppProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [cart, dispatch] = useReducer(cartReducer, undefined, cartInit);
  const [toasts, setToasts] = React.useState([]);

  // Persist cart
  useEffect(() => {
    localStorage.setItem('ht_cart', JSON.stringify(cart));
  }, [cart]);

  // Restore session on load
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api.get('/auth/me', { auth: true });
          setUser(user);
        } catch {
          setToken(null);
        }
      }
      setAuthReady(true);
    })();
  }, []);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
    dispatch({ type: 'CLEAR' });
  };

  const toast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const addToCart = (item) => {
    dispatch({ type: 'ADD', item });
    toast('Added to cart', 'success');
  };

  const cartCount = useMemo(() => cart.items.reduce((s, i) => s + i.quantity, 0), [cart.items]);
  const subtotal = useMemo(
    () => cart.items.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart.items]
  );

  const value = {
    user,
    setUser,
    authReady,
    login,
    logout,
    cart: cart.items,
    checkout: cart.checkout,
    setCheckout: (patch) => dispatch({ type: 'SET_CHECKOUT', patch }),
    addToCart,
    setQty: (key, quantity) => dispatch({ type: 'SET_QTY', key, quantity }),
    removeFromCart: (key) => dispatch({ type: 'REMOVE', key }),
    clearCart: () => dispatch({ type: 'CLEAR' }),
    cartCount,
    subtotal,
    toast,
    toasts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
