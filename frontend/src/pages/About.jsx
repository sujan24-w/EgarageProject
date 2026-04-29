import React from 'react';
import { Shield, Wrench, Clock, MapPin } from 'lucide-react';
import './About.css';

export default function About() {
  return (
    <div className="animate-fade-in about-container">
      <div className="about-header">
        <h1 className="about-title">
          About <span className="about-title-highlight">E-Garage</span>
        </h1>
        <p className="about-subtitle">
          We are dedicated to revolutionizing the two-wheeler repair industry by bridging the gap between stranded riders and professional local mechanics through precise GPS tracking and secure dispatch mapping.
        </p>
      </div>

      <div className="about-features-grid">
         <div className="glass-panel about-feature-card">
            <Shield size={40} color="var(--accent-primary)" className="about-feature-icon" />
            <h3 className="about-feature-title">Verified Network</h3>
            <p className="about-feature-text">Every garage and mechanic in our global ecosystem is rigidly screened and professionally verified.</p>
         </div>
         <div className="glass-panel about-feature-card">
            <MapPin size={40} color="var(--accent-primary)" className="about-feature-icon" />
            <h3 className="about-feature-title">Precision Dispatch</h3>
            <p className="about-feature-text">Direct GPS linkage maps your exact stranded coordinate to the closest available rescue unit instantly.</p>
         </div>
         <div className="glass-panel about-feature-card">
            <Clock size={40} color="var(--accent-primary)" className="about-feature-icon" />
            <h3 className="about-feature-title">24/7 Availability</h3>
            <p className="about-feature-text">Emergency situations never wait. We connect you to garages utilizing round-the-clock dispatch mechanics.</p>
         </div>
      </div>

      <div className="glass-panel about-mission-section">
         <h2>Our Mission</h2>
         <p className="about-mission-text">
           Building a seamless, robust platform ensuring no rider is ever left stranded on a lonely road. We strive for total operational transparency, instant emergency routing, and guaranteed fair-billing utilizing modern cloud infrastructure and verified partners across the entire country.
         </p>
      </div>
    </div>
  );
}
