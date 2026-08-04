import { useState, useEffect } from 'react';
import { C } from '../../theme/colors';
import { Icon } from '../../theme/icons';
import Btn from './Btn';

export default function WhitelistBuilder({ examId, onChange }) {
  const [whitelist, setWhitelist] = useState([]);
  const [inputVal, setInputVal]   = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch initial whitelist if examId provided
  useEffect(() => {
    if (!examId) return;
    fetch(`http://localhost:5000/api/whitelist/${examId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setWhitelist(data.whitelist.map(w => w.domain));
        }
      })
      .catch(() => {});
  }, [examId]);

  // Fetch autocomplete suggestions as user types
  useEffect(() => {
    fetch(`http://localhost:5000/api/whitelist/suggest?q=${encodeURIComponent(inputVal)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, [inputVal]);

  const addDomain = (domainToAdd) => {
    const clean = (domainToAdd || inputVal).trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!clean) return;

    if (whitelist.includes(clean)) {
      setInputVal('');
      setShowDropdown(false);
      return;
    }

    const updated = [...whitelist, clean];
    setWhitelist(updated);
    setInputVal('');
    setShowDropdown(false);

    if (onChange) onChange(updated);

    // Save to API if examId exists
    if (examId) {
      fetch(`http://localhost:5000/api/whitelist/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: clean })
      }).catch(() => {});
    }
  };

  const removeDomain = (domainToRemove) => {
    const updated = whitelist.filter(d => d !== domainToRemove);
    setWhitelist(updated);
    if (onChange) onChange(updated);
  };

  return (
    <div style={{ marginTop: 12, marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.grey500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Allowed Websites Whitelist (Local Proxy)
      </label>

      <div style={{ position: 'relative', display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          placeholder="e.g. docs.python.org or type 'python' for suggestions..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: `1.5px solid ${C.grey200}`,
            fontSize: 13,
            outline: 'none',
            color: C.navy,
            fontFamily: 'inherit'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDomain();
            }
          }}
        />
        <Btn variant="navy" onClick={() => addDomain()}>Add Domain</Btn>

        {/* Autocomplete Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 120,
            background: C.white,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: `1px solid ${C.grey200}`,
            zIndex: 100,
            marginTop: 4,
            maxHeight: 180,
            overflowY: 'auto'
          }}>
            <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: C.grey400, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${C.grey100}` }}>
              Suggested Whitelist Domains
            </div>
            {suggestions.map(s => (
              <div
                key={s}
                onClick={() => addDomain(s)}
                style={{
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.navy,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${C.grey50}`,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.target.style.background = C.tealLight}
                onMouseLeave={e => e.target.style.background = 'transparent'}
              >
                🌐 {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {whitelist.map(domain => (
          <div key={domain} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            background: C.tealLight,
            border: `1px solid ${C.tealMid}`,
            color: C.navy,
            fontSize: 12,
            fontWeight: 700
          }}>
            <span>🌐 {domain}</span>
            <button
              onClick={() => removeDomain(domain)}
              style={{
                background: 'none',
                border: 'none',
                color: C.grey500,
                cursor: 'pointer',
                padding: 0,
                fontSize: 14,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ×
            </button>
          </div>
        ))}
        {whitelist.length === 0 && (
          <span style={{ fontSize: 12, color: C.grey400, fontStyle: 'italic' }}>
            No whitelisted domains added yet. Default mode blocks all internet access.
          </span>
        )}
      </div>
    </div>
  );
}
