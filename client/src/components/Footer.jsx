import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cake, Mail, Phone, MapPin } from 'lucide-react';
import { api } from '../api.js';

const DEFAULTS = {
  businessName: 'Homely Treats',
  businessEmail: 'orders@homelytreats.gh',
  businessPhone: '055 123 4567',
  businessAddress: 'Airport Residential, Accra',
};

export default function Footer() {
  const [info, setInfo] = useState(DEFAULTS);

  useEffect(() => {
    api.get('/settings/public').then((d) => setInfo({ ...DEFAULTS, ...d.settings })).catch(() => {});
  }, []);

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-brand">
            <Cake size={18} /> {info.businessName}
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
            <li><Mail size={14} /> {info.businessEmail}</li>
            <li><Phone size={14} /> {info.businessPhone}</li>
            <li><MapPin size={14} /> {info.businessAddress}</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} {info.businessName} Service Limited</p>
        <p className="footer-note">MTN MoMo · AirtelTigo · Visa/Mastercard · Secured by Paystack</p>
      </div>
    </footer>
  );
}
