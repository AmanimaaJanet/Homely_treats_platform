import React from 'react';
import { Link } from 'react-router-dom';
import { Cake, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-brand">
            <Cake size={18} /> Homely Treats
          </h3>
          <p>Accra's premier custom bakery. Every order made fresh, just for you.</p>
        </div>
        <div className="footer-section">
          <h3>Shop</h3>
          <ul>
            <li><Link to="/menu">Custom Cakes</Link></li>
            <li><Link to="/menu">Cupcakes</Link></li>
            <li><Link to="/menu">Pastries</Link></li>
          </ul>
        </div>
        <div className="footer-section">
          <h3>Account</h3>
          <ul>
            <li><Link to="/account">My Orders</Link></li>
            <li><Link to="/track">Track Order</Link></li>
            <li><Link to="/signin">Sign In</Link></li>
          </ul>
        </div>
        <div className="footer-section">
          <h3>Contact</h3>
          <ul className="contact-list">
            <li><Mail size={14} /> orders@homelytreats.gh</li>
            <li><Phone size={14} /> 055 123 4567</li>
            <li><MapPin size={14} /> Airport Residential, Accra</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 Homely Treats Service Limited</p>
        <p className="footer-note">MTN MoMo · AirtelTigo · Visa/Mastercard · Secured by Paystack</p>
      </div>
    </footer>
  );
}
