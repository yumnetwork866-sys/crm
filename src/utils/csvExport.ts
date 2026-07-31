/**
 * Utility functions to export CRM and Dashboard Report data into CSV files with UTF-8 BOM support for Excel
 */

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  // Add UTF-8 BOM for Microsoft Excel compatibility
  let csvContent = '\uFEFF';

  // Format headers
  const headerRow = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',');
  csvContent += headerRow + '\r\n';

  // Format data rows
  rows.forEach((row) => {
    const rowStr = row
      .map((val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
    csvContent += rowStr + '\r\n';
  });

  // Create Blob and trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
