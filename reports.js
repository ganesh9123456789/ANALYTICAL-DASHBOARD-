/**
 * =========================================
 *   REPORTS EXPORTER UTILITY
 *   PDF Printing and CSV Downloads
 * =========================================
 */

window.ReportsExporter = {
    
    /**
     * Converts a raw data array to an escaped CSV string and triggers a local file download
     * @param {Array<Object>} rows Raw dataset rows
     * @param {string} fileName Target name for the downloaded file
     */
    exportDrilldownCSV: function(rows, fileName) {
        if (!rows || rows.length === 0) return;
        
        const headers = Object.keys(rows[0]);
        const csvContent = [];
        
        // 1. Add headers row
        csvContent.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
        
        // 2. Add data rows
        rows.forEach(row => {
            const line = headers.map(header => {
                let cellVal = row[header];
                if (cellVal === null || cellVal === undefined) {
                    return '""';
                }
                if (cellVal instanceof Date) {
                    return `"${cellVal.toISOString().split('T')[0]}"`;
                }
                const cleanStr = String(cellVal).replace(/"/g, '""');
                return `"${cleanStr}"`;
            });
            csvContent.push(line.join(','));
        });
        
        // 3. Trigger browser download
        const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, fileName);
        } else {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    },

    /**
     * Triggers the native browser print dialogue, leveraging our premium print styling
     * sheets defined in styles.css to hide sidebars, filters, and scale charts.
     */
    exportDashboardPDF: function() {
        // Dynamic printed report metadata populator
        const dateSpan = document.getElementById('print-report-date');
        if (dateSpan) {
            dateSpan.innerText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        const titleSpan = document.getElementById('print-header-title');
        const subtitleSpan = document.getElementById('print-header-subtitle');
        const currentData = window.DashboardRenderer.currentDataset;
        
        if (currentData) {
            if (titleSpan) {
                titleSpan.innerText = `AI Analytical Report: ${currentData.suggestedAnalysis}`;
            }
            if (subtitleSpan) {
                subtitleSpan.innerText = `Dataset Ingestion Profile: ${currentData.fileName} (${currentData.rowCount} total records)`;
            }
        }

        // Celebratory visual alert before printing
        const notify = document.createElement('div');
        notify.style.position = 'fixed';
        notify.style.top = '20px';
        notify.style.left = '50%';
        notify.style.transform = 'translateX(-50%)';
        notify.style.backgroundColor = '#10b981';
        notify.style.color = '#ffffff';
        notify.style.padding = '12px 24px';
        notify.style.borderRadius = '8px';
        notify.style.boxShadow = '0 10px 25px rgba(16,185,129,0.3)';
        notify.style.fontSize = '14px';
        notify.style.fontWeight = '600';
        notify.style.zIndex = '9999';
        notify.innerText = 'Compiling executive PDF report...';
        
        document.body.appendChild(notify);
        
        setTimeout(() => {
            document.body.removeChild(notify);
            window.print();
        }, 1200);
    }
};
