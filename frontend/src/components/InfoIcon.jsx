import { useState } from "react";

export default function InfoIcon({ tooltip, className = "" }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      className={`info-icon ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ 
        position: 'relative', 
        display: 'inline-block',
        marginLeft: '4px',
        cursor: 'help'
      }}
    >
      <span style={{
        display: 'inline-block',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: '#007bff',
        color: 'white',
        fontSize: '10px',
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: '14px',
        userSelect: 'none'
      }}>
        i
      </span>
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          maxWidth: '300px',
          whiteSpace: 'normal',
          lineHeight: '1.4'
        }}>
          {tooltip}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #333'
          }} />
        </div>
      )}
    </div>
  );
}