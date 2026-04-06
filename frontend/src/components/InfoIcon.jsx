import { useState } from "react";

export default function InfoIcon({ tooltip, content, className = "", style = {} }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Support both 'tooltip' (legacy) and 'content' (new) props
  const displayContent = content || tooltip;

  return (
    <div 
      className={`info-icon ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ 
        position: 'relative',
        display: 'inline-block',
        cursor: 'help',
        zIndex: 10,
        ...style
      }}
    >
      <span style={{
        display: 'inline-block',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: '#007bff',
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: '16px',
        userSelect: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }}>
        i
      </span>
      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: '25px',
          right: '0',
          backgroundColor: '#2c3e50',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          minWidth: '280px',
          maxWidth: '400px',
          lineHeight: '1.5',
          border: '1px solid #34495e',
          whiteSpace: 'normal'
        }}>
          {typeof displayContent === 'string' ? (
            <div style={{ whiteSpace: 'pre-line' }}>{displayContent}</div>
          ) : (
            displayContent
          )}
          <div style={{
            position: 'absolute',
            top: '-6px',
            right: '12px',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '6px solid #2c3e50'
          }} />
        </div>
      )}
    </div>
  );
}