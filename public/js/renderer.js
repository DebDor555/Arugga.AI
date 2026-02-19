// Arugga 5-Year Budget — Table Renderer
// Generates HTML tables from calculation results

const Renderer = (function () {

  function fmt(val, type) {
    if (val === undefined || val === null) return '';
    switch (type) {
      case 'currency':
        return '$' + Math.round(val).toLocaleString('en-US');
      case 'currency-k':
        return '$' + (val / 1000).toFixed(0) + 'K';
      case 'number':
        return Math.round(val).toLocaleString('en-US');
      case 'decimal':
        return val.toFixed(1);
      case 'pct':
        return val + '%';
      default:
        return String(val);
    }
  }

  function fmtCell(val) {
    if (val === 0) return '0';
    var n = Number(val);
    if (isNaN(n)) return String(val);
    if (Number.isInteger(n)) return n.toLocaleString('en-US');
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // Build a horizontal scrolling table with month columns
  function buildMonthlyTable(title, rows, labels, options) {
    options = options || {};
    const yearBreaks = options.yearBreaks !== false;
    const container = document.createElement('div');

    if (title) {
      const h3 = document.createElement('h3');
      h3.textContent = title;
      container.appendChild(h3);
    }

    const table = document.createElement('table');
    table.className = 'data-table';

    // Header row: label + month columns
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const th0 = document.createElement('th');
    th0.textContent = '';
    th0.className = 'sticky-col';
    headerRow.appendChild(th0);

    // Add year group headers
    if (yearBreaks) {
      const yearHeaderRow = document.createElement('tr');
      const yth0 = document.createElement('th');
      yth0.className = 'sticky-col';
      yearHeaderRow.appendChild(yth0);
      for (let y = 0; y < YEARS.length; y++) {
        const yth = document.createElement('th');
        yth.colSpan = 12;
        yth.textContent = YEARS[y];
        yth.className = 'year-header';
        yearHeaderRow.appendChild(yth);
      }
      thead.appendChild(yearHeaderRow);
    }

    labels.forEach((lbl, i) => {
      const th = document.createElement('th');
      th.textContent = lbl;
      if (i > 0 && i % 12 === 0) th.className = 'year-start';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');
      if (row.className) tr.className = row.className;

      const td0 = document.createElement('td');
      td0.textContent = row.label;
      td0.className = 'sticky-col';
      if (row.bold) td0.style.fontWeight = 'bold';
      tr.appendChild(td0);

      row.values.forEach((val, i) => {
        const td = document.createElement('td');
        td.textContent = fmt(val, row.format || 'currency');
        td.className = 'num';
        if (i > 0 && i % 12 === 0) td.classList.add('year-start');
        if (row.bold) td.style.fontWeight = 'bold';
        if (row.colorClass) td.classList.add(row.colorClass);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    return container;
  }

  function spacerRow() {
    return { label: '', values: new Array(TOTAL_MONTHS).fill(''), format: 'text', className: 'spacer-row' };
  }

  // ===== 5Y Data table (with year0 editable + 5 years calculated) =====
  function render5YData(r, a, container) {
    container.innerHTML = '';
    var y0 = a.year0 || {};
    var overrides = a.year1Overrides || {};
    var y0Year = YEARS[0] - 1;
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var y0Suffix = String(y0Year).slice(-2);

    // Build labels: year0 (12) + year1-5 (60) = 72 months
    var y0Labels = [];
    for (var m = 0; m < 12; m++) {
      y0Labels.push(monthNames[m] + '-' + y0Suffix);
    }
    var allLabels = y0Labels.concat(r.labels);
    var totalCols = allLabels.length; // 72

    var table = document.createElement('table');
    table.className = 'data-table';
    table.id = 'fiveYDataTable';

    // === THEAD: year headers + month headers ===
    var thead = document.createElement('thead');

    // Year header row
    var yearRow = document.createElement('tr');
    var yrTh0 = document.createElement('th');
    yrTh0.className = 'sticky-col';
    yearRow.appendChild(yrTh0);
    // Year0 header
    var y0Th = document.createElement('th');
    y0Th.colSpan = 12;
    y0Th.textContent = y0Year;
    y0Th.className = 'year-header';
    y0Th.style.background = '#475569'; // slightly different shade for year0
    yearRow.appendChild(y0Th);
    // Year1-5 headers
    for (var y = 0; y < YEARS.length; y++) {
      var yth = document.createElement('th');
      yth.colSpan = 12;
      yth.textContent = YEARS[y];
      yth.className = 'year-header';
      yearRow.appendChild(yth);
    }
    thead.appendChild(yearRow);

    // Month header row
    var monthRow = document.createElement('tr');
    var mTh0 = document.createElement('th');
    mTh0.className = 'sticky-col';
    monthRow.appendChild(mTh0);
    allLabels.forEach(function (lbl, i) {
      var th = document.createElement('th');
      th.textContent = lbl;
      if (i > 0 && i % 12 === 0) th.className = 'year-start';
      monthRow.appendChild(th);
    });
    thead.appendChild(monthRow);
    table.appendChild(thead);

    // === TBODY ===
    var tbody = document.createElement('tbody');
    tbody.id = 'fiveYDataBody';

    // Helper: add a data row
    // y0key: key in a.year0 for editable year0 data
    // calcArr: 60-element array from engine for year1-5
    // overrideIdx: if set, month index in calcArr that should be editable (0 = first month of year1)
    // overrideKey: key in a.year1Overrides for the override value
    function addRow(label, y0key, calcArr, format, opts) {
      opts = opts || {};
      var tr = document.createElement('tr');
      if (opts.className) tr.className = opts.className;

      var tdLabel = document.createElement('td');
      tdLabel.className = 'sticky-col';
      tdLabel.textContent = label;
      if (opts.bold) tdLabel.style.fontWeight = 'bold';
      tr.appendChild(tdLabel);

      // Year0 cells (editable)
      var y0Data = y0[y0key] || new Array(12).fill(0);
      for (var m = 0; m < 12; m++) {
        var td = document.createElement('td');
        td.className = 'num cell-input y0-input';
        td.contentEditable = 'true';
        td.dataset.y0key = y0key;
        td.dataset.m = String(m);
        td.textContent = fmtCell(y0Data[m] || 0);
        if (m === 0) td.classList.add('year-start');
        tr.appendChild(td);
      }

      // Year1-5 cells (calculated, except overrides)
      for (var m = 0; m < TOTAL_MONTHS; m++) {
        var td = document.createElement('td');
        td.className = 'num';
        if (m % 12 === 0) td.classList.add('year-start');
        if (opts.bold) td.style.fontWeight = 'bold';
        if (opts.colorClass) td.classList.add(opts.colorClass);

        // Check if this cell is an override
        if (opts.overrideKey && m === 0) {
          td.classList.add('cell-input', 'y1-override');
          td.contentEditable = 'true';
          td.dataset.overrideKey = opts.overrideKey;
          td.textContent = fmtCell(overrides[opts.overrideKey] || 0);
        } else {
          var val = calcArr ? calcArr[m] : 0;
          td.textContent = fmt(val, format || 'currency');
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    // Helper: section header row
    function addSectionHeader(label) {
      var tr = document.createElement('tr');
      tr.className = 'spacer-row';
      var td0 = document.createElement('td');
      td0.className = 'sticky-col';
      td0.textContent = label;
      td0.style.fontWeight = 'bold';
      td0.style.color = 'var(--primary)';
      tr.appendChild(td0);
      for (var i = 0; i < totalCols; i++) {
        tr.appendChild(document.createElement('td'));
      }
      tbody.appendChild(tr);
    }

    // Helper: spacer
    function addSpacer() {
      var tr = document.createElement('tr');
      tr.className = 'spacer-row';
      var td0 = document.createElement('td');
      td0.className = 'sticky-col';
      tr.appendChild(td0);
      for (var i = 0; i < totalCols; i++) {
        tr.appendChild(document.createElement('td'));
      }
      tbody.appendChild(tr);
    }

    // === Top rows (fractional) ===
    addRow('Added Hectares', 'addedHectares', r.addedHectares, 'decimal');
    addRow('Hectares / Robots (accruals)', 'cumulativeHectares', r.cumulativeHectares, 'decimal');

    // === TOTAL section ===
    addSpacer();
    addSectionHeader('Total');
    addRow('Added Hectares', 'totalAddedHectares', r.addedHectares.map(function(v) { return Math.round(v); }), 'number');
    addRow('Hectares / Robots (accruals)', 'totalCumulativeHectares', r.cumulativeHectares.map(function(v) { return Math.round(v); }), 'number', { bold: true });
    addRow('Revenue', 'totalRevenue', r.totalRevenue, 'currency');
    addRow('Collections', 'totalCollections', r.totalCollections, 'currency');
    addRow('COGS', 'totalCOGS', r.totalCOGSAccounting, 'currency', { colorClass: 'clr-cost' });
    addRow('Cost of Goods Sold', 'costOfGoodsSold', r.salesCOGS, 'currency', { colorClass: 'clr-cost' });
    addRow('Depreciation (Lease)', 'depreciationLease', r.depreciation, 'currency', { colorClass: 'clr-cost' });
    addRow('OPEX (cost of lease production)', 'opex', r.leaseCOGS, 'currency');
    addRow('Supplier Payment', 'supplierPayment', r.supplierPayments, 'currency', { colorClass: 'clr-cost' });

    // === LEASE section ===
    addSpacer();
    addSectionHeader('Lease');
    addRow('Added Hectares', 'leaseAddedHa', r.addedLeaseHa.map(function(v) { return Math.round(v); }), 'number');
    addRow('Hectares / Robots', 'leaseHectares', r.cumulativeLeaseHa.map(function(v) { return Math.round(v); }), 'number', { bold: true });
    addRow('Revenue', 'leaseRevenue', r.leaseRevenue, 'currency', { colorClass: 'clr-revenue' });
    addRow('Collections', 'leaseCollections', r.leaseCollections, 'currency');
    addRow('New Lease Payment in Advance', 'leaseNewAdvance', r.newLeaseAdvance, 'currency');
    addRow('Payment for existing hectares', 'leaseExistingPayment', r.existingLeasePayment, 'currency');
    addRow('Robots Production', 'leaseRobotsProduction', r.robotsLeased.map(function(v) { return Math.round(v); }), 'number');
    addRow('Cost of production-lease Robot', 'leaseCostOfProduction', r.leaseCOGS, 'currency', { colorClass: 'clr-cost' });
    addRow('Depreciation (Lease)', 'leaseDepreciation', r.depreciation, 'currency', { colorClass: 'clr-cost' });
    addRow('Supplier Payment', 'leaseSupplierPayment', r.leaseSupplierTotal, 'currency', { colorClass: 'clr-cost' });
    addRow('Prepaid Expenses', 'leasePrepaidExpenses', r.leaseSupplierPrepaid, 'currency');
    addRow('Net + Payment', 'leaseNetPayment', r.leaseSupplierNet, 'currency');

    // === SALES section ===
    addSpacer();
    addSectionHeader('Sales');
    addRow('Added Hectares', 'salesAddedHa', r.addedSaleHa.map(function(v) { return Math.round(v); }), 'number');
    addRow('Hectares / Robots accrual', 'salesHectaresAccrual', r.cumulativeSaleHa.map(function(v) { return Math.round(v); }), 'number', { bold: true, overrideKey: 'salesHectaresAccrual' });
    addRow('Revenue', 'salesRevenue', r.salesRevenue, 'currency', { colorClass: 'clr-revenue' });
    addRow('Collections', 'salesCollections', r.salesCollections, 'currency');
    addRow('Sales Prepaid Payment', 'salesPrepaidPayment', r.salesPrepaidPayment, 'currency');
    addRow('Payment upon Shipment', 'salesShipmentPayment', r.salesShipmentPayment, 'currency');
    addRow('COGS', 'salesCOGS', r.salesCOGS, 'currency', { colorClass: 'clr-cost' });
    addRow('Cost of Goods Sold', 'salesCostOfGoodsSold', r.salesCOGS, 'currency', { colorClass: 'clr-cost' });
    addRow('Supplier Payment', 'salesSupplierPayment', r.salesSupplierTotal, 'currency', { colorClass: 'clr-cost' });
    addRow('Prepaid Expenses', 'salesPrepaidExpenses', r.salesSupplierPrepaid, 'currency');
    addRow('Net + Payment', 'salesNetPayment', r.salesSupplierNet, 'currency', { overrideKey: 'salesNetPayment' });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  // Operational Costs table
  function renderOperational(r, a, container) {
    container.innerHTML = '';
    const rows = [
      { label: 'R&D Salaries', values: r.salaryCosts.rd },
      { label: 'S&M Salaries', values: r.salaryCosts.sm },
      { label: 'G&A Salaries', values: r.salaryCosts.ga },
      { label: 'Total Salaries', values: r.totalSalaries, bold: true },
      spacerRow(),
      { label: 'Other OPEX', values: r.otherOpex },
      { label: 'Total OPEX', values: r.totalOpex, bold: true, colorClass: 'clr-cost' }
    ];
    container.appendChild(buildMonthlyTable(null, rows, r.labels));
  }

  // Cash Flow & P&L table
  function renderCFPL(r, container) {
    container.innerHTML = '';
    const rows = [
      { label: 'Total Collections', values: r.totalCollections, colorClass: 'clr-revenue' },
      { label: 'Capital Inflows', values: r.capitalInflows, colorClass: 'clr-revenue' },
      { label: 'Credit Drawdowns', values: r.creditDrawdowns },
      spacerRow(),
      { label: 'Total OPEX', values: r.totalOpex, colorClass: 'clr-cost' },
      { label: 'Supplier Payments', values: r.supplierPayments, colorClass: 'clr-cost' },
      { label: 'Loan Payments', values: r.loanPayments, colorClass: 'clr-cost' },
      { label: 'IIA Royalties', values: r.royalties, colorClass: 'clr-cost' },
      { label: 'Credit Repayments', values: r.creditRepayments, colorClass: 'clr-cost' },
      { label: 'Credit Interest', values: r.creditInterestPaid, colorClass: 'clr-cost' },
      spacerRow(),
      { label: 'Closing Balance', values: r.closingBalance, bold: true, colorClass: 'clr-balance' },
      spacerRow(),
      { label: 'Total Revenue', values: r.totalRevenue, colorClass: 'clr-revenue' },
      { label: 'COGS', values: r.cogs, colorClass: 'clr-cost' },
      { label: 'Gross Profit', values: r.grossProfit, bold: true },
      { label: 'EBITDA', values: r.ebitda, bold: true },
      { label: 'Net Income', values: r.netIncome, bold: true, colorClass: 'clr-balance' }
    ];
    container.appendChild(buildMonthlyTable(null, rows, r.labels));
  }

  // Annual Summary table
  function renderAnnual(r, container) {
    container.innerHTML = '';
    const annual = r.annual;
    const table = document.createElement('table');
    table.className = 'data-table annual-table';

    const thead = document.createElement('thead');
    const hdr = document.createElement('tr');
    ['', ...YEARS.map(String)].forEach(txt => {
      const th = document.createElement('th');
      th.textContent = txt;
      if (txt === '') th.className = 'sticky-col';
      hdr.appendChild(th);
    });
    thead.appendChild(hdr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const fields = [
      { key: 'hectaresAdded', label: 'Hectares Added', format: 'number' },
      { key: 'cumulativeHectares', label: 'Cumulative Hectares', format: 'number', bold: true },
      { key: 'leaseRevenue', label: 'Lease Revenue' },
      { key: 'salesRevenue', label: 'Sales Revenue' },
      { key: 'totalRevenue', label: 'Total Revenue', bold: true, colorClass: 'clr-revenue' },
      { key: 'totalCollections', label: 'Total Collections' },
      { key: 'cogs', label: 'COGS', colorClass: 'clr-cost' },
      { key: 'grossProfit', label: 'Gross Profit', bold: true },
      { key: 'totalSalaries', label: 'Total Salaries', colorClass: 'clr-cost' },
      { key: 'otherOpex', label: 'Other OPEX', colorClass: 'clr-cost' },
      { key: 'totalOpex', label: 'Total OPEX', bold: true, colorClass: 'clr-cost' },
      { key: 'ebitda', label: 'EBITDA', bold: true },
      { key: 'depreciation', label: 'Depreciation' },
      { key: 'loanInterest', label: 'Loan Interest' },
      { key: 'creditInterest', label: 'Credit Interest' },
      { key: 'royalties', label: 'IIA Royalties' },
      { key: 'netIncome', label: 'Net Income', bold: true, colorClass: 'clr-balance' },
      { key: 'capitalInflows', label: 'Capital Inflows' },
      { key: 'loanPayments', label: 'Loan Payments', colorClass: 'clr-cost' },
      { key: 'supplierPayments', label: 'Supplier Payments', colorClass: 'clr-cost' },
      { key: 'closingBalance', label: 'Closing Balance', bold: true, colorClass: 'clr-balance' },
      { key: 'creditBalance', label: 'Credit Balance' }
    ];

    fields.forEach(f => {
      const tr = document.createElement('tr');
      const tdl = document.createElement('td');
      tdl.textContent = f.label;
      tdl.className = 'sticky-col';
      if (f.bold) tdl.style.fontWeight = 'bold';
      tr.appendChild(tdl);

      annual.forEach(yr => {
        const td = document.createElement('td');
        td.textContent = fmt(yr[f.key], f.format || 'currency');
        td.className = 'num';
        if (f.bold) td.style.fontWeight = 'bold';
        if (f.colorClass) td.classList.add(f.colorClass);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  // Loan Amortization
  function renderLoans(r, container) {
    container.innerHTML = '';
    if (r.loans.length === 0) {
      container.textContent = 'No bank loans configured.';
      return;
    }

    r.loans.forEach(loan => {
      const div = document.createElement('div');
      div.className = 'loan-section';

      const h3 = document.createElement('h3');
      h3.textContent = `Loan: ${fmt(loan.amount, 'currency')} (${loan.year}) — ${loan.rate}% over ${loan.termYears || Math.round(loan.term/12)} years`;
      div.appendChild(h3);

      const table = document.createElement('table');
      table.className = 'data-table loan-table';

      const thead = document.createElement('thead');
      const hdr = document.createElement('tr');
      ['Period', 'Month', 'Payment', 'Interest', 'Principal', 'Balance'].forEach(txt => {
        const th = document.createElement('th');
        th.textContent = txt;
        hdr.appendChild(th);
      });
      thead.appendChild(hdr);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const labels = r.labels;
      loan.schedule.forEach((s, i) => {
        const tr = document.createElement('tr');
        [
          i + 1,
          s.month < labels.length ? labels[s.month] : 'M' + (s.month + 1),
          fmt(s.payment, 'currency'),
          fmt(s.interest, 'currency'),
          fmt(s.principal, 'currency'),
          fmt(s.balance, 'currency')
        ].forEach((val, ci) => {
          const td = document.createElement('td');
          td.textContent = val;
          if (ci >= 2) td.className = 'num';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      div.appendChild(table);
      container.appendChild(div);
    });
  }

  // Credit Facility
  function renderCredit(r, container) {
    container.innerHTML = '';
    const rows = [
      { label: 'Drawdowns', values: r.creditDrawdowns },
      { label: 'Repayments', values: r.creditRepayments, colorClass: 'clr-cost' },
      { label: 'Interest Paid', values: r.creditInterestPaid, colorClass: 'clr-cost' },
      { label: 'Outstanding Balance', values: r.creditBalance, bold: true }
    ];
    container.appendChild(buildMonthlyTable(null, rows, r.labels));
  }

  // Detailed Operational Costs (5Y_Operational cost)
  function renderDetailedOperational(r, a, container) {
    container.innerHTML = '';

    // Build FTE arrays per dept (monthly, from quarterly data)
    function deptFTEs(dept) {
      var arr = new Array(TOTAL_MONTHS).fill(0);
      var hc = a.headcount[dept];
      for (var m = 0; m < TOTAL_MONTHS; m++) {
        var qIdx = Math.floor(m / 12) * 4 + Math.floor((m % 12) / 3);
        arr[m] = hc.quarters[qIdx] || 0;
      }
      return arr;
    }

    var rows = [
      { label: 'RESEARCH & DEVELOPMENT', values: new Array(TOTAL_MONTHS).fill(''), format: 'text', bold: true, className: 'spacer-row' },
      { label: 'R&D FTEs', values: deptFTEs('rd'), format: 'number' },
      { label: 'R&D Salaries', values: r.salaryCosts.rd },
    ];

    // Add opex categories
    for (var key in r.opexByCategory) {
      rows.push({ label: r.opexByCategory[key].label, values: r.opexByCategory[key].values });
    }

    rows.push(spacerRow());
    rows.push({ label: 'SALES & MARKETING', values: new Array(TOTAL_MONTHS).fill(''), format: 'text', bold: true, className: 'spacer-row' });
    rows.push({ label: 'S&M FTEs', values: deptFTEs('sm'), format: 'number' });
    rows.push({ label: 'S&M Salaries', values: r.salaryCosts.sm });
    rows.push({ label: 'Customer Tech Support', values: r.customerTechSupport });

    rows.push(spacerRow());
    rows.push({ label: 'GENERAL & ADMINISTRATIVE', values: new Array(TOTAL_MONTHS).fill(''), format: 'text', bold: true, className: 'spacer-row' });
    rows.push({ label: 'G&A FTEs', values: deptFTEs('ga'), format: 'number' });
    rows.push({ label: 'G&A Salaries', values: r.salaryCosts.ga });

    rows.push(spacerRow());
    rows.push({ label: 'Total Salaries', values: r.totalSalaries, bold: true });
    rows.push({ label: 'Total Other OPEX', values: r.otherOpex });
    rows.push({ label: 'Total Customer Tech Support', values: r.customerTechSupport });
    rows.push({ label: 'Total Operational Costs', values: r.totalOpex, bold: true, colorClass: 'clr-cost' });

    container.appendChild(buildMonthlyTable(null, rows, r.labels));
  }

  // Credit Facility Amortization (5Y_Amortization)
  function renderCreditAmortization(r, container) {
    container.innerHTML = '';
    var rows = [
      { label: 'Opening Credit Balance', values: r.creditBalance.map(function (v, i) { return i > 0 ? r.creditBalance[i - 1] : 0; }) },
      { label: 'Credit Drawdowns', values: r.creditDrawdowns, colorClass: 'clr-revenue' },
      { label: 'Credit Repayments', values: r.creditRepayments, colorClass: 'clr-cost' },
      { label: 'Credit Interest Paid', values: r.creditInterestPaid, colorClass: 'clr-cost' },
      { label: 'Closing Credit Balance', values: r.creditBalance, bold: true },
      spacerRow(),
      { label: 'Bank Loan Payments', values: r.loanPayments, colorClass: 'clr-cost' },
      { label: 'Bank Loan Interest', values: r.loanInterest, colorClass: 'clr-cost' },
      { label: 'Bank Loan Principal', values: r.loanPrincipal, colorClass: 'clr-cost' },
      spacerRow(),
      { label: 'Total Collections', values: r.totalCollections, colorClass: 'clr-revenue' },
      { label: 'Supplier Payments', values: r.supplierPayments, colorClass: 'clr-cost' },
      spacerRow(),
      { label: 'Cash Closing Balance', values: r.closingBalance, bold: true, colorClass: 'clr-balance' }
    ];
    container.appendChild(buildMonthlyTable(null, rows, r.labels));
  }

  // Quarterly Headcount (5Y_QTR_Headcount)
  function renderQuarterlyHeadcount(a, container) {
    container.innerHTML = '';
    var numQ = YEARS.length * 4;

    var table = document.createElement('table');
    table.className = 'data-table';

    var thead = document.createElement('thead');
    var yearRow = document.createElement('tr');
    var th0a = document.createElement('th');
    th0a.className = 'sticky-col';
    yearRow.appendChild(th0a);
    var th0b = document.createElement('th');
    th0b.textContent = 'Monthly Cost';
    yearRow.appendChild(th0b);
    for (var y = 0; y < YEARS.length; y++) {
      var yth = document.createElement('th');
      yth.colSpan = 4;
      yth.textContent = YEARS[y];
      yth.className = 'year-header';
      yearRow.appendChild(yth);
    }
    thead.appendChild(yearRow);

    var qRow = document.createElement('tr');
    var qth0 = document.createElement('th');
    qth0.className = 'sticky-col';
    qth0.textContent = 'Department / Role';
    qRow.appendChild(qth0);
    var qth1 = document.createElement('th');
    qth1.textContent = '$/mo';
    qRow.appendChild(qth1);
    for (var y = 0; y < YEARS.length; y++) {
      for (var q = 1; q <= 4; q++) {
        var qth = document.createElement('th');
        qth.textContent = 'Q' + q;
        if (q === 1) qth.className = 'year-start';
        qRow.appendChild(qth);
      }
    }
    thead.appendChild(qRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    function addDeptSection(dept, label) {
      var hdr = document.createElement('tr');
      hdr.className = 'spacer-row';
      var hdrTd = document.createElement('td');
      hdrTd.className = 'sticky-col';
      hdrTd.textContent = label;
      hdrTd.style.fontWeight = 'bold';
      hdr.appendChild(hdrTd);
      for (var c = 0; c < numQ + 1; c++) hdr.appendChild(document.createElement('td'));
      tbody.appendChild(hdr);

      var hc = a.headcount[dept];
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.className = 'sticky-col';
      tdLabel.textContent = hc.label + ' Staff';
      tr.appendChild(tdLabel);

      var tdSalary = document.createElement('td');
      tdSalary.className = 'num';
      tdSalary.textContent = fmt(hc.salary, 'currency');
      tr.appendChild(tdSalary);

      for (var qi = 0; qi < numQ; qi++) {
        var td = document.createElement('td');
        td.className = 'num';
        td.textContent = hc.quarters[qi] || 0;
        if (qi % 4 === 0) td.classList.add('year-start');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);

      var costTr = document.createElement('tr');
      var costLabel = document.createElement('td');
      costLabel.className = 'sticky-col';
      costLabel.textContent = hc.label + ' Total Cost';
      costLabel.style.fontWeight = 'bold';
      costTr.appendChild(costLabel);
      costTr.appendChild(document.createElement('td'));
      for (var qi = 0; qi < numQ; qi++) {
        var td = document.createElement('td');
        td.className = 'num';
        var qCost = (hc.quarters[qi] || 0) * hc.salary * 3;
        td.textContent = fmt(qCost, 'currency');
        td.style.fontWeight = 'bold';
        if (qi % 4 === 0) td.classList.add('year-start');
        costTr.appendChild(td);
      }
      tbody.appendChild(costTr);
    }

    addDeptSection('rd', 'RESEARCH & DEVELOPMENT');
    addDeptSection('sm', 'SALES & MARKETING');
    addDeptSection('ga', 'GENERAL & ADMINISTRATIVE');

    var spacer = document.createElement('tr');
    spacer.className = 'spacer-row';
    var sp0 = document.createElement('td');
    sp0.className = 'sticky-col';
    spacer.appendChild(sp0);
    for (var c = 0; c < numQ + 1; c++) spacer.appendChild(document.createElement('td'));
    tbody.appendChild(spacer);

    var totalTr = document.createElement('tr');
    var totalLabel = document.createElement('td');
    totalLabel.className = 'sticky-col';
    totalLabel.textContent = 'GRAND TOTAL FTEs';
    totalLabel.style.fontWeight = 'bold';
    totalTr.appendChild(totalLabel);
    totalTr.appendChild(document.createElement('td'));
    for (var qi = 0; qi < numQ; qi++) {
      var td = document.createElement('td');
      td.className = 'num';
      td.style.fontWeight = 'bold';
      var total = 0;
      for (var d = 0; d < ['rd', 'sm', 'ga'].length; d++) {
        total += a.headcount[['rd', 'sm', 'ga'][d]].quarters[qi] || 0;
      }
      td.textContent = total;
      if (qi % 4 === 0) td.classList.add('year-start');
      totalTr.appendChild(td);
    }
    tbody.appendChild(totalTr);

    var totalCostTr = document.createElement('tr');
    var totalCostLabel = document.createElement('td');
    totalCostLabel.className = 'sticky-col';
    totalCostLabel.textContent = 'GRAND TOTAL COST';
    totalCostLabel.style.fontWeight = 'bold';
    totalCostTr.appendChild(totalCostLabel);
    totalCostTr.appendChild(document.createElement('td'));
    for (var qi = 0; qi < numQ; qi++) {
      var td = document.createElement('td');
      td.className = 'num';
      td.style.fontWeight = 'bold';
      td.classList.add('clr-cost');
      var total = 0;
      for (var d = 0; d < ['rd', 'sm', 'ga'].length; d++) {
        var dept = ['rd', 'sm', 'ga'][d];
        total += (a.headcount[dept].quarters[qi] || 0) * a.headcount[dept].salary * 3;
      }
      td.textContent = fmt(total, 'currency');
      if (qi % 4 === 0) td.classList.add('year-start');
      totalCostTr.appendChild(td);
    }
    tbody.appendChild(totalCostTr);

    table.appendChild(tbody);
    container.appendChild(table);
  }

  // Customer Tech Support (5Y_Customer_Tech_Support)
  function renderCustomerTechSupport(r, a, container) {
    container.innerHTML = '';
    var rows = [
      { label: 'Spare Parts per Robot ($/mo)', values: r.labels.map(function (l, m) { return a.sparePartsPerRobot ? a.sparePartsPerRobot[Math.floor(m / 12)] : 0; }), format: 'currency' },
      { label: 'Subcontractor Cost per Robot ($/mo)', values: r.labels.map(function (l, m) { return a.subcontractorCostPerRobot ? a.subcontractorCostPerRobot[Math.floor(m / 12)] : 0; }), format: 'currency' },
      { label: 'Cumulative Hectares/Robots', values: r.cumulativeHectares, format: 'number' },
      spacerRow(),
      { label: 'Total Spare Parts Cost', values: r.sparePartsCost },
      { label: 'Total Subcontractor Cost', values: r.subcontractorCost },
      { label: 'Total Customer Tech Support', values: r.customerTechSupport, bold: true, colorClass: 'clr-cost' }
    ];
    container.appendChild(buildMonthlyTable(null, rows, r.labels));
  }

  return {
    render5YData,
    renderOperational,
    renderCFPL,
    renderAnnual,
    renderLoans,
    renderCredit,
    renderDetailedOperational,
    renderCreditAmortization,
    renderQuarterlyHeadcount,
    renderCustomerTechSupport
  };
})();
