/**
 * CSV Export Utility
 * Handles converting table data to CSV and triggering downloads
 */

/**
 * Convert array of objects to CSV string
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Array of column definitions {key, label}
 * @returns {string} CSV string
 */
export function convertToCSV(data, columns) {
  if (!data || !data.length) {
    return '';
  }

  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');
  
  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value = row[col.key];
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '""';
      }
      
      // Handle numbers
      if (typeof value === 'number') {
        return value;
      }
      
      // Handle strings - escape quotes and wrap in quotes
      value = String(value).replace(/"/g, '""');
      return `"${value}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

/**
 * Trigger CSV download in browser
 * @param {string} csvContent - CSV string content
 * @param {string} filename - Desired filename (without .csv extension)
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Create download link
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  }
}

/**
 * Export table data to CSV
 * @param {Array} data - Table data
 * @param {Array} columns - Column definitions
 * @param {string} filename - Filename for download
 */
export function exportTableToCSV(data, columns, filename) {
  const csv = convertToCSV(data, columns);
  if (csv) {
    downloadCSV(csv, filename);
  }
}

/**
 * Format number for CSV export
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
export function formatNumberForCSV(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return Number(value).toFixed(decimals);
}

/**
 * Format currency for CSV export
 * @param {number} value - Currency value
 * @param {string} symbol - Currency symbol (optional)
 * @returns {string} Formatted currency
 */
export function formatCurrencyForCSV(value, symbol = 'USD') {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return `${symbol} ${Number(value).toFixed(2)}`;
}

/**
 * Format percentage for CSV export
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage
 */
export function formatPercentForCSV(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return `${Number(value).toFixed(2)}%`;
}
