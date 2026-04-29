import React from 'react';

export default function KhaltiPayment({ amount, onSuccess }) {
  const handlePayment = () => {
    // Simulate Khalti ePayment gateway redirect
    alert(`Redirecting to Khalti for Rs. ${amount}...`);
    setTimeout(() => {
      alert("Payment Successful (Test Mock)");
      if(onSuccess) onSuccess();
    }, 1500);
  }

  return (
    <button onClick={handlePayment} style={{
      background: '#5C2D91', 
      color: 'white', 
      border: 'none', 
      padding: '0.4rem 0.8rem', 
      borderRadius: '8px', 
      fontWeight: '600', 
      cursor: 'pointer',
      width: '100%',
      fontFamily: 'inherit',
      fontSize: '0.9rem'
    }}>
      Pay with Khalti (Rs. {amount})
    </button>
  )
}
