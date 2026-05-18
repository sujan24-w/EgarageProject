import { useState, useEffect } from 'react';
import NepaliDate from 'nepali-date-converter';
import Calendar from '@sbmdkl/nepali-datepicker-reactjs';
import '@sbmdkl/nepali-datepicker-reactjs/dist/index.css';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../utils/api';

export default function AppointmentPicker({ garage, onDateSelect }) {
  const [calendarType, setCalendarType] = useState('AD'); // 'AD' or 'BS'
  
  const [selectedDateStr, setSelectedDateStr] = useState(''); // "YYYY-MM-DD"
  const [manualTimeInput, setManualTimeInput] = useState(''); // "HH:MM" user input
  const [selectedTimeStr, setSelectedTimeStr] = useState(''); // "HH:MM" confirmed
  
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Status of the time check: null | 'checking' | 'available' | 'unavailable' | 'past' | 'closed'
  const [timeStatus, setTimeStatus] = useState(null);
  const [timeMessage, setTimeMessage] = useState('');

  useEffect(() => {
    if (selectedDateStr) {
      setLoadingSlots(true);
      api.get(`/bookings/garage/${garage._id}/booked-slots?date=${selectedDateStr}`)
        .then(res => {
          setBookedSlots(res.data.map(d => new Date(d)));
          // Reset time state when date changes
          setManualTimeInput('');
          setSelectedTimeStr('');
          setTimeStatus(null);
          setTimeMessage('');
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedDateStr, garage._id]);

  useEffect(() => {
    if (selectedDateStr && selectedTimeStr) {
      const dateObj = new Date(`${selectedDateStr}T${selectedTimeStr}:00`);
      onDateSelect(dateObj);
    } else {
      onDateSelect(null);
    }
  }, [selectedDateStr, selectedTimeStr, onDateSelect]);

  const getTodayAD = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const isClosedDay = (dateStr) => {
    if (!dateStr || !garage.timing) return false;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date(dateStr);
    return garage.timing.closedDays.includes(days[dateObj.getDay()]);
  };

  const handleBSDateChange = ({ bsDate }) => {
    if (!bsDate) {
      setSelectedDateStr('');
      setManualTimeInput('');
      setSelectedTimeStr('');
      setTimeStatus(null);
      return;
    }
    try {
      const [y, m, d] = bsDate.split('-').map(Number);
      const bsDateObj = new NepaliDate(y, m - 1, d);
      const adDate = bsDateObj.toJsDate();
      
      const today = new Date();
      today.setHours(0,0,0,0);
      if (adDate < today) {
        alert("Cannot select a past date.");
        return;
      }
      
      const adStr = `${adDate.getFullYear()}-${(adDate.getMonth()+1).toString().padStart(2,'0')}-${adDate.getDate().toString().padStart(2,'0')}`;
      setSelectedDateStr(adStr);
    } catch(err) {
      console.error(err);
    }
  };

  const handleADDateChange = (e) => {
    setSelectedDateStr(e.target.value);
    setManualTimeInput('');
    setSelectedTimeStr('');
    setTimeStatus(null);
  };

  const checkTimeAvailability = () => {
    if (!manualTimeInput) {
      setTimeStatus('unavailable');
      setTimeMessage('Please enter a valid time.');
      return;
    }

    const reqDate = new Date(`${selectedDateStr}T${manualTimeInput}:00`);
    const now = new Date();

    if (reqDate < now) {
      setTimeStatus('past');
      setTimeMessage('This time is in the past.');
      setSelectedTimeStr('');
      return;
    }

    if (garage.timing && !garage.timing.is24_7) {
      if (manualTimeInput < garage.timing.openTime || manualTimeInput > garage.timing.closeTime) {
        setTimeStatus('closed');
        setTimeMessage(`Garage operates between ${garage.timing.openTime} and ${garage.timing.closeTime}.`);
        setSelectedTimeStr('');
        return;
      }
    }

    // Check overlaps (assuming ~45 mins per slot)
    const slotDurationMs = 45 * 60 * 1000;
    const reqTimeMs = reqDate.getTime();

    const isOverlap = bookedSlots.some(bDate => {
      const bTimeMs = bDate.getTime();
      return Math.abs(reqTimeMs - bTimeMs) < slotDurationMs;
    });

    if (isOverlap) {
      setTimeStatus('unavailable');
      setTimeMessage('This time overlaps with another booked appointment (allow 45 mins between bookings).');
      setSelectedTimeStr('');
    } else {
      setTimeStatus('available');
      setTimeMessage('Time slot is available!');
      setSelectedTimeStr(manualTimeInput); // Lock it in
    }
  };

  return (
    <div className="appointment-picker glass-panel" style={{ padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Select Date & Time</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => { setCalendarType('AD'); setSelectedDateStr(''); setManualTimeInput(''); setTimeStatus(null); }} className={calendarType === 'AD' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>AD (Gregorian)</button>
          <button type="button" onClick={() => { setCalendarType('BS'); setSelectedDateStr(''); setManualTimeInput(''); setTimeStatus(null); }} className={calendarType === 'BS' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>BS (Nepali)</button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        {calendarType === 'AD' ? (
          <input 
            type="date" 
            className="input-field" 
            min={getTodayAD()} 
            value={selectedDateStr} 
            onChange={handleADDateChange} 
          />
        ) : (
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <Calendar 
              onChange={handleBSDateChange} 
              dateFormat="YYYY-MM-DD"
              language="en"
              theme="default"
              className="input-field nepali-cal-input"
              hideDefaultValue={true}
              placeholder="Select Nepali Date (Bikram Sambat)"
            />
            <CalendarIcon size={20} color="var(--text-secondary)" style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        )}
      </div>

      {selectedDateStr && isClosedDay(selectedDateStr) && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
          <strong>Garage is Closed on this day.</strong> Please select another date.
        </div>
      )}

      {selectedDateStr && !isClosedDay(selectedDateStr) && (
        <div className="animate-fade-in" style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h5 style={{ color: 'var(--text-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={18} /> Request Specific Time</h5>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="time" 
              className="input-field" 
              style={{ flex: 1, minWidth: '150px', padding: '0.8rem', fontSize: '1.1rem' }}
              value={manualTimeInput}
              onChange={(e) => {
                setManualTimeInput(e.target.value);
                setTimeStatus(null);
                setSelectedTimeStr('');
              }}
            />
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ padding: '0.8rem 1.5rem', fontSize: '1rem', whiteSpace: 'nowrap' }}
              onClick={checkTimeAvailability}
              disabled={loadingSlots || !manualTimeInput}
            >
              {loadingSlots ? 'Loading...' : 'Check Availability'}
            </button>
          </div>

          {timeStatus && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.8rem', 
              borderRadius: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              background: timeStatus === 'available' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: timeStatus === 'available' ? '#10b981' : '#ef4444',
              border: `1px solid ${timeStatus === 'available' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {timeStatus === 'available' ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <span>{timeMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
