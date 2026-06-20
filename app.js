/**
 * =========================================
 *   CENTRAL ORCHESTRATOR & SAMPLE DATA
 *   State Management, UI Router, & Simulations
 * =========================================
 */

window.AppOrchestrator = {
    currentDataset: null,
    theme: 'dark',

    init: function() {
        // Initialize Components
        window.NLPEngine.init();
        this.setupEventListeners();
        this.setupDragAndDrop();
        
        // Render initial Lucide icons
        lucide.createIcons();
    },

    setupEventListeners: function() {
        // Tab switching
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tabId = item.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        // Theme switching
        const themeBtn = document.getElementById('theme-toggle');
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            themeBtn.querySelector('i, svg').setAttribute('data-lucide', newTheme === 'dark' ? 'sun' : 'moon');
            lucide.createIcons();
            
            // Re-render charts with the new theme
            if (this.currentDataset) {
                window.DashboardRenderer.renderDashboard(this.currentDataset);
            }
        });

        // Export PDF
        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            window.ReportsExporter.exportDashboardPDF();
        });

        // Upload another dataset button
        document.getElementById('upload-another-btn').addEventListener('click', () => {
            this.resetToDataCenter();
        });

        // Reset filters button
        document.getElementById('reset-filters-btn').addEventListener('click', () => {
            document.getElementById('filter-category').value = 'ALL';
            document.getElementById('filter-region').value = 'ALL';
            document.getElementById('filter-search').value = '';
            window.DashboardRenderer.applyFilters();
        });

        // Apply filters automatically on change
        document.getElementById('filter-category').addEventListener('change', () => window.DashboardRenderer.applyFilters());
        document.getElementById('filter-region').addEventListener('change', () => window.DashboardRenderer.applyFilters());
        document.getElementById('filter-search').addEventListener('input', () => window.DashboardRenderer.applyFilters());

        // Drilldown Modal closing events
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('close-modal-footer-btn').addEventListener('click', () => this.closeModal());
        
        // What-If Sliders event listeners
        const sliders = ['price', 'marketing', 'conversion'];
        sliders.forEach(sliderId => {
            const slider = document.getElementById(`slider-${sliderId}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const label = document.getElementById(`val-slider-${sliderId}`);
                    const val = e.target.value;
                    label.innerText = val > 0 ? `+${val}%` : `${val}%`;
                    this.runWhatIfSimulation();
                });
            }
        });

        // Custom Analysis Builder events
        document.getElementById('render-custom-chart-btn').addEventListener('click', () => {
            this.renderCustomPlaygroundChart();
        });

        // Built-in Sample Sandbox click listeners
        document.querySelectorAll('.sample-card').forEach(card => {
            card.addEventListener('click', () => {
                const sampleName = card.getAttribute('data-sample');
                this.loadSampleDataset(sampleName);
            });
        });
    },

    /**
     * File Drag and Drop listeners
     */
    setupDragAndDrop: function() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file);
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) this.processFile(file);
        });
    },

    /**
     * Dispatches parsing based on file types
     */
    processFile: function(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        // Dynamic loading visualizer
        this.switchTab('data-center');
        const zone = document.getElementById('drop-zone');
        zone.innerHTML = `
            <div class="upload-icon-container" style="animation: spin 2s linear infinite;">
                <i data-lucide="refresh-cw"></i>
            </div>
            <h2 class="upload-title">Ingesting and parsing data...</h2>
            <p class="upload-description">Cleansing cells and mathematical sniffer active.</p>
        `;
        lucide.createIcons();

        let parsePromise;
        if (extension === 'csv') {
            parsePromise = window.DataParser.parseCSV(file);
        } else if (extension === 'xlsx' || extension === 'xls') {
            parsePromise = window.DataParser.parseExcel(file);
        } else if (extension === 'json') {
            parsePromise = window.DataParser.parseJSON(file);
        } else {
            alert("Unsupported format. Please upload CSV, XLSX, XLS or JSON.");
            this.resetToDataCenter();
            return;
        }

        parsePromise.then(profile => {
            this.ingestCompleted(profile);
        }).catch(err => {
            alert("Ingestion Error: " + err.message);
            this.resetToDataCenter();
        });
    },

    ingestCompleted: function(profile) {
        this.currentDataset = profile;

        // Show metadata card details
        document.getElementById('active-dataset-meta').style.display = 'flex';
        document.getElementById('meta-file-name').innerText = profile.fileName;
        document.getElementById('meta-row-count').innerText = `${profile.rowCount} rows`;
        document.getElementById('meta-col-count').innerText = `${profile.columns.length} columns`;
        document.getElementById('meta-missing-count').innerText = `${profile.missingValuesCount} missing`;
        
        // Hide standard drag zones
        document.getElementById('data-center').style.display = 'none';

        // Unhide global action buttons
        document.getElementById('export-pdf-btn').style.display = 'inline-flex';
        document.getElementById('upload-another-btn').style.display = 'inline-flex';

        // Initialize Custom Analyzer dropdowns
        this.populateCustomAnalyzerDropdowns();

        // Boot visualizations dashboard
        window.DashboardRenderer.renderDashboard(profile);
        window.NLPEngine.setDataset(profile);
        
        // Re-calculate sliders
        this.runWhatIfSimulation();
    },

    resetToDataCenter: function() {
        this.currentDataset = null;
        
        // Reset inputs
        document.getElementById('file-input').value = '';
        
        // Show Data Center
        document.getElementById('data-center').style.display = 'flex';
        this.switchTab('data-center');
        
        // Hide stats, action buttons, filters, NLP trigger
        document.getElementById('active-dataset-meta').style.display = 'none';
        document.getElementById('export-pdf-btn').style.display = 'none';
        document.getElementById('upload-another-btn').style.display = 'none';
        document.getElementById('global-filter-bar').style.display = 'none';
        document.getElementById('dashboard-kpis').style.display = 'none';
        document.getElementById('ai-insights-container').style.display = 'none';
        document.getElementById('nlp-chat-trigger').classList.add('hidden');
        document.getElementById('nlp-chat-widget').classList.remove('active');

        // Restore upload zone innerHTML
        document.getElementById('drop-zone').innerHTML = `
            <input type="file" id="file-input" class="upload-file-input" accept=".csv,.xlsx,.xls,.json">
            <div class="upload-icon-container">
                <i data-lucide="upload-cloud"></i>
            </div>
            <h2 class="upload-title">Drag & drop your dataset here</h2>
            <p class="upload-description">Supports CSV, XLSX, XLS, and JSON formats (Max 50MB)</p>
            <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">Browse Files</button>
            <div class="file-type-tags">
                <span class="file-tag">CSV Parser</span>
                <span class="file-tag">Excel SheetJS</span>
                <span class="file-tag">JSON Reader</span>
            </div>
        `;
        
        // Hide sidebar panel buttons
        document.getElementById('nav-analysis-title').style.display = 'none';
        document.getElementById('nav-sales').style.display = 'none';
        document.getElementById('nav-churn').style.display = 'none';
        document.getElementById('nav-segmentation').style.display = 'none';
        document.getElementById('nav-performance').style.display = 'none';
        document.getElementById('nav-custom').style.display = 'none';
        
        this.setupDragAndDrop();
        lucide.createIcons();
    },

    switchTab: function(tabId) {
        document.querySelectorAll('.tab-content').forEach(c => {
            if (c.id === tabId) c.classList.add('active');
            else c.classList.remove('active');
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-tab') === tabId) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Set top header label
        const titles = {
            'data-center': 'Data Center',
            'sales-tab': 'Sales & Revenue Analysis',
            'churn-tab': 'Customer Churn Analysis',
            'segmentation-tab': 'Customer Segmentation',
            'performance-tab': 'Employee Performance',
            'custom-tab': 'Custom Analyzer'
        };
        document.getElementById('main-panel-title').innerText = titles[tabId] || 'Dashboard';
    },

    closeModal: function() {
        document.getElementById('drilldown-modal').classList.remove('active');
    },

    /**
     * Re-calculates and projects custom shifts based on What-If parameters
     */
    runWhatIfSimulation: function() {
        if (!this.currentDataset || this.currentDataset.suggestedAnalysis !== 'Sales Trend Analysis') return;
        
        const pricePct = parseFloat(document.getElementById('slider-price').value) / 100;
        const marketingPct = parseFloat(document.getElementById('slider-marketing').value) / 100;
        const conversionPct = parseFloat(document.getElementById('slider-conversion').value) / 100;

        // Mathematical projection index logic:
        // Simulated Revenue Shift = Price shift * 0.7 (elasticity) + marketing shift * 0.45 + conversion shift * 0.8
        const simulatedMultiplier = 1.0 + (pricePct * 0.65) + (marketingPct * 0.38) + (conversionPct * 0.72);
        
        const dateCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'date');
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        const monthlyRev = {};
        this.currentDataset.data.forEach(d => {
            const date = d[dateCol];
            if (date instanceof Date) {
                const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlyRev[month] = (monthlyRev[month] || 0) + d[revCol];
            }
        });

        const revValues = Object.values(monthlyRev);
        if (revValues.length === 0) return;

        const forecast = window.DataAnalyzer.forecastDoubleSmoothing(revValues, 3, 0.45, 0.3);
        const originalNextMonth = forecast[0].value;
        const simulatedNextMonth = originalNextMonth * simulatedMultiplier;
        
        const pctDiff = ((simulatedNextMonth - originalNextMonth) / originalNextMonth) * 100;

        document.getElementById('whatif-simulation-summary').innerHTML = `
            Simulated next quarter revenue: <strong>$${Math.round(simulatedNextMonth).toLocaleString()}</strong> 
            (${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}% shift vs baseline forecast: $${Math.round(originalNextMonth).toLocaleString()}).
        `;

        // Update forecast line values in chart directly
        if (window.DashboardRenderer.charts.salesTrend) {
            const seriesData = [...revValues];
            const forecastData = new Array(seriesData.length - 1).fill(null);
            forecastData.push(seriesData[seriesData.length - 1]);
            
            // Push baseline values modified by simulated scale
            forecast.forEach(f => forecastData.push(parseFloat((f.value * simulatedMultiplier).toFixed(2))));
            
            window.DashboardRenderer.charts.salesTrend.updateSeries([
                { name: 'Historical Revenue', data: seriesData },
                { name: 'AI Double Smoothing Forecast', data: forecastData }
            ]);
        }
    },

    /**
     * Fills column fields in Custom Analyzer options list
     */
    populateCustomAnalyzerDropdowns: function() {
        const xAxis = document.getElementById('custom-x-axis');
        const yAxis = document.getElementById('custom-y-axis');
        const breakdown = document.getElementById('custom-breakdown');

        xAxis.innerHTML = '';
        yAxis.innerHTML = '';
        breakdown.innerHTML = '<option value="NONE">No Grouping Breakdown</option>';

        this.currentDataset.columns.forEach(col => {
            const profile = this.currentDataset.columnProfiles[col];
            
            // X-Axis accepts categoricals or dates
            if (profile.type === 'category' || profile.type === 'date' || profile.type === 'string') {
                const opt = document.createElement('option');
                opt.value = col;
                opt.innerText = col;
                xAxis.appendChild(opt);

                const optB = document.createElement('option');
                optB.value = col;
                optB.innerText = col;
                breakdown.appendChild(optB);
            }
            
            // Y-Axis accepts numeric metrics
            if (profile.type === 'number') {
                const opt = document.createElement('option');
                opt.value = col;
                opt.innerText = col;
                yAxis.appendChild(opt);
            }
        });
    },

    /**
     * Custom analysis plotting playground
     */
    renderCustomPlaygroundChart: function() {
        const xCol = document.getElementById('custom-x-axis').value;
        const yCol = document.getElementById('custom-y-axis').value;
        const groupCol = document.getElementById('custom-breakdown').value;
        const type = document.getElementById('custom-chart-type').value;

        // Group rows dynamically by X coordinate and aggregate Y values
        const data = this.currentDataset.data;
        const aggregation = {};
        
        data.forEach(row => {
            const xVal = row[xCol] instanceof Date ? row[xCol].toISOString().split('T')[0] : String(row[xCol]);
            const yVal = parseFloat(row[yCol]) || 0;
            aggregation[xVal] = (aggregation[xVal] || 0) + yVal;
        });

        const categories = Object.keys(aggregation);
        const seriesData = Object.values(aggregation);

        document.getElementById('custom-generated-chart').innerHTML = '';
        document.getElementById('custom-chart-main-title').innerText = `Custom Graph: ${yCol} by ${xCol}`;
        document.getElementById('custom-chart-main-subtitle').innerText = `Aggregations dynamically mapped from the uploaded dataset array.`;

        const options = {
            chart: {
                type: type,
                height: 380,
                foreColor: '#94a3b8',
                toolbar: { show: true }
            },
            colors: ['#6366f1'],
            series: [{
                name: yCol,
                data: seriesData
            }],
            xaxis: {
                categories: categories
            },
            grid: { borderColor: 'rgba(255, 255, 255, 0.05)' }
        };

        const customChart = new ApexCharts(document.querySelector("#custom-generated-chart"), options);
        customChart.render();
        
        // Save to orchestrator references to destroy later if needed
        window.DashboardRenderer.destroyAllCharts();
        window.DashboardRenderer.charts.customChart = customChart;
    },

    /**
     * Injects the preloaded AI Sandbox datasets
     */
    loadSampleDataset: function(sampleName) {
        const mockRows = [];
        let sugAnalysis = 'Sales Trend Analysis';
        let fileName = 'sales_revenue_2026.csv';
        let cols = [];

        if (sampleName === 'sales') {
            fileName = 'enterprise_sales_revenue_2026.csv';
            sugAnalysis = 'Sales Trend Analysis';
            cols = ['Date', 'Category', 'Region', 'Revenue', 'Profit', 'Qty', 'Discount'];
            
            const cats = ['Technology', 'Furniture', 'Office Supplies', 'Clothing'];
            const regs = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
            
            for (let i = 0; i < 80; i++) {
                const date = new Date(2025, 0, 1 + i * 5); // Spanning Jan 2025 - Jan 2026
                const category = cats[i % cats.length];
                const region = regs[Math.floor(i / 20) % regs.length];
                const revenue = parseFloat((300 + Math.random() * 5000 + (category === 'Technology' ? 1200 : 0)).toFixed(2));
                const profit = parseFloat((revenue * (0.15 + Math.random() * 0.3)).toFixed(2));
                const qty = Math.floor(1 + Math.random() * 12);
                const discount = Math.random() > 0.6 ? parseFloat((0.05 + Math.random() * 0.15).toFixed(2)) : 0.0;
                
                mockRows.push({ Date: date, Category: category, Region: region, Revenue: revenue, Profit: profit, Qty: qty, Discount: discount });
            }
        } 
        
        else if (sampleName === 'churn') {
            fileName = 'saas_customer_churn_cohorts.csv';
            sugAnalysis = 'Customer Churn Analysis';
            cols = ['CustomerID', 'CohortMonth', 'TenureMonths', 'InactivityDays', 'SupportTickets', 'MonthlyCharges', 'ChurnRiskScore', 'Region'];
            
            const cohorts = ['Cohort Jan', 'Cohort Feb', 'Cohort Mar', 'Cohort Apr', 'Cohort May', 'Cohort Jun'];
            const regs = ['East Coast', 'West Coast', 'Midwest', 'South'];

            for (let i = 0; i < 80; i++) {
                const id = `USR${1000 + i}`;
                const cohort = cohorts[i % cohorts.length];
                const tenure = Math.floor(1 + Math.random() * 24);
                const inactive = Math.floor(Math.random() * 90);
                const tickets = Math.floor(Math.random() * 10);
                const charges = parseFloat((29 + Math.random() * 120).toFixed(2));
                const region = regs[i % regs.length];
                
                // Formulate realistic risk indices
                const risk = Math.round(Math.min(98, Math.max(8, (inactive * 0.5 + tickets * 5.2 - tenure * 0.8 + 20))));
                
                mockRows.push({ CustomerID: id, CohortMonth: cohort, TenureMonths: tenure, InactivityDays: inactive, SupportTickets: tickets, MonthlyCharges: charges, ChurnRiskScore: risk, Region: region });
            }
        } 
        
        else if (sampleName === 'segmentation') {
            fileName = 'retail_kmeans_customer_segments.csv';
            sugAnalysis = 'Customer Segmentation';
            cols = ['CustomerID', 'AnnualSpend', 'PurchaseFrequency', 'AverageOrderValue', 'RetentionPeriodMonths'];

            for (let i = 0; i < 80; i++) {
                const id = `CUST${1000 + i}`;
                // Establish 4 distinct centroids bounds
                let spend, freq;
                const r = i % 4;
                if (r === 0) { // Champions
                    spend = 7000 + Math.random() * 4500;
                    freq = 35 + Math.floor(Math.random() * 30);
                } else if (r === 1) { // Loyal Standards
                    spend = 3000 + Math.random() * 3500;
                    freq = 18 + Math.floor(Math.random() * 16);
                } else if (r === 2) { // Nurtures (Big purchases, low frequency)
                    spend = 4000 + Math.random() * 5000;
                    freq = 5 + Math.floor(Math.random() * 6);
                } else { // Dormant Risks
                    spend = 200 + Math.random() * 1500;
                    freq = 1 + Math.floor(Math.random() * 5);
                }

                const aov = parseFloat((spend / freq).toFixed(2));
                const retention = Math.floor(3 + Math.random() * 42);

                mockRows.push({ CustomerID: id, AnnualSpend: spend, PurchaseFrequency: freq, AverageOrderValue: aov, RetentionPeriodMonths: retention });
            }
        } 
        
        else if (sampleName === 'employee') {
            fileName = 'employee_productivity_performance.csv';
            sugAnalysis = 'Employee Performance Analysis';
            cols = ['EmployeeID', 'Manager', 'Region', 'ProductivityScore', 'TrainingHours', 'MonthlyOutput', 'EvaluationScore'];
            
            const mgrs = ['Sarah Jenkins', 'David Vance', 'Marcus Cole', 'Clara Croft'];
            const regs = ['Americas', 'APAC', 'EMEA'];

            for (let i = 0; i < 80; i++) {
                const id = `EMP${1000 + i}`;
                const mgr = mgrs[i % mgrs.length];
                const region = regs[Math.floor(i / 15) % regs.length];
                const training = Math.floor(4 + Math.random() * 50);
                
                // Realistic output correlation
                const output = Math.round(200 + training * 12 + Math.random() * 150);
                const score = parseFloat(Math.min(99, Math.max(30, (40 + training * 0.8 + Math.random() * 15))).toFixed(1));
                const rating = parseFloat(Math.min(5.0, Math.max(1.0, (1.5 + (training / 15) + Math.random() * 1.5))).toFixed(2));

                mockRows.push({ EmployeeID: id, Manager: mgr, Region: region, ProductivityScore: score, TrainingHours: training, MonthlyOutput: output, EvaluationScore: rating });
            }
        }

        // Auto-profile the mocked structures
        const profile = window.DataParser.cleanAndProfileDataset(mockRows, fileName);
        profile.suggestedAnalysis = sugAnalysis; // Enforce appropriate context

        // Congratulatory effect (celebration confetti feel)
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.right = '0';
        flash.style.bottom = '0';
        flash.style.background = 'rgba(99, 102, 241, 0.15)';
        flash.style.zIndex = '9999';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.6s ease';
        document.body.appendChild(flash);
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => document.body.removeChild(flash), 600);
        }, 150);

        this.ingestCompleted(profile);
    }
};

// Start Orchestrator on load
window.addEventListener('DOMContentLoaded', () => {
    window.AppOrchestrator.init();
});
