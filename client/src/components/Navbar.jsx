import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut } from 'lucide-react';
import { useApp } from '../store.jsx';

export default function Navbar() {
  const { cartCount, user, logout } = useApp();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="logo">
          <img src="/brand.png" alt="Homely Treats" className="logo-img" />
          <span>Homely Treats</span>
        </Link>
        <ul className="nav-links">
          <li><NavLink to="/" end>Home</NavLink></li>
          <li><NavLink to="/menu">Menu</NavLink></li>
          <li><NavLink to="/custom-order">Custom Orders</NavLink></li>
          <li><NavLink to="/track">Track Order</NavLink></li>
          {user ? (
            <li><NavLink to="/account">My Account</NavLink></li>
          ) : (
            <li><NavLink to="/signin">Sign In</NavLink></li>
          )}
          {user?.role === 'ADMIN' && <li><NavLink to="/admin">Admin</NavLink></li>}
        </ul>
        <div className="nav-right">
          {user && (
            <button
              className="nav-signout"
              onClick={() => {
                logout();
                navigate('/');
              }}
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          )}
          <div className="cart-icon" onClick={() => navigate('/cart')} role="button" aria-label="Cart">
            <ShoppingCart size={24} strokeWidth={2} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </div>
        </div>
      </div>
    </nav>
  );
}
