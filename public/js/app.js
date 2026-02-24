// Arugga 5-Year Budget — App Controller
// Version + Scenario management with localStorage persistence
// Excel-like contenteditable tables with paste support

(function () {
  const STORAGE_KEY = 'arugga_budget_versions';
  const ACTIVE_KEY = 'arugga_active_version';
  const SCENARIO_KEY = 'arugga_active_scenario';

  let currentAssumptions = null;
  let versions = {};
  let activeVersionKey = null;
  let activeScenario = 'base'; // 'base' | 'worst' | 'best'

  const SCENARIO_NAMES = { base: 'Base Case', worst: 'Worst Case', best: 'Best Case' };

  // ====== Cell value helpers ======
  function parseCellValue(text) {
    return parseFloat(String(text).replace(/[,$%\s]/g, '').trim()) || 0;
  }

  function formatCellValue(val) {
    if (val === 0) return '0';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    if (Number.isInteger(n)) return n.toLocaleString('en-US');
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // ====== localStorage persistence ======
  function saveAllVersions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
      localStorage.setItem(ACTIVE_KEY, activeVersionKey);
      localStorage.setItem(SCENARIO_KEY, activeScenario);
    } catch (e) {
      console.warn('Failed to save versions:', e);
    }
  }

  function emptyScenarios() {
    return { base: null, worst: null, best: null };
  }

  function loadAllVersions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        versions = JSON.parse(raw);
        activeVersionKey = localStorage.getItem(ACTIVE_KEY);
        activeScenario = localStorage.getItem(SCENARIO_KEY) || 'base';
        for (const key in versions) {
          const v = versions[key];
          // Migrate: add scenarios if missing
          if (!v.scenarios) {
            v.scenarios = emptyScenarios();
          }
          // Migrate scalar salesPct/leasingPct in assumptions and scenarios
          migrateAssumptions(v.assumptions);
          for (const s of ['base', 'worst', 'best']) {
            if (v.scenarios[s]) migrateAssumptions(v.scenarios[s]);
          }
        }
        return true;
      }
    } catch (e) {
      console.warn('Failed to load versions:', e);
    }
    return false;
  }

  function migrateAssumptions(a) {
    if (!a) return;
    if (typeof a.salesPct === 'number') {
      var s = a.salesPct;
      var l = a.leasingPct;
      a.salesPct = new Array(NUM_YEARS).fill(s);
      a.leasingPct = new Array(NUM_YEARS).fill(l);
    }
    // Add tech support fields if missing
    if (!a.sparePartsPerRobot) {
      a.sparePartsPerRobot = new Array(NUM_YEARS).fill(50);
    }
    if (!a.subcontractorCostPerRobot) {
      a.subcontractorCostPerRobot = new Array(NUM_YEARS).fill(200);
    }
    // Migrate creditFacilityLimit → cressonCreditFacility + bankLineOfCredit
    if (!a.cressonCreditFacility) {
      if (a.creditFacilityLimit) {
        a.cressonCreditFacility = a.creditFacilityLimit.slice();
      } else {
        a.cressonCreditFacility = new Array(NUM_YEARS).fill(0);
      }
    }
    if (!a.bankLineOfCredit) {
      a.bankLineOfCredit = new Array(NUM_YEARS).fill(0);
    }
    // Remove legacy creditFacilityLimit (now computed at runtime)
    delete a.creditFacilityLimit;
    // Add year0 and year1Overrides if missing
    if (!a.year0) {
      a.year0 = getEmptyYear0();
    }
    if (!a.year1Overrides) {
      a.year1Overrides = { salesHectaresAccrual: 0, salesNetPayment: 0 };
    }
  }

  // ====== Version management ======
  function versionLabel(key) {
    var v = versions[key];
    if (!v) return key;
    var start = v.startYear;
    var end = start + NUM_YEARS - 1;
    return 'Version ' + start + ' (' + start + '-' + end + ')';
  }

  function switchToVersion(key, scenario) {
    // Save current working data to current scenario before switching
    saveCurrentToScenario();

    activeVersionKey = key;
    activeScenario = scenario || 'base';
    var v = versions[key];
    setVersion(v.startYear);

    // Load scenario data (or empty if scenario is null)
    loadScenarioData();

    updateYearHeaders();
    populateInputs(currentAssumptions);
    recalculate();
    updateVersionDropdown();
    updateScenarioDropdown();
    updateScenarioBadge();
    saveAllVersions();
  }

  function saveCurrentToScenario() {
    if (!activeVersionKey || !versions[activeVersionKey]) return;
    try {
      var data = readInputs();
      versions[activeVersionKey].assumptions = JSON.parse(JSON.stringify(data));
      versions[activeVersionKey].scenarios[activeScenario] = JSON.parse(JSON.stringify(data));
    } catch (e) { /* inputs may not exist yet */ }
  }

  function loadScenarioData() {
    var v = versions[activeVersionKey];
    var scenarioData = v.scenarios[activeScenario];
    if (scenarioData) {
      currentAssumptions = JSON.parse(JSON.stringify(scenarioData));
    } else {
      currentAssumptions = getEmptyAssumptions();
    }
    v.assumptions = JSON.parse(JSON.stringify(currentAssumptions));
  }

  function createVersion(startYear, assumptions) {
    var key = String(startYear);
    if (versions[key]) {
      alert('Version ' + startYear + ' already exists.');
      return false;
    }
    setVersion(startYear);
    versions[key] = {
      startYear: startYear,
      assumptions: assumptions || getEmptyAssumptions(),
      scenarios: emptyScenarios()
    };
    saveAllVersions();
    return true;
  }

  function deleteVersion(key) {
    var keys = Object.keys(versions);
    if (keys.length <= 1) {
      alert('Cannot delete the last version.');
      return;
    }
    if (!confirm('Delete ' + versionLabel(key) + '? This cannot be undone.')) return;
    delete versions[key];
    saveAllVersions();
    var remaining = Object.keys(versions).sort();
    switchToVersion(remaining[0], 'base');
  }

  function updateVersionDropdown() {
    var dropdown = document.getElementById('version-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    var keys = Object.keys(versions).sort();
    keys.forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = versionLabel(key);
      if (key === activeVersionKey) opt.selected = true;
      dropdown.appendChild(opt);
    });
  }

  function updateScenarioDropdown() {
    var dropdown = document.getElementById('scenario-dropdown');
    if (!dropdown) return;
    dropdown.value = activeScenario;
  }

  function updateScenarioBadge() {
    var badge = document.getElementById('scenario-badge');
    if (!badge) return;
    var v = versions[activeVersionKey];
    var hasData = v && v.scenarios && v.scenarios[activeScenario] !== null;
    if (hasData) {
      badge.textContent = 'Saved';
      badge.classList.add('saved');
    } else {
      badge.textContent = 'Empty';
      badge.classList.remove('saved');
    }
  }

  // ====== Update table year headers dynamically ======
  function updateYearHeaders() {
    var prefixes = ['ha', 'lease', 'sales', 'prod', 'fin', 'fcf', 'opcost', 'ts'];
    prefixes.forEach(function (prefix) {
      for (var i = 0; i < NUM_YEARS; i++) {
        var el = document.getElementById(prefix + '-y' + i);
        if (el) el.textContent = YEARS[i];
      }
    });

    var hcRow = document.getElementById('headcount-header-row');
    if (hcRow) {
      while (hcRow.children.length > 2) {
        hcRow.removeChild(hcRow.lastChild);
      }
      for (var i = 0; i < NUM_YEARS; i++) {
        var th = document.createElement('th');
        th.colSpan = 4;
        th.textContent = YEARS[i] + ' (Q1-Q4)';
        hcRow.appendChild(th);
      }
    }
  }

  // ====== Copy Modal (version+scenario → version+scenario) ======
  function openCopyModal() {
    var modal = document.getElementById('copy-modal');
    var srcVersionSel = document.getElementById('copy-src-version');
    var tgtVersionSel = document.getElementById('copy-tgt-version');

    // Populate version dropdowns
    var keys = Object.keys(versions).sort();
    srcVersionSel.innerHTML = '';
    tgtVersionSel.innerHTML = '';
    keys.forEach(function (key) {
      var opt1 = document.createElement('option');
      opt1.value = key;
      opt1.textContent = versionLabel(key);
      srcVersionSel.appendChild(opt1);

      var opt2 = document.createElement('option');
      opt2.value = key;
      opt2.textContent = versionLabel(key);
      if (key === activeVersionKey) opt2.selected = true;
      tgtVersionSel.appendChild(opt2);
    });

    // Default source scenario to base, target to current
    document.getElementById('copy-src-scenario').value = 'base';
    document.getElementById('copy-tgt-scenario').value = activeScenario;

    updateCopyYearCheckboxes();

    srcVersionSel.onchange = updateCopyYearCheckboxes;
    tgtVersionSel.onchange = updateCopyYearCheckboxes;

    modal.style.display = 'flex';
  }

  function updateCopyYearCheckboxes() {
    var srcKey = document.getElementById('copy-src-version').value;
    var tgtKey = document.getElementById('copy-tgt-version').value;
    var checksDiv = document.getElementById('copy-years-checkboxes');
    checksDiv.innerHTML = '';

    if (!srcKey || !tgtKey || !versions[srcKey] || !versions[tgtKey]) return;

    var srcStart = versions[srcKey].startYear;
    var tgtStart = versions[tgtKey].startYear;
    var srcYears = [];
    var tgtYears = [];
    for (var i = 0; i < NUM_YEARS; i++) {
      srcYears.push(srcStart + i);
      tgtYears.push(tgtStart + i);
    }

    var overlap = srcYears.filter(function (y) { return tgtYears.indexOf(y) !== -1; });

    if (overlap.length === 0) {
      checksDiv.textContent = 'No overlapping years between these versions.';
      return;
    }

    overlap.forEach(function (year) {
      var label = document.createElement('label');
      label.className = 'copy-year-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = year;
      cb.checked = true;
      cb.className = 'copy-year-cb';
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + year));
      checksDiv.appendChild(label);
    });
  }

  function executeCopy() {
    var srcKey = document.getElementById('copy-src-version').value;
    var tgtKey = document.getElementById('copy-tgt-version').value;
    var srcScenario = document.getElementById('copy-src-scenario').value;
    var tgtScenario = document.getElementById('copy-tgt-scenario').value;

    if (!srcKey || !tgtKey || !versions[srcKey] || !versions[tgtKey]) return;

    // Get source data
    var srcVersion = versions[srcKey];
    var srcData = srcVersion.scenarios[srcScenario];
    if (!srcData) {
      alert('Source scenario (' + SCENARIO_NAMES[srcScenario] + ') is empty. Nothing to copy.');
      return;
    }

    var srcStart = srcVersion.startYear;
    var tgtStart = versions[tgtKey].startYear;

    var selectedYears = [];
    document.querySelectorAll('.copy-year-cb:checked').forEach(function (cb) {
      selectedYears.push(parseInt(cb.value));
    });

    if (selectedYears.length === 0) {
      alert('No years selected.');
      return;
    }

    // If target is current version+scenario, save current first
    if (tgtKey === activeVersionKey && tgtScenario === activeScenario) {
      saveCurrentToScenario();
    }

    // Get or create target assumptions
    var tgtData = versions[tgtKey].scenarios[tgtScenario];
    if (!tgtData) {
      // Initialize empty target
      setVersion(versions[tgtKey].startYear);
      tgtData = getEmptyAssumptions();
    } else {
      tgtData = JSON.parse(JSON.stringify(tgtData));
    }

    var yearFields = [
      'hectaresPerYear', 'salesPct', 'leasingPct',
      'leasePrice', 'leaseAdvanceMonths',
      'salesPrice', 'salesPrepaidRatio', 'salesAdvanceMonths', 'salesShipmentRatio',
      'robotLifetime', 'productionCost', 'rmPrepayMonths', 'paymentNetMonths', 'supplierPrepayRatio',
      'capitalRaised', 'capitalMonth',
      'cressonCreditFacility', 'bankLineOfCredit', 'creditFacilityRate',
      'bankLoansPerYear', 'bankLoanRate', 'bankLoanTerm',
      'collectionLoanPct', 'iiaRoyalties',
      'monthsOfActivity', 'opCostRatio', 'overdueRatio', 'collectionRatio',
      'sparePartsPerRobot', 'subcontractorCostPerRobot'
    ];

    selectedYears.forEach(function (year) {
      var srcIdx = year - srcStart;
      var tgtIdx = year - tgtStart;

      yearFields.forEach(function (field) {
        if (srcData[field] && tgtData[field]) {
          tgtData[field][tgtIdx] = srcData[field][srcIdx];
        }
      });

      if (srcData.quarterlyDist[srcIdx]) {
        tgtData.quarterlyDist[tgtIdx] = srcData.quarterlyDist[srcIdx].slice();
      }

      for (var d = 0; d < ['rd', 'sm', 'ga'].length; d++) {
        var dept = ['rd', 'sm', 'ga'][d];
        for (var q = 0; q < 4; q++) {
          var srcQ = srcIdx * 4 + q;
          var tgtQ = tgtIdx * 4 + q;
          if (srcData.headcount[dept] && srcData.headcount[dept].quarters[srcQ] !== undefined) {
            tgtData.headcount[dept].quarters[tgtQ] = srcData.headcount[dept].quarters[srcQ];
          }
        }
        // Also copy salary if source has it
        if (srcData.headcount[dept] && srcData.headcount[dept].salary) {
          tgtData.headcount[dept].salary = srcData.headcount[dept].salary;
        }
      }

      for (var opKey in srcData.operationalCosts) {
        if (srcData.operationalCosts[opKey] && tgtData.operationalCosts[opKey]) {
          tgtData.operationalCosts[opKey].yearly[tgtIdx] = srcData.operationalCosts[opKey].yearly[srcIdx];
        }
      }
    });

    // Copy year0 if both versions have the same year0 (year before start)
    if (srcData.year0 && srcStart === tgtStart) {
      tgtData.year0 = JSON.parse(JSON.stringify(srcData.year0));
    }
    // Copy year1Overrides if same version start
    if (srcData.year1Overrides && srcStart === tgtStart) {
      tgtData.year1Overrides = JSON.parse(JSON.stringify(srcData.year1Overrides));
    }

    // Save to target
    versions[tgtKey].scenarios[tgtScenario] = JSON.parse(JSON.stringify(tgtData));
    versions[tgtKey].assumptions = JSON.parse(JSON.stringify(tgtData));
    saveAllVersions();

    // If target is current version+scenario, reload the view
    if (tgtKey === activeVersionKey && tgtScenario === activeScenario) {
      currentAssumptions = JSON.parse(JSON.stringify(tgtData));
      // Restore correct YEARS for current version
      setVersion(versions[activeVersionKey].startYear);
      populateInputs(currentAssumptions);
      recalculate();
    } else if (tgtKey === activeVersionKey) {
      // Different scenario same version — just update badge
      updateScenarioBadge();
    }

    // Restore YEARS for active version in case we changed it
    setVersion(versions[activeVersionKey].startYear);

    document.getElementById('copy-modal').style.display = 'none';
    alert('Copied successfully!');
  }

  // ====== Excel-like cell handlers (delegated, set up once) ======
  function setupCellHandlers() {
    // Paste handler: parse tab-separated values and fill across cells
    document.addEventListener('paste', function (e) {
      var cell = e.target.closest('td.cell-input');
      if (!cell) return;

      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      var lines = text.replace(/\r/g, '').split('\n').filter(function (l) { return l.length > 0; });

      var tbody = cell.closest('tbody');
      var allRows = Array.from(tbody.rows);
      var rowIdx = allRows.indexOf(cell.parentElement);
      var cells = Array.from(cell.parentElement.children);
      var colIdx = cells.indexOf(cell);

      for (var r = 0; r < lines.length; r++) {
        var ri = rowIdx + r;
        if (ri >= allRows.length) break;
        var vals = lines[r].split('\t');
        var rowCells = Array.from(allRows[ri].children);
        for (var c = 0; c < vals.length; c++) {
          var ci = colIdx + c;
          if (ci >= rowCells.length) break;
          var target = rowCells[ci];
          if (target.classList.contains('cell-input')) {
            target.textContent = vals[c].replace(/[$,]/g, '').trim();
          }
        }
      }

      updateFormulas(tbody);
    });

    // Tab key: move to next editable cell
    document.addEventListener('keydown', function (e) {
      var cell = e.target.closest('td.cell-input');
      if (!cell) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        var tbody = cell.closest('tbody');
        var editables = Array.from(tbody.querySelectorAll('td.cell-input'));
        var idx = editables.indexOf(cell);
        var next = e.shiftKey ? idx - 1 : idx + 1;
        if (next >= 0 && next < editables.length) {
          editables[next].focus();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var row = cell.parentElement;
        var colIdx = Array.from(row.children).indexOf(cell);
        var nextRow = row.nextElementSibling;
        if (nextRow && nextRow.children[colIdx] && nextRow.children[colIdx].classList.contains('cell-input')) {
          nextRow.children[colIdx].focus();
        }
      }
    });

    // Focus: select all text in cell
    document.addEventListener('focusin', function (e) {
      var cell = e.target.closest('td.cell-input');
      if (!cell) return;
      var raw = parseCellValue(cell.textContent);
      cell.textContent = raw;
      var range = document.createRange();
      range.selectNodeContents(cell);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    // Blur: format cell value
    document.addEventListener('focusout', function (e) {
      var cell = e.target.closest('td.cell-input');
      if (!cell) return;
      var val = parseCellValue(cell.textContent);
      cell.textContent = formatCellValue(val);
      var tbody = cell.closest('tbody');
      if (tbody) updateFormulas(tbody);
    });

    // Input: live formula update
    document.addEventListener('input', function (e) {
      var cell = e.target.closest('td.cell-input');
      if (!cell) return;
      var tbody = cell.closest('tbody');
      if (tbody) updateFormulas(tbody);
    });
  }

  // ====== Formula updates ======
  function updateFormulas(tbody) {
    if (tbody.id === 'hectares-body') {
      var salesCells = tbody.querySelectorAll('td[data-field="salesPct"]');
      var leaseCells = tbody.querySelectorAll('td[data-field="leasingPct"]');
      salesCells.forEach(function (cell, i) {
        if (leaseCells[i]) {
          leaseCells[i].textContent = formatCellValue(100 - parseCellValue(cell.textContent));
        }
      });
    }
    if (tbody.id === 'sales-body') {
      // Payment upon Shipment = 100 - Prepaid Payment
      for (var y = 0; y < YEARS.length; y++) {
        var prepaidCell = tbody.querySelector('td[data-field="salesPrepaidRatio"][data-y="' + y + '"]');
        var shipmentCell = tbody.querySelector('td[data-field="salesShipmentRatio"][data-y="' + y + '"]');
        if (prepaidCell && shipmentCell) {
          shipmentCell.textContent = formatCellValue(100 - parseCellValue(prepaidCell.textContent));
        }
      }
    }
    if (tbody.id === 'financial-body') {
      // Update Credit Facility Effective = Cresson + Bank
      for (var y = 0; y < YEARS.length; y++) {
        var cresson = tbody.querySelector('td[data-field="cressonCreditFacility"][data-y="' + y + '"]');
        var bank = tbody.querySelector('td[data-field="bankLineOfCredit"][data-y="' + y + '"]');
        var effective = tbody.querySelector('td[data-field="creditFacilityEffective"][data-y="' + y + '"]');
        if (cresson && bank && effective) {
          effective.textContent = formatCellValue(parseCellValue(cresson.textContent) + parseCellValue(bank.textContent));
        }
        // Update Monthly Interest Rate
        var rateCell = tbody.querySelector('td[data-field="bankLoanRate"][data-y="' + y + '"]');
        var monthlyCell = tbody.querySelector('td[data-field="monthlyInterestRate"][data-y="' + y + '"]');
        if (rateCell && monthlyCell) {
          monthlyCell.textContent = formatCellValue(parseCellValue(rateCell.textContent) / 12);
        }
      }
    }
  }

  // ====== Build tables with contenteditable cells ======
  function buildYearlyTable(tbodyId, rows) {
    var tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.textContent = row.label;
      tr.appendChild(tdLabel);

      for (var y = 0; y < YEARS.length; y++) {
        var td = document.createElement('td');
        td.dataset.field = row.field;
        td.dataset.y = String(y);
        if (row.cls) td.classList.add(row.cls);

        if (row.formula) {
          td.classList.add('cell-formula');
          td.textContent = formatCellValue(row.values[y]);
        } else {
          td.contentEditable = 'true';
          td.classList.add('cell-input');
          td.textContent = formatCellValue(row.values[y]);
        }

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  // === Populate all input tables from assumptions ===
  function populateInputs(a) {
    populateHectaresTable(a);
    populateQDistTable(a);
    populateLeaseTable(a);
    populateSalesTable(a);
    populateProductionTable(a);
    populateFinancialTable(a);
    populateFcfTable(a);
    populateHeadcountTable(a);
    populateOpCostTable(a);
    populateTechSupportTable(a);
  }

  function populateHectaresTable(a) {
    buildYearlyTable('hectares-body', [
      { label: 'Expected Hectares', field: 'hectaresPerYear', cls: 'hectare-input', values: a.hectaresPerYear },
      { label: 'Robot Sales (%)', field: 'salesPct', cls: 'hectare-input', values: a.salesPct },
      { label: 'Robot Leasing (%)', field: 'leasingPct', cls: 'hectare-input', values: a.leasingPct, formula: true }
    ]);
  }

  function populateQDistTable(a) {
    var tbody = document.getElementById('qdist-body');
    tbody.innerHTML = '';
    for (var y = 0; y < YEARS.length; y++) {
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.textContent = YEARS[y];
      tdLabel.style.fontWeight = '600';
      tr.appendChild(tdLabel);
      for (var q = 0; q < 4; q++) {
        var td = document.createElement('td');
        td.contentEditable = 'true';
        td.classList.add('cell-input', 'qdist-input');
        td.dataset.y = String(y);
        td.dataset.q = String(q);
        td.textContent = a.quarterlyDist[y][q];
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  function populateLeaseTable(a) {
    buildYearlyTable('lease-body', [
      { label: 'Avg Lease Price ($/mo)', field: 'leasePrice', cls: 'lease-input', values: a.leasePrice },
      { label: 'Advance Payment (months)', field: 'leaseAdvanceMonths', cls: 'lease-input', values: a.leaseAdvanceMonths }
    ]);
  }

  function populateSalesTable(a) {
    var shipmentPct = a.salesPrepaidRatio.map(function (v) { return 100 - v; });
    buildYearlyTable('sales-body', [
      { label: 'Avg Sales Price ($)', field: 'salesPrice', cls: 'sales-input', values: a.salesPrice },
      { label: 'Prepaid Payment (%)', field: 'salesPrepaidRatio', cls: 'sales-input', values: a.salesPrepaidRatio },
      { label: 'Advance Payment (months)', field: 'salesAdvanceMonths', cls: 'sales-input', values: a.salesAdvanceMonths },
      { label: 'Payment upon Shipment (%)', field: 'salesShipmentRatio', values: shipmentPct, formula: true }
    ]);
  }

  function populateFcfTable(a) {
    var tbody = document.getElementById('fcf-body');
    tbody.innerHTML = '';

    var zeros = new Array(NUM_YEARS).fill(0);

    var sections = [
      { header: 'FCF — Free Cash Flow', rows: [
        { label: 'Months of Activity', field: 'monthsOfActivity', cls: 'fcf-input', values: a.monthsOfActivity },
        { label: 'Overdue Receivables (%)', field: 'overdueRatio', cls: 'fcf-input', values: a.overdueRatio },
        { label: 'Collection (%)', field: 'collectionRatio', cls: 'fcf-input', values: a.collectionRatio }
      ]},
      { header: 'FCF Ratios (Calculated)', rows: [
        { label: 'Months of Activity / Op. Cost ($)', field: 'fcfOpCostRatio', values: zeros, formula: true },
        { label: 'Overdue Receivables ($)', field: 'fcfOverdueAmount', values: zeros, formula: true },
        { label: 'Collection ($)', field: 'fcfCollectionAmount', values: zeros, formula: true }
      ]}
    ];

    sections.forEach(function (section) {
      var headerTr = document.createElement('tr');
      headerTr.className = 'financial-section-header';
      var headerTd = document.createElement('td');
      headerTd.colSpan = YEARS.length + 1;
      headerTd.textContent = section.header;
      headerTr.appendChild(headerTd);
      tbody.appendChild(headerTr);

      section.rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.textContent = row.label;
        tr.appendChild(tdLabel);

        for (var y = 0; y < YEARS.length; y++) {
          var td = document.createElement('td');
          td.dataset.field = row.field;
          td.dataset.y = String(y);
          if (row.cls) td.classList.add(row.cls);

          if (row.formula) {
            td.classList.add('cell-formula');
            td.textContent = formatCellValue(row.values[y]);
          } else {
            td.contentEditable = 'true';
            td.classList.add('cell-input');
            td.textContent = formatCellValue(row.values[y]);
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    });
  }

  function updateFcfFormulas(results) {
    if (!results || !results.annual) return;

    var annual = results.annual;
    for (var y = 0; y < YEARS.length; y++) {
      // Months of Activity / Op. Cost = monthsOfActivity * (annualOpex / 12)
      var moCell = document.querySelector('td.fcf-input[data-field="monthsOfActivity"][data-y="' + y + '"]');
      var months = moCell ? parseCellValue(moCell.textContent) : 12;
      var annualOpex = annual[y].totalOpex || 0;
      var opCostVal = months * (annualOpex / 12);

      var opCostCell = document.querySelector('td.cell-formula[data-field="fcfOpCostRatio"][data-y="' + y + '"]');
      if (opCostCell) opCostCell.textContent = formatCellValue(Math.round(opCostVal));

      // Overdue Receivables = overdueRatio% * existing lease payments (annual)
      var overdueCell = document.querySelector('td.fcf-input[data-field="overdueRatio"][data-y="' + y + '"]');
      var overduePct = overdueCell ? parseCellValue(overdueCell.textContent) : 0;
      var existingPayments = 0;
      var start = y * 12, end = start + 12;
      for (var m = start; m < end; m++) {
        existingPayments += (results.existingLeasePayment[m] || 0);
      }
      var overdueVal = existingPayments * (overduePct / 100);
      var overdueAmtCell = document.querySelector('td.cell-formula[data-field="fcfOverdueAmount"][data-y="' + y + '"]');
      if (overdueAmtCell) overdueAmtCell.textContent = formatCellValue(Math.round(overdueVal));

      // Collection = collectionRatio% * total collections (annual)
      var collCell = document.querySelector('td.fcf-input[data-field="collectionRatio"][data-y="' + y + '"]');
      var collPct = collCell ? parseCellValue(collCell.textContent) : 0;
      var annualCollections = annual[y].totalCollections || 0;
      var collVal = annualCollections * (collPct / 100);
      var collAmtCell = document.querySelector('td.cell-formula[data-field="fcfCollectionAmount"][data-y="' + y + '"]');
      if (collAmtCell) collAmtCell.textContent = formatCellValue(Math.round(collVal));
    }
  }

  function populateFinancialTable(a) {
    var tbody = document.getElementById('financial-body');
    tbody.innerHTML = '';

    // Compute effective credit facility for display
    var effectiveCredit = new Array(NUM_YEARS).fill(0);
    var monthlyInterestRate = new Array(NUM_YEARS).fill(0);
    for (var i = 0; i < NUM_YEARS; i++) {
      effectiveCredit[i] = (a.cressonCreditFacility ? a.cressonCreditFacility[i] : 0)
                         + (a.bankLineOfCredit ? a.bankLineOfCredit[i] : 0);
      monthlyInterestRate[i] = a.bankLoanRate ? (a.bankLoanRate[i] / 12) : 0;
    }

    // Placeholder zeros for formula rows that get filled after recalculate
    var zeros = new Array(NUM_YEARS).fill(0);

    var sections = [
      { header: 'Raising Capital & Grants', rows: [
        { label: 'Capital Raised ($)', field: 'capitalRaised', cls: 'fin-input', values: a.capitalRaised },
        { label: 'Capital Raise Month (1-12)', field: 'capitalMonth', cls: 'fin-input', values: a.capitalMonth }
      ]},
      { header: 'Lines of Credit', rows: [
        { label: 'Cresson Credit Facility ($)', field: 'cressonCreditFacility', cls: 'fin-input', values: a.cressonCreditFacility || zeros },
        { label: 'Bank Line of Credit ($)', field: 'bankLineOfCredit', cls: 'fin-input', values: a.bankLineOfCredit || zeros },
        { label: 'Credit Facility Effective ($)', field: 'creditFacilityEffective', values: effectiveCredit, formula: true },
        { label: 'Credit Facility Interest (%)', field: 'creditFacilityRate', cls: 'fin-input', values: a.creditFacilityRate }
      ]},
      { header: 'Bank Loan', rows: [
        { label: 'Bank Loan Amount ($)', field: 'bankLoansPerYear', cls: 'fin-input', values: a.bankLoansPerYear },
        { label: 'Bank Loan Interest Rate (%)', field: 'bankLoanRate', cls: 'fin-input', values: a.bankLoanRate },
        { label: 'Bank Loan Term (years)', field: 'bankLoanTerm', cls: 'fin-input', values: a.bankLoanTerm },
        { label: 'Interest Payment ($)', field: 'loanInterestAnnual', values: zeros, formula: true },
        { label: 'Principal Repayment ($)', field: 'loanPrincipalAnnual', values: zeros, formula: true },
        { label: 'Amortization Schedule ($)', field: 'loanPaymentsAnnual', values: zeros, formula: true }
      ]},
      { header: 'Parameters', rows: [
        { label: 'Collection to Loan Repay (%)', field: 'collectionLoanPct', cls: 'fin-input', values: a.collectionLoanPct },
        { label: 'Monthly Interest Rate (%)', field: 'monthlyInterestRate', values: monthlyInterestRate, formula: true },
        { label: 'Min FCF ($)', field: 'minFcf', values: zeros, formula: true }
      ]},
      { header: 'IIA Royalties', rows: [
        { label: 'IIA Royalties (%)', field: 'iiaRoyalties', cls: 'fin-input', values: a.iiaRoyalties }
      ]}
    ];

    sections.forEach(function (section) {
      // Section header row
      var headerTr = document.createElement('tr');
      headerTr.className = 'financial-section-header';
      var headerTd = document.createElement('td');
      headerTd.colSpan = YEARS.length + 1;
      headerTd.textContent = section.header;
      headerTr.appendChild(headerTd);
      tbody.appendChild(headerTr);

      // Data rows
      section.rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.textContent = row.label;
        tr.appendChild(tdLabel);

        for (var y = 0; y < YEARS.length; y++) {
          var td = document.createElement('td');
          td.dataset.field = row.field;
          td.dataset.y = String(y);
          if (row.cls) td.classList.add(row.cls);

          if (row.formula) {
            td.classList.add('cell-formula');
            td.textContent = formatCellValue(row.values[y]);
          } else {
            td.contentEditable = 'true';
            td.classList.add('cell-input');
            td.textContent = formatCellValue(row.values[y]);
          }

          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    });
  }

  function updateFinancialFormulas(results) {
    if (!results || !results.annual) return;

    var annual = results.annual;
    var fields = {
      creditFacilityEffective: function (y) { return annual[y].creditFacilityLimit || 0; },
      loanInterestAnnual: function (y) { return annual[y].loanInterestAnnual || 0; },
      loanPrincipalAnnual: function (y) { return annual[y].loanPrincipalAnnual || 0; },
      loanPaymentsAnnual: function (y) { return annual[y].loanPayments || 0; },
      monthlyInterestRate: function (y) {
        // Read current bankLoanRate from the input cells
        var rateCell = document.querySelector('td.fin-input[data-field="bankLoanRate"][data-y="' + y + '"]');
        var rate = rateCell ? parseCellValue(rateCell.textContent) : 0;
        return rate / 12;
      },
      minFcf: function (y) { return annual[y].closingBalance || 0; }
    };

    for (var field in fields) {
      var cells = document.querySelectorAll('td.cell-formula[data-field="' + field + '"]');
      cells.forEach(function (td) {
        var y = parseInt(td.dataset.y);
        td.textContent = formatCellValue(fields[field](y));
      });
    }
  }

  function populateProductionTable(a) {
    buildYearlyTable('production-body', [
      { label: 'Robot Lifetime (months)', field: 'robotLifetime', cls: 'prod-input', values: a.robotLifetime },
      { label: 'Avg Production Cost ($)', field: 'productionCost', cls: 'prod-input', values: a.productionCost },
      { label: 'RM Prepayment (months)', field: 'rmPrepayMonths', cls: 'prod-input', values: a.rmPrepayMonths },
      { label: 'Payment Net+ (months)', field: 'paymentNetMonths', cls: 'prod-input', values: a.paymentNetMonths },
      { label: 'Supplier Prepay Ratio (%)', field: 'supplierPrepayRatio', cls: 'prod-input', values: a.supplierPrepayRatio }
    ]);
  }

  function populateHeadcountTable(a) {
    var tbody = document.getElementById('headcount-body');
    tbody.innerHTML = '';

    var depts = ['rd', 'sm', 'ga'];
    for (var d = 0; d < depts.length; d++) {
      var dept = depts[d];
      var hc = a.headcount[dept];
      var tr = document.createElement('tr');

      var tdLabel = document.createElement('td');
      tdLabel.textContent = hc.label;
      tr.appendChild(tdLabel);

      var tdSalary = document.createElement('td');
      tdSalary.contentEditable = 'true';
      tdSalary.classList.add('cell-input', 'hc-salary');
      tdSalary.dataset.dept = dept;
      tdSalary.textContent = formatCellValue(hc.salary);
      tr.appendChild(tdSalary);

      for (var q = 0; q < NUM_YEARS * 4; q++) {
        var td = document.createElement('td');
        td.contentEditable = 'true';
        td.classList.add('cell-input', 'hc-count');
        td.dataset.dept = dept;
        td.dataset.q = String(q);
        td.textContent = hc.quarters[q];
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  }

  function populateOpCostTable(a) {
    var tbody = document.getElementById('opcost-body');
    tbody.innerHTML = '';

    for (var key in a.operationalCosts) {
      var cat = a.operationalCosts[key];
      var tr = document.createElement('tr');

      var tdLabel = document.createElement('td');
      tdLabel.textContent = cat.label;
      tr.appendChild(tdLabel);

      for (var y = 0; y < YEARS.length; y++) {
        var td = document.createElement('td');
        td.contentEditable = 'true';
        td.classList.add('cell-input', 'opcost-input');
        td.dataset.key = key;
        td.dataset.y = String(y);
        td.textContent = formatCellValue(cat.yearly[y]);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  }

  function populateTechSupportTable(a) {
    buildYearlyTable('techsupport-body', [
      { label: 'Spare Parts per Robot ($/mo)', field: 'sparePartsPerRobot', cls: 'ts-input', values: a.sparePartsPerRobot || new Array(NUM_YEARS).fill(50) },
      { label: 'Subcontractor Cost per Robot ($/mo)', field: 'subcontractorCostPerRobot', cls: 'ts-input', values: a.subcontractorCostPerRobot || new Array(NUM_YEARS).fill(200) }
    ]);
  }

  // === Read cell values back into assumptions object ===
  function readInputs() {
    var a = JSON.parse(JSON.stringify(currentAssumptions));

    document.querySelectorAll('td.hectare-input.cell-input, td.lease-input, td.sales-input, td.prod-input, td.fin-input, td.fcf-input, td.ts-input').forEach(function (td) {
      var y = parseInt(td.dataset.y);
      var field = td.dataset.field;
      if (a[field]) a[field][y] = parseCellValue(td.textContent);
    });

    // Leasing % is a formula: compute from salesPct
    a.leasingPct = a.salesPct.map(function (s) { return 100 - s; });

    // Shipment % is a formula: compute from salesPrepaidRatio
    a.salesShipmentRatio = a.salesPrepaidRatio.map(function (p) { return 100 - p; });

    // Quarterly distribution
    document.querySelectorAll('td.qdist-input').forEach(function (td) {
      var y = parseInt(td.dataset.y);
      var q = parseInt(td.dataset.q);
      a.quarterlyDist[y][q] = parseCellValue(td.textContent);
    });

    // Headcount
    document.querySelectorAll('td.hc-salary').forEach(function (td) {
      a.headcount[td.dataset.dept].salary = parseCellValue(td.textContent);
    });
    document.querySelectorAll('td.hc-count').forEach(function (td) {
      a.headcount[td.dataset.dept].quarters[parseInt(td.dataset.q)] = parseCellValue(td.textContent);
    });

    // Operational costs
    document.querySelectorAll('td.opcost-input').forEach(function (td) {
      a.operationalCosts[td.dataset.key].yearly[parseInt(td.dataset.y)] = parseCellValue(td.textContent);
    });

    // Year0 data from 5Y Data tab
    if (!a.year0) a.year0 = getEmptyYear0();
    document.querySelectorAll('td.y0-input').forEach(function (td) {
      var key = td.dataset.y0key;
      var m = parseInt(td.dataset.m);
      if (a.year0[key]) {
        a.year0[key][m] = parseCellValue(td.textContent);
      }
    });

    // Year1 overrides from 5Y Data tab
    if (!a.year1Overrides) a.year1Overrides = { salesHectaresAccrual: 0, salesNetPayment: 0 };
    document.querySelectorAll('td.y1-override').forEach(function (td) {
      var key = td.dataset.overrideKey;
      if (key) {
        a.year1Overrides[key] = parseCellValue(td.textContent);
      }
    });

    return a;
  }

  // === Run calculation and render all tables ===
  function recalculate() {
    try {
      currentAssumptions = readInputs();
      var results = Engine.calculate(currentAssumptions);

      Renderer.render5YData(results, currentAssumptions, document.getElementById('table-5y-data'));
      Renderer.renderOperational(results, currentAssumptions, document.getElementById('table-operational'));
      Renderer.renderCFPL(results, document.getElementById('table-cf-pl'));
      Renderer.renderAnnual(results, document.getElementById('table-annual'));
      Renderer.renderLoans(results, document.getElementById('table-loans'));
      Renderer.renderCredit(results, document.getElementById('table-credit'));
      Renderer.renderDetailedOperational(results, currentAssumptions, document.getElementById('table-detailed-opex'));
      Renderer.renderCreditAmortization(results, document.getElementById('table-amortization'));
      Renderer.renderQuarterlyHeadcount(currentAssumptions, document.getElementById('table-headcount'));
      Renderer.renderCustomerTechSupport(results, currentAssumptions, document.getElementById('table-techsupport-output'));

      // Update financial formula cells with engine output
      updateFinancialFormulas(results);
      updateFcfFormulas(results);

      // Auto-save to current scenario
      if (activeVersionKey && versions[activeVersionKey]) {
        versions[activeVersionKey].assumptions = JSON.parse(JSON.stringify(currentAssumptions));
        versions[activeVersionKey].scenarios[activeScenario] = JSON.parse(JSON.stringify(currentAssumptions));
        saveAllVersions();
        updateScenarioBadge();
      }

      console.log('Recalculation complete.');
    } catch (err) {
      console.error('Recalculation error:', err);
      alert('Calculation error: ' + err.message);
    }
  }

  // === Tab switching ===
  function setupTabs() {
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = this.dataset.tab;
        // Deactivate all
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (tc) { tc.classList.remove('active'); });
        // Activate clicked
        this.classList.add('active');
        var target = document.getElementById(targetId);
        if (target) target.classList.add('active');
      });
    });
  }

  // === Init ===
  document.addEventListener('DOMContentLoaded', function () {
    var loaded = loadAllVersions();

    if (!loaded || Object.keys(versions).length === 0) {
      setVersion(2026);
      var migrated = migrateLegacyTo5Year();
      versions['2026'] = {
        startYear: 2026,
        assumptions: migrated,
        scenarios: { base: JSON.parse(JSON.stringify(migrated)), worst: null, best: null }
      };
      activeVersionKey = '2026';
      activeScenario = 'base';
      currentAssumptions = JSON.parse(JSON.stringify(migrated));
      saveAllVersions();
    } else {
      if (!activeVersionKey || !versions[activeVersionKey]) {
        activeVersionKey = Object.keys(versions).sort()[0];
      }
      if (!activeScenario) activeScenario = 'base';
      var v = versions[activeVersionKey];
      setVersion(v.startYear);
      // Load the active scenario data
      var scenarioData = v.scenarios[activeScenario];
      if (scenarioData) {
        currentAssumptions = JSON.parse(JSON.stringify(scenarioData));
      } else {
        currentAssumptions = JSON.parse(JSON.stringify(v.assumptions));
      }
    }

    setupCellHandlers();
    setupTabs();

    updateYearHeaders();
    updateVersionDropdown();
    updateScenarioDropdown();
    updateScenarioBadge();
    populateInputs(currentAssumptions);

    // Version selector
    document.getElementById('version-dropdown').addEventListener('change', function () {
      switchToVersion(this.value, 'base');
    });

    // Scenario selector
    document.getElementById('scenario-dropdown').addEventListener('change', function () {
      saveCurrentToScenario();
      activeScenario = this.value;
      loadScenarioData();
      populateInputs(currentAssumptions);
      recalculate();
      updateScenarioBadge();
    });

    document.getElementById('btn-new-version').addEventListener('click', function () {
      var input = prompt('Enter start year for new version (e.g. 2027):');
      if (!input) return;
      var startYear = parseInt(input);
      if (isNaN(startYear) || startYear < 2000 || startYear > 2100) {
        alert('Please enter a valid year (2000-2100).');
        return;
      }
      saveCurrentToScenario();
      if (createVersion(startYear)) {
        switchToVersion(String(startYear), 'base');
      }
    });

    document.getElementById('btn-delete-version').addEventListener('click', function () {
      deleteVersion(activeVersionKey);
    });

    document.getElementById('btn-copy').addEventListener('click', function () {
      openCopyModal();
    });

    document.getElementById('btn-copy-confirm').addEventListener('click', function () {
      executeCopy();
    });

    document.getElementById('btn-copy-cancel').addEventListener('click', function () {
      document.getElementById('copy-modal').style.display = 'none';
    });

    document.getElementById('copy-modal').addEventListener('click', function (e) {
      if (e.target === this) this.style.display = 'none';
    });

    document.getElementById('btn-save-scenario').addEventListener('click', function () {
      saveCurrentToScenario();
      saveAllVersions();
      updateScenarioBadge();
      alert(SCENARIO_NAMES[activeScenario] + ' saved!');
    });

    document.getElementById('btn-recalculate').addEventListener('click', function () {
      recalculate();
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('Reset this scenario to empty assumptions?')) return;
      setVersion(versions[activeVersionKey].startYear);
      currentAssumptions = getEmptyAssumptions();
      versions[activeVersionKey].assumptions = JSON.parse(JSON.stringify(currentAssumptions));
      versions[activeVersionKey].scenarios[activeScenario] = null;
      populateInputs(currentAssumptions);
      recalculate();
      updateScenarioBadge();
    });

    recalculate();

    // === Dynamic toolbar height for sticky tab-bar positioning ===
    function updateToolbarHeight() {
      var toolbar = document.querySelector('.app-toolbar');
      if (toolbar) {
        document.documentElement.style.setProperty('--toolbar-height', toolbar.offsetHeight + 'px');
      }
    }
    updateToolbarHeight();
    window.addEventListener('resize', updateToolbarHeight);
  });
})();
