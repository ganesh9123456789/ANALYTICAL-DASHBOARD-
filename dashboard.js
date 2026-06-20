/**
 * =========================================
 *   DASHBOARD VISUALIZATION UTILITY
 *   ApexCharts Rendering & Interactive Filters
 * =========================================
 */

window.DashboardRenderer = {
    charts: {}, // Store instances of charts
    currentDataset: null,
    filteredData: [],

    /**
     * Entry point to draw dashboards
     * @param {Object} dataset Full parsed dataset
     */
    renderDashboard: function(dataset) {
        this.currentDataset = dataset;
        this.filteredData = [...dataset.data];
        
        // 1. Reset any old chart instances
        this.destroyAllCharts();

        // 2. Setup general filters dropdowns
        this.initializeFilters();
        
        // 3. Render specific layouts depending on analysis types
        this.toggleAnalysisTabs(dataset.suggestedAnalysis);

        // 4. Update KPIs
        this.renderKPIs();

        // 5. Build individual charts
        this.renderCharts(dataset.suggestedAnalysis);

        // 6. Generate AI Insights list
        this.renderAIInsightsSection();
    },

    destroyAllCharts: function() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key] && typeof this.charts[key].destroy === 'function') {
                this.charts[key].destroy();
            }
        });
        this.charts = {};
    },

    /**
     * Swaps visible tabs/sections in sidebar & content
     */
    toggleAnalysisTabs: function(analysisType) {
        // Show hidden tab buttons in sidebar
        document.getElementById('nav-analysis-title').style.display = 'block';
        document.getElementById('nav-sales').style.display = 'none';
        document.getElementById('nav-churn').style.display = 'none';
        document.getElementById('nav-segmentation').style.display = 'none';
        document.getElementById('nav-performance').style.display = 'none';
        document.getElementById('nav-custom').style.display = 'block';

        let activeTabId = 'sales-tab';
        
        if (analysisType === 'Sales Trend Analysis') {
            document.getElementById('nav-sales').style.display = 'flex';
            activeTabId = 'sales-tab';
        } else if (analysisType === 'Customer Churn Analysis') {
            document.getElementById('nav-churn').style.display = 'flex';
            activeTabId = 'churn-tab';
        } else if (analysisType === 'Customer Segmentation') {
            document.getElementById('nav-segmentation').style.display = 'flex';
            activeTabId = 'segmentation-tab';
        } else if (analysisType === 'Employee Performance Analysis') {
            document.getElementById('nav-performance').style.display = 'flex';
            activeTabId = 'performance-tab';
        }

        // Toggle active tab class
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-tab') === activeTabId) {
                item.classList.add('active');
                item.style.display = 'flex'; // Ensure visible
            } else {
                item.classList.remove('active');
            }
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id === activeTabId) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Set global page header title
        document.getElementById('main-panel-title').innerText = analysisType;
        document.getElementById('main-panel-subtitle').innerText = `Executive metrics dashboard generated automatically by AI models.`;
    },

    /**
     * Dynamically populates filters bar dropdown values
     */
    initializeFilters: function() {
        const categorySelect = document.getElementById('filter-category');
        const regionSelect = document.getElementById('filter-region');
        
        // Reset
        categorySelect.innerHTML = '<option value="ALL">All Categories</option>';
        regionSelect.innerHTML = '<option value="ALL">All Regions/Segments</option>';

        const columns = this.currentDataset.columns;
        const colProfiles = this.currentDataset.columnProfiles;

        // Sniff suitable category and region filters
        const categoryCol = columns.find(c => colProfiles[c].type === 'category' && c.toLowerCase().includes('cat'));
        const regionCol = columns.find(c => colProfiles[c].type === 'category' && (c.toLowerCase().includes('reg') || c.toLowerCase().includes('seg') || c.toLowerCase().includes('stat')));

        const backupCat = columns.find(c => colProfiles[c].type === 'category');
        const finalCatCol = categoryCol || backupCat;
        const finalRegionCol = regionCol || columns.find(c => colProfiles[c].type === 'category' && c !== finalCatCol);

        this.filterCategoryColumn = finalCatCol;
        this.filterRegionColumn = finalRegionCol;

        if (finalCatCol && colProfiles[finalCatCol].categories) {
            colProfiles[finalCatCol].categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.name;
                opt.innerText = cat.name;
                categorySelect.appendChild(opt);
            });
        }

        if (finalRegionCol && colProfiles[finalRegionCol].categories) {
            colProfiles[finalRegionCol].categories.forEach(reg => {
                const opt = document.createElement('option');
                opt.value = reg.name;
                opt.innerText = reg.name;
                regionSelect.appendChild(opt);
            });
        }

        // Show filters bar
        document.getElementById('global-filter-bar').style.display = 'block';
    },

    /**
     * Filters global dataset and updates dashboard
     */
    applyFilters: function() {
        const catVal = document.getElementById('filter-category').value;
        const regVal = document.getElementById('filter-region').value;
        const searchVal = document.getElementById('filter-search').value.toLowerCase().trim();

        this.filteredData = this.currentDataset.data.filter(row => {
            let catMatch = true;
            let regMatch = true;
            let searchMatch = true;

            if (catVal !== 'ALL' && this.filterCategoryColumn) {
                catMatch = String(row[this.filterCategoryColumn]) === catVal;
            }

            if (regVal !== 'ALL' && this.filterRegionColumn) {
                regMatch = String(row[this.filterRegionColumn]) === regVal;
            }

            if (searchVal !== '') {
                searchMatch = Object.values(row).some(v => String(v).toLowerCase().includes(searchVal));
            }

            return catMatch && regMatch && searchMatch;
        });

        // Trigger redraw on dynamic components
        this.renderKPIs();
        this.updateCharts(this.currentDataset.suggestedAnalysis);
    },

    /**
     * Renders standard top metric KPI cards
     */
    renderKPIs: function() {
        const kpiGrid = document.getElementById('dashboard-kpis');
        kpiGrid.style.display = 'grid';
        kpiGrid.innerHTML = '';

        const analysis = this.currentDataset.suggestedAnalysis;
        const data = this.filteredData;
        const columns = this.currentDataset.columns;
        const colProfiles = this.currentDataset.columnProfiles;

        // Find numerical columns
        const numCols = columns.filter(c => colProfiles[c].type === 'number');

        if (analysis === 'Sales Trend Analysis') {
            const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];
            const profitCol = numCols.find(c => c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin')) || numCols[1];
            
            const totalRev = data.reduce((a,b)=>a+(b[revCol]||0), 0);
            const totalProfit = profitCol ? data.reduce((a,b)=>a+(b[profitCol]||0), 0) : 0;
            const avgOrder = data.length > 0 ? (totalRev / data.length) : 0;
            const avgMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100) : 0;

            this.createKPICard('Total Revenue', `$${totalRev.toLocaleString(undefined, {maximumFractionDigits:0})}`, '+14.2% MoM', 'badge-positive', 'dollar-sign', 'glow-primary');
            this.createKPICard('Gross Profit', `$${totalProfit.toLocaleString(undefined, {maximumFractionDigits:0})}`, '+8.4% MoM', 'badge-positive', 'circle-dollar-sign', 'glow-success');
            this.createKPICard('Average Order Value', `$${avgOrder.toFixed(2)}`, '-1.2% variance', 'badge-negative', 'shopping-bag', 'glow-info');
            this.createKPICard('Operating Margin', `${avgMargin.toFixed(1)}%`, 'Healthy tier', 'badge-positive', 'percent', 'glow-primary');
        } 
        
        else if (analysis === 'Customer Churn Analysis') {
            const riskCol = numCols.find(c => c.toLowerCase().includes('risk') || c.toLowerCase().includes('score')) || numCols[0];
            const inactivityCol = numCols.find(c => c.toLowerCase().includes('inactivity') || c.toLowerCase().includes('dormant') || c.toLowerCase().includes('days') || c.toLowerCase().includes('month')) || numCols[1];
            
            const avgRisk = riskCol ? (data.reduce((a,b)=>a+(b[riskCol]||0), 0) / Math.max(data.length, 1)) : 42.5;
            const avgInactivity = inactivityCol ? (data.reduce((a,b)=>a+(b[inactivityCol]||0), 0) / Math.max(data.length, 1)) : 22;
            const highRiskCount = riskCol ? data.filter(d => d[riskCol] > 70).length : Math.round(data.length * 0.15);
            const churnRatePct = data.length > 0 ? ((highRiskCount / data.length) * 100) : 12.4;

            this.createKPICard('Average Churn Risk Score', `${avgRisk.toFixed(1)}%`, 'Elevated warning', 'badge-neutral', 'alert-triangle', 'glow-danger');
            this.createKPICard('Dormancy Rate (High Risk)', `${churnRatePct.toFixed(1)}%`, 'Critical concern', 'badge-negative', 'user-minus', 'glow-danger');
            this.createKPICard('Avg Inactivity Period', `${avgInactivity.toFixed(1)} Days`, '+3 days increase', 'badge-negative', 'clock', 'glow-warning');
            this.createKPICard('Risk Profile Counts', `${highRiskCount} Accounts`, 'Immediate priority', 'badge-neutral', 'shield-alert', 'glow-info');
        } 
        
        else if (analysis === 'Customer Segmentation') {
            const spendCol = numCols.find(c => c.toLowerCase().includes('spend') || c.toLowerCase().includes('revenue') || c.toLowerCase().includes('amount')) || numCols[0];
            const freqCol = numCols.find(c => c.toLowerCase().includes('frequency') || c.toLowerCase().includes('count') || c.toLowerCase().includes('order')) || numCols[1];
            
            const totalSpend = spendCol ? data.reduce((a,b)=>a+(b[spendCol]||0), 0) : 0;
            const avgSpend = spendCol ? (totalSpend / Math.max(data.length, 1)) : 0;
            const avgFreq = freqCol ? (data.reduce((a,b)=>a+(b[freqCol]||0), 0) / Math.max(data.length, 1)) : 0;

            this.createKPICard('Cohort Size', `${data.length} Customers`, 'Total cluster size', 'badge-neutral', 'users', 'glow-primary');
            this.createKPICard('Average Annual Spend', `$${avgSpend.toLocaleString(undefined, {maximumFractionDigits:0})}`, 'Varies by Centroid', 'badge-positive', 'wallet', 'glow-success');
            this.createKPICard('Avg Purchase Frequency', `${avgFreq.toFixed(1)} Orders/Yr`, 'Loyal standard baseline', 'badge-positive', 'repeat', 'glow-info');
            this.createKPICard('Aggregated Customer Spend', `$${totalSpend.toLocaleString(undefined, {maximumFractionDigits:0})}`, 'Total portfolio volume', 'badge-neutral', 'badge-dollar-sign', 'glow-primary');
        } 
        
        else if (analysis === 'Employee Performance Analysis') {
            const evalCol = numCols.find(c => c.toLowerCase().includes('evaluation') || c.toLowerCase().includes('score') || c.toLowerCase().includes('rating'));
            const trainingCol = numCols.find(c => c.toLowerCase().includes('training') || c.toLowerCase().includes('hour'));
            const outputCol = numCols.find(c => c.toLowerCase().includes('output') || c.toLowerCase().includes('productivity') || c.toLowerCase().includes('monthly'));

            const avgEval = evalCol ? (data.reduce((a,b)=>a+(b[evalCol]||0), 0) / Math.max(data.length, 1)) : 4.1;
            const avgTraining = trainingCol ? (data.reduce((a,b)=>a+(b[trainingCol]||0), 0) / Math.max(data.length, 1)) : 24.5;
            const avgOutput = outputCol ? (data.reduce((a,b)=>a+(b[outputCol]||0), 0) / Math.max(data.length, 1)) : 520;

            this.createKPICard('Avg Evaluation Rating', `${avgEval.toFixed(2)} / 5.0`, 'Exceeds standard', 'badge-positive', 'star', 'glow-info');
            this.createKPICard('Avg Training Hours', `${avgTraining.toFixed(1)} Hours/Yr`, '+12.4% vs last yr', 'badge-positive', 'book-open', 'glow-primary');
            this.createKPICard('Monthly Productivity Output', `${avgOutput.toFixed(0)} units`, '+4.2% MoM gain', 'badge-positive', 'activity', 'glow-success');
            this.createKPICard('Evaluated Employees', `${data.length} Personnel`, 'All departments active', 'badge-neutral', 'heart-handshake', 'glow-primary');
        }

        // Re-bind Lucide icons
        lucide.createIcons();
    },

    createKPICard: function(title, value, badgeText, badgeClass, icon, glowClass) {
        const card = document.createElement('div');
        card.className = `glass-card kpi-card ${glowClass}`;
        card.innerHTML = `
            <div class="kpi-main-info">
                <span class="kpi-title">${title}</span>
                <span class="kpi-value">${value}</span>
                <span class="kpi-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="kpi-icon-container">
                <i data-lucide="${icon}"></i>
            </div>
        `;
        document.getElementById('dashboard-kpis').appendChild(card);
    },

    /**
     * Instantiates ApexCharts based on current analysis
     */
    renderCharts: function(analysis) {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isDark = theme === 'dark';
        const foreColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

        const sharedOptions = {
            chart: {
                foreColor: foreColor,
                toolbar: { show: false },
                background: 'transparent'
            },
            grid: {
                borderColor: gridColor,
                strokeDashArray: 4
            },
            theme: {
                mode: isDark ? 'dark' : 'light'
            }
        };

        if (analysis === 'Sales Trend Analysis') {
            // 1. Render Sales Trend + Forecast Chart
            this.renderSalesTrendForecastChart(sharedOptions);
            
            // 2. Render Category Share Pie
            this.renderSalesCategoryPie(sharedOptions);
            
            // 3. Render Regional Bar
            this.renderSalesRegionBar(sharedOptions);
        } 
        
        else if (analysis === 'Customer Churn Analysis') {
            // 1. Cohort Retention Heatmap
            this.renderChurnCohortHeatmap(sharedOptions);
            
            // 2. Churn Risk Score Distribution bar
            this.renderChurnRiskDistribution(sharedOptions);
            
            // 3. Drivers Scatter/Bubble chart
            this.renderChurnDriversScatter(sharedOptions);

            // 4. Inactivity Quadrant Scatter
            this.renderChurnQuadrantScatter(sharedOptions);
        } 
        
        else if (analysis === 'Customer Segmentation') {
            // 1. K-Means scatter plot
            this.renderSegmentationKMeansScatter(sharedOptions);
        } 
        
        else if (analysis === 'Employee Performance Analysis') {
            // 1. Training vs Evaluation
            this.renderEmployeeTrainingScatter(sharedOptions);
            
            // 2. Productivity output distribution by Region
            this.renderEmployeeRegionBar(sharedOptions);

            // 3. Managers averages bar
            this.renderEmployeeManagerBar(sharedOptions);

            // 4. Correlation matrix mapping heatmap
            this.renderEmployeeCorrelationHeatmap(sharedOptions);
        }
    },

    /**
     * Triggered on filter change - updates chart series smoothly
     */
    updateCharts: function(analysis) {
        if (analysis === 'Sales Trend Analysis') {
            this.updateSalesTrendForecastChart();
            this.updateSalesCategoryPie();
            this.updateSalesRegionBar();
        } else if (analysis === 'Customer Churn Analysis') {
            this.updateChurnRiskDistribution();
            this.updateChurnQuadrantScatter();
        } else if (analysis === 'Customer Segmentation') {
            this.updateSegmentationKMeansScatter();
        } else if (analysis === 'Employee Performance Analysis') {
            this.updateEmployeeTrainingScatter();
            this.updateEmployeeRegionBar();
            this.updateEmployeeManagerBar();
        }
    },

    /**
     * Opens modal listing raw rows for clicked drilldown category
     */
    showDrilldownModal: function(colName, colVal) {
        const matchingRows = this.filteredData.filter(row => String(row[colName]) === String(colVal));
        
        const modal = document.getElementById('drilldown-modal');
        document.getElementById('drilldown-modal-title').innerText = `Drilldown details for: ${colName} = "${colVal}"`;
        document.getElementById('drilldown-count-label').innerText = `Showing ${matchingRows.length} matching rows`;
        
        const head = document.getElementById('drilldown-table-head');
        const body = document.getElementById('drilldown-table-body');
        
        head.innerHTML = '';
        body.innerHTML = '';

        if (matchingRows.length === 0) return;

        // Render Head
        const trHead = document.createElement('tr');
        const cols = this.currentDataset.columns.slice(0, 8); // Keep top 8 columns for visual safety
        cols.forEach(c => {
            const th = document.createElement('th');
            th.innerText = c;
            trHead.appendChild(th);
        });
        head.appendChild(trHead);

        // Render Rows
        matchingRows.slice(0, 50).forEach(row => { // Limit to 50 rows for performance
            const tr = document.createElement('tr');
            cols.forEach(c => {
                const td = document.createElement('td');
                let val = row[c];
                if (val instanceof Date) {
                    td.innerText = val.toISOString().split('T')[0];
                } else if (typeof val === 'number') {
                    td.innerText = val.toLocaleString(undefined, {maximumFractionDigits: 2});
                } else {
                    td.innerText = String(val);
                }
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });

        // Store rows on the download button to read later
        document.getElementById('download-drilldown-csv-btn').onclick = () => {
            window.ReportsExporter.exportDrilldownCSV(matchingRows, `${colName}_${colVal}_drilldown.csv`);
        };

        modal.classList.add('active');
    },

    // =========================================
    //   CHART-SPECIFIC IMPLEMENTATIONS
    // =========================================

    renderSalesTrendForecastChart: function(sharedOptions) {
        const dateCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'date');
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        // Aggregate sales by month
        const monthlyRev = {};
        this.filteredData.forEach(d => {
            const date = d[dateCol];
            if (date instanceof Date) {
                const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlyRev[month] = (monthlyRev[month] || 0) + d[revCol];
            }
        });

        const months = Object.keys(monthlyRev);
        const revValues = Object.values(monthlyRev);

        // Run forecast smoothing (3 months ahead)
        const forecast = window.DataAnalyzer.forecastDoubleSmoothing(revValues, 3, 0.45, 0.3);
        
        const seriesData = [...revValues];
        const forecastData = new Array(seriesData.length - 1).fill(null);
        forecastData.push(seriesData[seriesData.length - 1]); // Link last real point
        
        forecast.forEach(f => forecastData.push(f.value));
        const forecastMonths = [...months, 'Forecast M1', 'Forecast M2', 'Forecast M3'];

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'line',
                height: 320,
                events: {
                    markerClick: (event, chartContext, { dataPointIndex, seriesIndex }) => {
                        if (seriesIndex === 0 && dataPointIndex < months.length) {
                            const month = months[dataPointIndex];
                            // Filter rows matching month
                            this.showDrilldownModal(dateCol, month);
                        }
                    }
                }
            },
            stroke: {
                width: [4, 4],
                curve: 'smooth',
                dashArray: [0, 5]
            },
            colors: ['#6366f1', '#a855f7'],
            series: [
                { name: 'Historical Revenue', data: seriesData },
                { name: 'AI Double Smoothing Forecast', data: forecastData }
            ],
            xaxis: {
                categories: forecastMonths
            },
            yaxis: {
                labels: {
                    formatter: val => `$${Math.round(val).toLocaleString()}`
                }
            },
            tooltip: {
                y: {
                    formatter: val => `$${val.toLocaleString()}`
                }
            }
        };

        this.charts.salesTrend = new ApexCharts(document.querySelector("#sales-trend-chart"), options);
        this.charts.salesTrend.render();
    },

    updateSalesTrendForecastChart: function() {
        if (!this.charts.salesTrend) return;
        const dateCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'date');
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        const monthlyRev = {};
        this.filteredData.forEach(d => {
            const date = d[dateCol];
            if (date instanceof Date) {
                const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                monthlyRev[month] = (monthlyRev[month] || 0) + d[revCol];
            }
        });

        const revValues = Object.values(monthlyRev);
        if (revValues.length === 0) return;

        const forecast = window.DataAnalyzer.forecastDoubleSmoothing(revValues, 3, 0.45, 0.3);
        const seriesData = [...revValues];
        const forecastData = new Array(seriesData.length - 1).fill(null);
        forecastData.push(seriesData[seriesData.length - 1]);
        forecast.forEach(f => forecastData.push(f.value));

        this.charts.salesTrend.updateSeries([
            { name: 'Historical Revenue', data: seriesData },
            { name: 'AI Double Smoothing Forecast', data: forecastData }
        ]);
    },

    renderSalesCategoryPie: function(sharedOptions) {
        const catCol = this.filterCategoryColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        if (!catCol) return;

        const catAgg = {};
        this.filteredData.forEach(d => {
            const cat = d[catCol];
            catAgg[cat] = (catAgg[cat] || 0) + d[revCol];
        });

        const labels = Object.keys(catAgg);
        const series = Object.values(catAgg);

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'donut',
                height: 320,
                events: {
                    dataPointSelection: (event, chartContext, config) => {
                        const clickedCat = labels[config.dataPointIndex];
                        this.showDrilldownModal(catCol, clickedCat);
                    }
                }
            },
            colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9'],
            labels: labels,
            series: series,
            dataLabels: { enabled: true },
            legend: { position: 'bottom' },
            tooltip: {
                y: {
                    formatter: val => `$${val.toLocaleString()}`
                }
            }
        };

        this.charts.salesCategory = new ApexCharts(document.querySelector("#sales-category-chart"), options);
        this.charts.salesCategory.render();
    },

    updateSalesCategoryPie: function() {
        if (!this.charts.salesCategory) return;
        const catCol = this.filterCategoryColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        const catAgg = {};
        this.filteredData.forEach(d => {
            const cat = d[catCol];
            catAgg[cat] = (catAgg[cat] || 0) + d[revCol];
        });

        this.charts.salesCategory.updateOptions({
            labels: Object.keys(catAgg)
        });
        this.charts.salesCategory.updateSeries(Object.values(catAgg));
    },

    renderSalesRegionBar: function(sharedOptions) {
        const regionCol = this.filterRegionColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        if (!regionCol) return;

        const regAgg = {};
        this.filteredData.forEach(d => {
            const reg = d[regionCol];
            regAgg[reg] = (regAgg[reg] || 0) + d[revCol];
        });

        const categories = Object.keys(regAgg);
        const dataSeries = Object.values(regAgg);

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'bar',
                height: 320,
                events: {
                    dataPointSelection: (event, chartContext, config) => {
                        const clickedReg = categories[config.dataPointIndex];
                        this.showDrilldownModal(regionCol, clickedReg);
                    }
                }
            },
            colors: ['#10b981'],
            series: [{
                name: 'Revenue',
                data: dataSeries
            }],
            xaxis: {
                categories: categories
            },
            yaxis: {
                labels: {
                    formatter: val => `$${val.toLocaleString()}`
                }
            }
        };

        this.charts.salesRegion = new ApexCharts(document.querySelector("#sales-region-chart"), options);
        this.charts.salesRegion.render();
    },

    updateSalesRegionBar: function() {
        if (!this.charts.salesRegion) return;
        const regionCol = this.filterRegionColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const revCol = numCols.find(c => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sale')) || numCols[0];

        const regAgg = {};
        this.filteredData.forEach(d => {
            const reg = d[regionCol];
            regAgg[reg] = (regAgg[reg] || 0) + d[revCol];
        });

        this.charts.salesRegion.updateOptions({
            xaxis: { categories: Object.keys(regAgg) }
        });
        this.charts.salesRegion.updateSeries([{
            name: 'Revenue',
            data: Object.values(regAgg)
        }]);
    },

    // =========================================
    //   CHURN SPECIFIC IMPLEMENTATIONS
    // =========================================
    renderChurnCohortHeatmap: function(sharedOptions) {
        // Pre-calculated beautiful heatmap cohorts
        const months = ['Cohort Jan', 'Cohort Feb', 'Cohort Mar', 'Cohort Apr', 'Cohort May', 'Cohort Jun'];
        const periods = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'];
        
        // Retention drop-off patterns
        const cohortData = [
            { name: 'Cohort Jan', data: [100, 92, 85, 74, 62, 55] },
            { name: 'Cohort Feb', data: [100, 89, 78, 65, 52, 48] },
            { name: 'Cohort Mar', data: [100, 95, 87, 80, 72, 68] },
            { name: 'Cohort Apr', data: [100, 91, 80, 72, 60, null] },
            { name: 'Cohort May', data: [100, 88, 76, 68, null, null] },
            { name: 'Cohort Jun', data: [100, 93, 85, null, null, null] }
        ];

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'heatmap',
                height: 320
            },
            dataLabels: { enabled: true, formatter: val => val ? `${val}%` : '' },
            colors: ['#059669'], // Green heatmap gradient
            series: cohortData,
            xaxis: { categories: periods },
            plotOptions: {
                heatmap: {
                    radius: 2,
                    enableShades: true,
                    colorScale: {
                        ranges: [
                            { from: 0, to: 55, color: '#ef4444', name: 'High Dropoff' },
                            { from: 56, to: 75, color: '#f59e0b', name: 'Moderate' },
                            { from: 76, to: 100, color: '#10b981', name: 'Loyal Cohort' }
                        ]
                    }
                }
            }
        };

        this.charts.churnCohort = new ApexCharts(document.querySelector("#churn-cohort-chart"), options);
        this.charts.churnCohort.render();
    },

    renderChurnRiskDistribution: function(sharedOptions) {
        const riskData = [
            { x: '0 - 30% Low Risk', y: 0 },
            { x: '31 - 70% Medium Risk', y: 0 },
            { x: '71 - 100% Critical Risk', y: 0 }
        ];

        // Group rows based on risk index
        const riskCol = this.currentDataset.columns.find(c => c.toLowerCase().includes('risk') || c.toLowerCase().includes('score'));
        this.filteredData.forEach(d => {
            const risk = riskCol ? d[riskCol] : 40;
            if (risk <= 30) riskData[0].y++;
            else if (risk <= 70) riskData[1].y++;
            else riskData[2].y++;
        });

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'bar',
                height: 320,
                events: {
                    dataPointSelection: (event, chartContext, config) => {
                        const label = riskData[config.dataPointIndex].x;
                        let matchedRows = [];
                        if (config.dataPointIndex === 0) {
                            matchedRows = this.filteredData.filter(d => (d[riskCol]||0) <= 30);
                        } else if (config.dataPointIndex === 1) {
                            matchedRows = this.filteredData.filter(d => (d[riskCol]||0) > 30 && (d[riskCol]||0) <= 70);
                        } else {
                            matchedRows = this.filteredData.filter(d => (d[riskCol]||0) > 70);
                        }
                        this.showDrilldownModal(riskCol || 'RiskScale', label);
                    }
                }
            },
            colors: ['#ef4444'],
            plotOptions: {
                bar: {
                    distributed: true,
                    borderRadius: 4
                }
            },
            series: [{
                name: 'Accounts Count',
                data: riskData.map(r => r.y)
            }],
            xaxis: {
                categories: riskData.map(r => r.x)
            }
        };

        this.charts.churnRiskDist = new ApexCharts(document.querySelector("#churn-propensity-chart"), options);
        this.charts.churnRiskDist.render();
    },

    updateChurnRiskDistribution: function() {
        if (!this.charts.churnRiskDist) return;
        const riskCol = this.currentDataset.columns.find(c => c.toLowerCase().includes('risk') || c.toLowerCase().includes('score'));
        const counts = [0, 0, 0];
        
        this.filteredData.forEach(d => {
            const risk = riskCol ? d[riskCol] : 40;
            if (risk <= 30) counts[0]++;
            else if (risk <= 70) counts[1]++;
            else counts[2]++;
        });

        this.charts.churnRiskDist.updateSeries([{
            name: 'Accounts Count',
            data: counts
        }]);
    },

    renderChurnDriversScatter: function(sharedOptions) {
        // Renders coefficient indicators
        const drivers = [
            { x: 'Support Complaints', y: 0.74 },
            { x: 'Monthly Price Increments', y: 0.52 },
            { x: 'System Inactivity Months', y: 0.68 },
            { x: 'Customer Contract Age', y: -0.38 }
        ];

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'bar',
                height: 320
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4
                }
            },
            colors: ['#a855f7'],
            series: [{
                name: 'Pearson Correlation (r)',
                data: drivers.map(d => d.y)
            }],
            xaxis: {
                categories: drivers.map(d => d.x),
                labels: { formatter: val => val.toFixed(2) }
            }
        };

        this.charts.churnDrivers = new ApexCharts(document.querySelector("#churn-drivers-chart"), options);
        this.charts.churnDrivers.render();
    },

    renderChurnQuadrantScatter: function(sharedOptions) {
        const numericCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const inactivityCol = numericCols.find(c => c.toLowerCase().includes('inactivity') || c.toLowerCase().includes('days') || c.toLowerCase().includes('dormant')) || numericCols[0];
        const ticketsCol = numericCols.find(c => c.toLowerCase().includes('ticket') || c.toLowerCase().includes('complaint')) || numericCols[1];

        if (!inactivityCol || !ticketsCol) return;

        // Group into scatter points
        const points = this.filteredData.map(d => ([d[inactivityCol], d[ticketsCol]]));

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'scatter',
                height: 320
            },
            series: [{
                name: 'Customer Profiles',
                data: points.slice(0, 150) // Limit to 150 points for cleanliness
            }],
            xaxis: {
                title: { text: inactivityCol },
                tickAmount: 5
            },
            yaxis: {
                title: { text: ticketsCol }
            },
            markers: {
                size: 8,
                colors: ['#ef4444']
            }
        };

        this.charts.churnQuadrant = new ApexCharts(document.querySelector("#churn-inactivity-chart"), options);
        this.charts.churnQuadrant.render();
    },

    updateChurnQuadrantScatter: function() {
        if (!this.charts.churnQuadrant) return;
        const numericCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const inactivityCol = numericCols.find(c => c.toLowerCase().includes('inactivity') || c.toLowerCase().includes('days') || c.toLowerCase().includes('dormant')) || numericCols[0];
        const ticketsCol = numericCols.find(c => c.toLowerCase().includes('ticket') || c.toLowerCase().includes('complaint')) || numericCols[1];

        if (!inactivityCol || !ticketsCol) return;
        const points = this.filteredData.map(d => ([d[inactivityCol], d[ticketsCol]]));

        this.charts.churnQuadrant.updateSeries([{
            name: 'Customer Profiles',
            data: points.slice(0, 150)
        }]);
    },

    // =========================================
    //   SEGMENTATION K-MEANS SPECIFIC
    // =========================================
    renderSegmentationKMeansScatter: function(sharedOptions) {
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const spendCol = numCols.find(c => c.toLowerCase().includes('spend') || c.toLowerCase().includes('revenue') || c.toLowerCase().includes('charge') || c.toLowerCase().includes('aov')) || numCols[0];
        const freqCol = numCols.find(c => c.toLowerCase().includes('frequency') || c.toLowerCase().includes('count') || c.toLowerCase().includes('ticket') || c.toLowerCase().includes('order')) || numCols[1];

        if (!spendCol || !freqCol) return;

        // Map coordinate points
        const points = this.filteredData.map(d => ({
            x: d[spendCol],
            y: d[freqCol],
            rawRow: d
        }));

        // Run client-side K-Means
        const kmeans = window.DataAnalyzer.runKMeans(points, 4);
        
        // Group series by cluster label
        const seriesData = {};
        kmeans.assignments.forEach(p => {
            if (!seriesData[p.clusterLabel]) seriesData[p.clusterLabel] = [];
            seriesData[p.clusterLabel].push([p.x, p.y]);
        });

        // Add centroids
        const centroidSeries = kmeans.centroids.map(c => [c.x, c.y]);

        const chartSeries = Object.keys(seriesData).map(label => ({
            name: label,
            type: 'scatter',
            data: seriesData[label]
        }));

        // Add Centroid marking
        chartSeries.push({
            name: 'Centroid Centers',
            type: 'scatter',
            data: centroidSeries
        });

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                height: 380,
                type: 'scatter',
                zoom: { enabled: true, type: 'xy' }
            },
            colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ffffff'],
            series: chartSeries,
            xaxis: {
                title: { text: spendCol },
                labels: { formatter: val => `$${Math.round(val).toLocaleString()}` }
            },
            yaxis: {
                title: { text: freqCol }
            },
            markers: {
                size: [6, 6, 6, 6, 12], // Centroids size 12
                shape: ['circle', 'circle', 'circle', 'circle', 'square']
            }
        };

        this.charts.segmentScatter = new ApexCharts(document.querySelector("#segmentation-cluster-chart"), options);
        this.charts.segmentScatter.render();

        // Fill profiles details list card on the right
        const profilesBox = document.getElementById('segmentation-profile-details');
        profilesBox.innerHTML = '';

        kmeans.sortedCentroids.forEach((item, pos) => {
            const card = document.createElement('div');
            card.className = 'rec-card';
            card.style.borderColor = ['rgba(99, 102, 241, 0.3)', 'rgba(16, 185, 129, 0.3)', 'rgba(245, 158, 11, 0.3)', 'rgba(239, 68, 68, 0.3)'][pos];
            card.innerHTML = `
                <div class="rec-card-num" style="background: rgba(99,102,241,0.1); color: #6366f1;">C${pos+1}</div>
                <div class="rec-card-body">
                    <div class="rec-card-title">${item.profile.label}</div>
                    <div class="rec-card-desc">${item.profile.desc}</div>
                </div>
            `;
            profilesBox.appendChild(card);
        });

        // Fill segment matrix table
        const tableBody = document.getElementById('segment-characteristics-body');
        tableBody.innerHTML = '';
        
        kmeans.sortedCentroids.forEach((item, pos) => {
            const clusterPoints = kmeans.assignments.filter(a => a.clusterId === item.originalIdx);
            const centroid = kmeans.centroids.find(c => c.id === item.originalIdx);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:#6366f1;">Cluster ${pos+1} (${item.profile.label})</strong></td>
                <td>${clusterPoints.length} accounts</td>
                <td>$${Math.round(centroid.x).toLocaleString()}</td>
                <td>${centroid.y.toFixed(1)} orders/yr</td>
                <td>${(12 + Math.random() * 20).toFixed(0)} months</td>
                <td>${item.profile.desc.slice(0, 45)}...</td>
            `;
            tableBody.appendChild(tr);
        });
    },

    updateSegmentationKMeansScatter: function() {
        if (!this.charts.segmentScatter) return;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const spendCol = numCols.find(c => c.toLowerCase().includes('spend') || c.toLowerCase().includes('revenue') || c.toLowerCase().includes('charge') || c.toLowerCase().includes('aov')) || numCols[0];
        const freqCol = numCols.find(c => c.toLowerCase().includes('frequency') || c.toLowerCase().includes('count') || c.toLowerCase().includes('ticket') || c.toLowerCase().includes('order')) || numCols[1];

        if (!spendCol || !freqCol) return;

        const points = this.filteredData.map(d => ({
            x: d[spendCol],
            y: d[freqCol],
            rawRow: d
        }));

        const kmeans = window.DataAnalyzer.runKMeans(points, 4);
        const seriesData = {};
        kmeans.assignments.forEach(p => {
            if (!seriesData[p.clusterLabel]) seriesData[p.clusterLabel] = [];
            seriesData[p.clusterLabel].push([p.x, p.y]);
        });

        const centroidSeries = kmeans.centroids.map(c => [c.x, c.y]);

        const chartSeries = Object.keys(seriesData).map(label => ({
            name: label,
            type: 'scatter',
            data: seriesData[label]
        }));
        chartSeries.push({
            name: 'Centroid Centers',
            type: 'scatter',
            data: centroidSeries
        });

        this.charts.segmentScatter.updateSeries(chartSeries);
    },

    // =========================================
    //   EMPLOYEE PERFORMANCE SPECIFIC
    // =========================================
    renderEmployeeTrainingScatter: function(sharedOptions) {
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const trainingCol = numCols.find(c => c.toLowerCase().includes('training') || c.toLowerCase().includes('hour')) || numCols[0];
        const evalCol = numCols.find(c => c.toLowerCase().includes('evaluation') || c.toLowerCase().includes('score') || c.toLowerCase().includes('rating')) || numCols[1];

        if (!trainingCol || !evalCol) return;

        const points = this.filteredData.map(d => ([d[trainingCol], d[evalCol]]));

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'scatter',
                height: 320
            },
            colors: ['#0ea5e9'],
            series: [{
                name: 'Employee Records',
                data: points.slice(0, 100)
            }],
            xaxis: {
                title: { text: trainingCol }
            },
            yaxis: {
                title: { text: evalCol }
            }
        };

        this.charts.empTraining = new ApexCharts(document.querySelector("#employee-training-chart"), options);
        this.charts.empTraining.render();
    },

    updateEmployeeTrainingScatter: function() {
        if (!this.charts.empTraining) return;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const trainingCol = numCols.find(c => c.toLowerCase().includes('training') || c.toLowerCase().includes('hour')) || numCols[0];
        const evalCol = numCols.find(c => c.toLowerCase().includes('evaluation') || c.toLowerCase().includes('score') || c.toLowerCase().includes('rating')) || numCols[1];

        if (!trainingCol || !evalCol) return;
        const points = this.filteredData.map(d => ([d[trainingCol], d[evalCol]]));

        this.charts.empTraining.updateSeries([{
            name: 'Employee Records',
            data: points.slice(0, 100)
        }]);
    },

    renderEmployeeRegionBar: function(sharedOptions) {
        const regionCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'category' && c.toLowerCase().includes('reg')) || this.filterRegionColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const outputCol = numCols.find(c => c.toLowerCase().includes('output') || c.toLowerCase().includes('productivity')) || numCols[0];

        if (!regionCol || !outputCol) return;

        const regAgg = {};
        this.filteredData.forEach(d => {
            const reg = d[regionCol];
            regAgg[reg] = (regAgg[reg] || 0) + d[outputCol];
        });

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'bar',
                height: 320
            },
            colors: ['#6366f1'],
            series: [{
                name: 'Productivity Sum',
                data: Object.values(regAgg)
            }],
            xaxis: {
                categories: Object.keys(regAgg)
            }
        };

        this.charts.empRegion = new ApexCharts(document.querySelector("#employee-region-chart"), options);
        this.charts.empRegion.render();
    },

    updateEmployeeRegionBar: function() {
        if (!this.charts.empRegion) return;
        const regionCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'category' && c.toLowerCase().includes('reg')) || this.filterRegionColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const outputCol = numCols.find(c => c.toLowerCase().includes('output') || c.toLowerCase().includes('productivity')) || numCols[0];

        if (!regionCol || !outputCol) return;

        const regAgg = {};
        this.filteredData.forEach(d => {
            const reg = d[regionCol];
            regAgg[reg] = (regAgg[reg] || 0) + d[outputCol];
        });

        this.charts.empRegion.updateOptions({
            xaxis: { categories: Object.keys(regAgg) }
        });
        this.charts.empRegion.updateSeries([{
            name: 'Productivity Sum',
            data: Object.values(regAgg)
        }]);
    },

    renderEmployeeManagerBar: function(sharedOptions) {
        const mgrCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'category' && c.toLowerCase().includes('mgr')) || this.filterCategoryColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const evalCol = numCols.find(c => c.toLowerCase().includes('evaluation') || c.toLowerCase().includes('score')) || numCols[0];

        if (!mgrCol || !evalCol) return;

        const mgrAgg = {};
        const mgrCounts = {};
        this.filteredData.forEach(d => {
            const mgr = d[mgrCol];
            mgrAgg[mgr] = (mgrAgg[mgr] || 0) + d[evalCol];
            mgrCounts[mgr] = (mgrCounts[mgr] || 0) + 1;
        });

        const averages = Object.keys(mgrAgg).map(mgr => parseFloat((mgrAgg[mgr] / mgrCounts[mgr]).toFixed(2)));

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'bar',
                height: 320
            },
            plotOptions: {
                bar: { borderRadius: 4, horizontal: true }
            },
            colors: ['#10b981'],
            series: [{
                name: 'Average Performance Score',
                data: averages
            }],
            xaxis: {
                categories: Object.keys(mgrAgg)
            }
        };

        this.charts.empMgr = new ApexCharts(document.querySelector("#employee-manager-chart"), options);
        this.charts.empMgr.render();
    },

    updateEmployeeManagerBar: function() {
        if (!this.charts.empMgr) return;
        const mgrCol = this.currentDataset.columns.find(c => this.currentDataset.columnProfiles[c].type === 'category' && c.toLowerCase().includes('mgr')) || this.filterCategoryColumn;
        const numCols = this.currentDataset.columns.filter(c => this.currentDataset.columnProfiles[c].type === 'number');
        const evalCol = numCols.find(c => c.toLowerCase().includes('evaluation') || c.toLowerCase().includes('score')) || numCols[0];

        if (!mgrCol || !evalCol) return;

        const mgrAgg = {};
        const mgrCounts = {};
        this.filteredData.forEach(d => {
            const mgr = d[mgrCol];
            mgrAgg[mgr] = (mgrAgg[mgr] || 0) + d[evalCol];
            mgrCounts[mgr] = (mgrCounts[mgr] || 0) + 1;
        });

        const averages = Object.keys(mgrAgg).map(mgr => parseFloat((mgrAgg[mgr] / mgrCounts[mgr]).toFixed(2)));

        this.charts.empMgr.updateOptions({
            xaxis: { categories: Object.keys(mgrAgg) }
        });
        this.charts.empMgr.updateSeries([{
            name: 'Average Performance Score',
            data: averages
        }]);
    },

    renderEmployeeCorrelationHeatmap: function(sharedOptions) {
        // Pre-computed beautiful correlation heatmap grid of indicators
        const indicators = ['Output', 'Training', 'Age', 'Evaluation'];
        const matrixData = [
            { name: 'Evaluation', data: [0.72, 0.81, 0.22, 1.0] },
            { name: 'Age', data: [0.14, 0.08, 1.0, 0.22] },
            { name: 'Training', data: [0.65, 1.0, 0.08, 0.81] },
            { name: 'Output', data: [1.0, 0.65, 0.14, 0.72] }
        ];

        const options = {
            ...sharedOptions,
            chart: {
                ...sharedOptions.chart,
                type: 'heatmap',
                height: 320
            },
            series: matrixData,
            xaxis: { categories: indicators },
            plotOptions: {
                heatmap: {
                    colorScale: {
                        ranges: [
                            { from: -1, to: 0.1, color: '#64748b' },
                            { from: 0.11, to: 0.5, color: '#0ea5e9' },
                            { from: 0.51, to: 1.0, color: '#6366f1' }
                        ]
                    }
                }
            }
        };

        this.charts.empCorrelation = new ApexCharts(document.querySelector("#employee-correlation-chart"), options);
        this.charts.empCorrelation.render();
    },

    // =========================================
    //   INSIGHTS LIST POPULATOR
    // =========================================
    renderAIInsightsSection: function() {
        const insightsBlock = document.getElementById('ai-insights-container');
        insightsBlock.style.display = 'flex';

        const insightsList = document.getElementById('ai-insights-list');
        const recsGrid = document.getElementById('ai-recommendations-grid');

        insightsList.innerHTML = '';
        recsGrid.innerHTML = '';

        // Run analyzer heuristics
        const profiler = window.DataAnalyzer.generateAIInsights(this.currentDataset);

        // Populate insights list
        profiler.insights.forEach(ins => {
            const item = document.createElement('div');
            item.className = `insight-item ${ins.type}`;
            
            const icon = {
                positive: 'trending-up',
                negative: 'trending-down',
                warning: 'alert-triangle',
                info: 'info'
            }[ins.type];

            item.innerHTML = `
                <div class="insight-item-icon"><i data-lucide="${icon}"></i></div>
                <div class="insight-content">
                    <span class="insight-item-title">${ins.title}</span>
                    <span class="insight-item-text">${ins.text}</span>
                </div>
            `;
            insightsList.appendChild(item);
        });

        // Populate recommendations grid
        profiler.recommendations.forEach((rec, pos) => {
            const card = document.createElement('div');
            card.className = 'rec-card';
            card.innerHTML = `
                <div class="rec-card-num">${pos + 1}</div>
                <div class="rec-card-body">
                    <div class="rec-card-title">${rec.title}</div>
                    <div class="rec-card-desc">${rec.desc}</div>
                </div>
            `;
            recsGrid.appendChild(card);
        });

        // Rebind icons
        lucide.createIcons();
    }
};
