import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import './Contact.css';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Message sent to E-Garage headquarters globally! We will respond shortly.");
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="animate-fade-in contact-container">
      <div className="contact-header">
        <h1 className="contact-title">
          Contact <span className="contact-title-highlight">Us</span>
        </h1>
        <p className="contact-subtitle">
          Have a question about onboarding your garage, a payment error, or just want to suggest a feature? Reach out to our emergency support center anytime.
        </p>
      </div>

      <div className="contact-grid">
        {/* Left Info Column */}
        <div className="contact-info-column">
           <div className="glass-panel contact-info-card">
             <h3 className="contact-info-title">Global Headquarters</h3>
             
             <div className="contact-info-row">
                <div className="contact-icon-wrapper">
                  <MapPin color="var(--accent-primary)" size={24} />
                </div>
                <div>
                   <strong className="contact-info-label">Corporate Office</strong>
                   <span className="contact-info-value">Kathmandu Innovation Hub, Nepal</span>
                </div>
             </div>

             <div className="contact-info-row">
                <div className="contact-icon-wrapper">
                  <Phone color="var(--accent-primary)" size={24} />
                </div>
                <div>
                   <strong className="contact-info-label">Hotline / Emergency Support</strong>
                   <span className="contact-info-value">+977 1-4XXXXXX (24/7 Support)</span>
                </div>
             </div>

             <div className="contact-info-row" style={{marginBottom: 0}}>
                <div className="contact-icon-wrapper">
                  <Mail color="var(--accent-primary)" size={24} />
                </div>
                <div>
                   <strong className="contact-info-label">Email Support</strong>
                   <span className="contact-info-value">admin@e-garage.com</span>
                </div>
             </div>
           </div>
        </div>

        {/* Right Form Column */}
        <div className="glass-panel contact-form-card">
          <h2 className="contact-form-title">Send a Ticket</h2>
          <form onSubmit={handleSubmit} className="contact-form">
            <div>
              <label className="contact-form-label">Full Name <span style={{color: 'red'}}>*</span></label>
              <input type="text" required className="input-field contact-form-input" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="contact-form-label">Email Address <span style={{color: 'red'}}>*</span></label>
              <input type="email" required className="input-field contact-form-input" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="contact-form-label">Support Message <span style={{color: 'red'}}>*</span></label>
              <textarea required className="input-field contact-form-textarea" placeholder="Describe the issue you're facing or your inquiry..." rows="6" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
            </div>
            <button type="submit" className="btn-primary contact-submit-btn">
               <Send size={20} />
               Submit Ticket Request
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
