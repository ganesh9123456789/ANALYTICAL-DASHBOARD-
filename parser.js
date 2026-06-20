/**
 * =========================================
 *   DATA PARSER & PROFILER UTILITY
 *   Client-Side File Parsing & Sanitization
 * =========================================
 */

window.DataParser = {
    
    /**
     * Parses a CSV file using PapaParse
     * @param {File} file 
     * @returns {Promise<Object>} parsed records and structure
     */
    parseCSV: function(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: 'greedy',
                complete: (results) => {
                    if (results.errors && results.errors.length > 0 && results.data.length === 0) {
                        reject(new Error("Failed to parse CSV: " + results.errors[0].message));
                    } else {
                        const cleanData = this.cleanAndProfileDataset(results.data, file.name);
                        resolve(cleanData);
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    },

    /**
     * Parses an Excel spreadsheet using SheetJS (XLSX)
     * @param {File} file 
     * @returns {Promise<Object>} parsed records and structure
     */
    parseExcel: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    
                    // Parse the first sheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                    
                    if (jsonData.length === 0) {
                        reject(new Error("The Excel worksheet appears to be empty."));
                    } else {
                        const cleanData = this.cleanAndProfileDataset(jsonData, file.name);
                        resolve(cleanData);
                    }
                } catch (error) {
                    reject(new Error("Failed to parse Excel: " + error.message));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Parses a JSON data file
     * @param {File} file 
     * @returns {Promise<Object>} parsed records and structure
     */
    parseJSON: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let jsonData = JSON.parse(e.target.result);
                    
                    // If JSON is wrapped in a root property
                    if (!Array.isArray(jsonData)) {
                        const arrays = Object.values(jsonData).filter(val => Array.isArray(val));
                        if (arrays.length > 0) {
                            jsonData = arrays[0]; // Choose first array found
                        } else {
                            jsonData = [jsonData]; // Wrap single object
                        }
                    }
                    
                    if (jsonData.length === 0) {
                        reject(new Error("The JSON dataset is empty."));
                    } else {
                        const cleanData = this.cleanAndProfileDataset(jsonData, file.name);
                        resolve(cleanData);
                    }
                } catch (error) {
                    reject(new Error("Failed to parse JSON: " + error.message));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    },

    /**
     * Identifies column types, handles missing records, and structures metadata
     * @param {Array} rawData 
     * @param {string} fileName 
     * @returns {Object} cleaned data and metadata profile
     */
    cleanAndProfileDataset: function(rawData, fileName) {
        if (!rawData || rawData.length === 0) return null;
        
        // Identify all columns
        const columns = Object.keys(rawData[0]).filter(k => k !== null && k !== '');
        const rowCount = rawData.length;
        
        // Profiles container
        const columnProfiles = {};
        const cleanedData = [];
        let globalMissingValuesCount = 0;

        // Sniff Data Types per Column
        columns.forEach(col => {
            let numericHits = 0;
            let temporalHits = 0;
            let validValuesCount = 0;
            let missingValuesCount = 0;
            const uniqueValues = new Set();
            let sum = 0;
            let min = Infinity;
            let max = -Infinity;
            const samples = [];
            
            // Check first 200 rows or total rows
            const sampleLimit = Math.min(rowCount, 200);
            for (let i = 0; i < sampleLimit; i++) {
                const val = rawData[i][col];
                if (val === null || val === undefined || val === '') {
                    continue;
                }
                
                validValuesCount++;
                const stringVal = String(val).trim();
                uniqueValues.add(stringVal);
                
                // 1. Sniff Numeric (Allows currency signs, commas, percentages)
                const cleanNumStr = stringVal.replace(/[\$,€,£,%,]/g, '');
                if (cleanNumStr !== '' && !isNaN(Number(cleanNumStr))) {
                    numericHits++;
                }

                // 2. Sniff Date/Time formats (Regex)
                const isDate = this.isDateString(stringVal);
                if (isDate || val instanceof Date) {
                    temporalHits++;
                }
            }

            // Determine final Type
            let finalType = 'string';
            if (numericHits / validValuesCount > 0.7) {
                finalType = 'number';
            } else if (temporalHits / validValuesCount > 0.7) {
                finalType = 'date';
            }

            // High or Low cardinality check for categorical mapping
            const sampleCardinalityRatio = uniqueValues.size / Math.max(validValuesCount, 1);
            if (finalType === 'string' && (uniqueValues.size < 25 || sampleCardinalityRatio < 0.15)) {
                finalType = 'category';
            }

            // Pre-calculate full column indicators (clean & aggregate)
            columnProfiles[col] = {
                name: col,
                type: finalType,
                missingCount: 0,
                distinctCount: 0,
                mean: 0,
                min: null,
                max: null,
                categories: []
            };
        });

        // Loop through all data rows to Clean and Profile fully
        rawData.forEach((row, rowIndex) => {
            const cleanRow = { ...row };
            
            columns.forEach(col => {
                let val = cleanRow[col];
                const profile = columnProfiles[col];
                
                // Flag missing values
                if (val === null || val === undefined || val === '') {
                    profile.missingCount++;
                    globalMissingValuesCount++;
                    
                    // Fill missing values (Imputation logic)
                    if (profile.type === 'number') {
                        val = 0; // Default fill for numbers
                    } else if (profile.type === 'category') {
                        val = 'Unknown';
                    } else if (profile.type === 'date') {
                        val = new Date().toISOString().split('T')[0]; // Default today
                    } else {
                        val = '';
                    }
                }

                // Perform clean cast based on profile types
                if (profile.type === 'number') {
                    if (typeof val === 'string') {
                        val = Number(String(val).replace(/[\$,€,£,%,]/g, ''));
                    } else {
                        val = Number(val);
                    }
                    if (isNaN(val)) val = 0;
                } else if (profile.type === 'date') {
                    if (!(val instanceof Date)) {
                        const parsedDate = new Date(val);
                        val = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
                    }
                } else {
                    val = String(val).trim();
                }

                cleanRow[col] = val;
            });
            cleanedData.push(cleanRow);
        });

        // Perform final statistical aggregations for numerical & category columns
        columns.forEach(col => {
            const profile = columnProfiles[col];
            const uniqueSet = new Set();
            let sum = 0;
            let min = Infinity;
            let max = -Infinity;
            const categoryFrequencies = {};

            cleanedData.forEach(row => {
                const val = row[col];
                
                if (profile.type === 'number') {
                    sum += val;
                    if (val < min) min = val;
                    if (val > max) max = val;
                } else if (profile.type === 'date') {
                    const time = val.getTime();
                    if (time < min) min = time;
                    if (time > max) max = time;
                } else {
                    uniqueSet.add(val);
                    categoryFrequencies[val] = (categoryFrequencies[val] || 0) + 1;
                }
            });

            profile.distinctCount = (profile.type === 'number' || profile.type === 'date') ? rowCount : uniqueSet.size;
            
            if (profile.type === 'number') {
                profile.mean = rowCount > 0 ? (sum / rowCount) : 0;
                profile.min = min === Infinity ? 0 : min;
                profile.max = max === -Infinity ? 0 : max;
                profile.sum = sum;
            } else if (profile.type === 'date') {
                profile.min = min === Infinity ? new Date() : new Date(min);
                profile.max = max === -Infinity ? new Date() : new Date(max);
            } else {
                // Sort categories by frequency
                profile.categories = Object.keys(categoryFrequencies).map(cat => ({
                    name: cat,
                    count: categoryFrequencies[cat]
                })).sort((a,b) => b.count - a.count);
            }
        });

        // Attempt to determine the standard domain type of the file based on columns
        let suggestedAnalysisType = 'Sales Trend Analysis';
        const colNamesLower = columns.map(c => c.toLowerCase());
        
        if (colNamesLower.some(c => c.includes('churn') || c.includes('retention') || c.includes('inactivity') || c.includes('support'))) {
            suggestedAnalysisType = 'Customer Churn Analysis';
        } else if (colNamesLower.some(c => c.includes('segment') || c.includes('cluster') || (c.includes('expenditure') && c.includes('frequency')))) {
            suggestedAnalysisType = 'Customer Segmentation';
        } else if (colNamesLower.some(c => c.includes('employee') || c.includes('productivity') || c.includes('salary') || c.includes('evaluation'))) {
            suggestedAnalysisType = 'Employee Performance Analysis';
        }

        return {
            fileName: fileName,
            rowCount: rowCount,
            columnProfiles: columnProfiles,
            columns: columns,
            data: cleanedData,
            missingValuesCount: globalMissingValuesCount,
            suggestedAnalysis: suggestedAnalysisType
        };
    },

    /**
     * Checks if a string string matches typical date patterns
     * @param {string} str 
     * @returns {boolean}
     */
    isDateString: function(str) {
        if (!str || str.length < 5 || str.length > 35) return false;
        
        // Match formats: YYYY-MM-DD, MM/DD/YYYY, YYYY/MM/DD, ISO timestamps
        const patterns = [
            /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/, // 2026-05-31 or 2026/05/31
            /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/, // 05/31/2026 or 31-05-2026
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO
            /^[A-Z][a-z]{2}\s\d{1,2},\s\d{4}$/ // May 31, 2026
        ];

        return patterns.some(regex => regex.test(str));
    }
};
