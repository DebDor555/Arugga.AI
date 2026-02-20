// Arugga 5-Year Budget — Calculation Engine
// Replicates all Excel formula chains from the 13-sheet financial model

const Engine = (function () {

  // Helper: month labels Jan-26 .. Dec-30 (dynamic based on YEARS)
  function monthLabels() {
    const labels = [];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let y = 0; y < YEARS.length; y++) {
      const suffix = String(YEARS[y]).slice(-2);
      for (let m = 0; m < 12; m++) {
        labels.push(monthNames[m] + '-' + suffix);
      }
    }
    return labels;
  }

  // Helper: which quarter (0-3) for month index
  function quarterOf(m) { return Math.floor((m % 12) / 3); }

  // Helper: which year index for month index
  function yearOf(m) { return Math.floor(m / 12); }

  // PMT calculation (Excel PMT function)
  function PMT(rate, nper, pv) {
    if (rate === 0) return -pv / nper;
    const r = rate;
    return -pv * r * Math.pow(1 + r, nper) / (Math.pow(1 + r, nper) - 1);
  }

  // IPMT - interest portion of payment for period
  function IPMT(rate, per, nper, pv) {
    if (rate === 0) return 0;
    const payment = PMT(rate, nper, pv);
    let balance = pv;
    for (let i = 1; i < per; i++) {
      balance += balance * rate + payment;
    }
    return balance * rate;
  }

  // PPMT - principal portion of payment for period
  function PPMT(rate, per, nper, pv) {
    return PMT(rate, nper, pv) - IPMT(rate, per, nper, pv);
  }

  function calculate(a) {
    const N = TOTAL_MONTHS;
    const numYears = YEARS.length;
    const results = {};

    // Year0 ending values for seeding
    const y0 = a.year0 || {};
    const y0EndCumHa = (y0.cumulativeHectares && y0.cumulativeHectares[11]) || 0;
    const y0EndLeaseHa = (y0.leaseHectares && y0.leaseHectares[11]) || 0;
    const y0EndSalesHa = (y0.salesHectaresAccrual && y0.salesHectaresAccrual[11]) || 0;
    const overrides = a.year1Overrides || {};

    // ===== 1. Monthly hectare distribution =====
    const addedHectares = new Array(N).fill(0);
    const cumulativeHectares = new Array(N).fill(0);

    for (let y = 0; y < numYears; y++) {
      const yearlyHa = a.hectaresPerYear[y];
      for (let q = 0; q < 4; q++) {
        const qHa = yearlyHa * (a.quarterlyDist[y][q] / 100);
        const monthsInQ = 3;
        const monthlyHa = qHa / monthsInQ;
        for (let mInQ = 0; mInQ < 3; mInQ++) {
          const mIdx = y * 12 + q * 3 + mInQ;
          addedHectares[mIdx] = monthlyHa;
        }
      }
    }

    // Cumulative hectares — seeded from year0 ending value
    for (let m = 0; m < N; m++) {
      cumulativeHectares[m] = (m > 0 ? cumulativeHectares[m - 1] : y0EndCumHa) + addedHectares[m];
    }

    // ===== 2. Robot split: lease vs sale (per-year %) =====
    const addedLeaseHa = addedHectares.map((h, m) => h * (a.leasingPct[yearOf(m)] / 100));
    const addedSaleHa = addedHectares.map((h, m) => h * (a.salesPct[yearOf(m)] / 100));

    const cumulativeLeaseHa = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      cumulativeLeaseHa[m] = (m > 0 ? cumulativeLeaseHa[m - 1] : y0EndLeaseHa) + addedLeaseHa[m];
    }

    // Cumulative sales hectares — month 0 may be overridden
    const cumulativeSaleHa = new Array(N).fill(0);
    if (overrides.salesHectaresAccrual) {
      cumulativeSaleHa[0] = overrides.salesHectaresAccrual;
    } else {
      cumulativeSaleHa[0] = y0EndSalesHa + addedSaleHa[0];
    }
    for (let m = 1; m < N; m++) {
      cumulativeSaleHa[m] = cumulativeSaleHa[m - 1] + addedSaleHa[m];
    }

    const robotsSold = addedSaleHa.slice();
    const robotsLeased = addedLeaseHa.slice();

    // ===== 3. Revenue =====
    const leaseRevenue = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      leaseRevenue[m] = cumulativeLeaseHa[m] * a.leasePrice[yearOf(m)];
    }

    const salesRevenue = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      salesRevenue[m] = robotsSold[m] * a.salesPrice[yearOf(m)];
    }

    const totalRevenue = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      totalRevenue[m] = leaseRevenue[m] + salesRevenue[m];
    }

    // ===== 4. Collections (broken into sub-components) =====
    const newLeaseAdvance = new Array(N).fill(0);
    const existingLeasePayment = new Array(N).fill(0);
    const leaseCollections = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      const yM = yearOf(m);
      // New lease advance payments
      if (addedLeaseHa[m] > 0) {
        newLeaseAdvance[m] = addedLeaseHa[m] * a.leasePrice[yM] * a.leaseAdvanceMonths[yM];
      }
      // Existing lease payments from model-period hectares
      for (let prev = 0; prev <= m; prev++) {
        const yPrev = yearOf(prev);
        const monthsSinceAdded = m - prev;
        if (monthsSinceAdded >= a.leaseAdvanceMonths[yPrev] && addedLeaseHa[prev] > 0) {
          existingLeasePayment[m] += addedLeaseHa[prev] * a.leasePrice[yM];
        }
      }
      // Year0 lease hectares continue paying monthly
      if (y0EndLeaseHa > 0) {
        existingLeasePayment[m] += y0EndLeaseHa * a.leasePrice[yM];
      }
      leaseCollections[m] = newLeaseAdvance[m] + existingLeasePayment[m];
    }

    const salesPrepaidPayment = new Array(N).fill(0);
    const salesShipmentPayment = new Array(N).fill(0);
    const salesCollections = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      if (robotsSold[m] > 0) {
        const yM = yearOf(m);
        const totalSale = robotsSold[m] * a.salesPrice[yM];
        const prepaid = totalSale * (a.salesPrepaidRatio[yM] / 100);
        const remainder = totalSale - prepaid;

        const prepaidMonth = m - a.salesAdvanceMonths[yM];
        if (prepaidMonth >= 0) {
          salesPrepaidPayment[prepaidMonth] += prepaid;
        } else {
          salesPrepaidPayment[0] += prepaid;
        }
        salesShipmentPayment[m] += remainder;
      }
    }

    for (let m = 0; m < N; m++) {
      salesCollections[m] = salesPrepaidPayment[m] + salesShipmentPayment[m];
    }

    const totalCollections = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      totalCollections[m] = leaseCollections[m] + salesCollections[m];
    }

    // ===== 5. COGS — broken into lease and sales =====
    const totalRobots = new Array(N).fill(0);
    const leaseCOGS = new Array(N).fill(0);
    const salesCOGS = new Array(N).fill(0);
    const cogs = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      const yM = yearOf(m);
      totalRobots[m] = robotsSold[m] + robotsLeased[m];
      leaseCOGS[m] = robotsLeased[m] * a.productionCost[yM];
      salesCOGS[m] = robotsSold[m] * a.productionCost[yM];
      cogs[m] = leaseCOGS[m] + salesCOGS[m];
    }

    // Supplier payments — broken into lease/sales, prepaid/net
    const leaseSupplierPrepaid = new Array(N).fill(0);
    const leaseSupplierNet = new Array(N).fill(0);
    const salesSupplierPrepaid = new Array(N).fill(0);
    const salesSupplierNet = new Array(N).fill(0);
    const supplierPayments = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      const yM = yearOf(m);
      // Lease robots
      if (leaseCOGS[m] > 0) {
        const prepay = leaseCOGS[m] * (a.supplierPrepayRatio[yM] / 100);
        const net = leaseCOGS[m] - prepay;
        const prepayMonth = m - a.rmPrepayMonths[yM];
        if (prepayMonth >= 0) leaseSupplierPrepaid[prepayMonth] += prepay;
        else leaseSupplierPrepaid[0] += prepay;
        const netMonth = m + a.paymentNetMonths[yM];
        if (netMonth < N) leaseSupplierNet[netMonth] += net;
      }
      // Sales robots
      if (salesCOGS[m] > 0) {
        const prepay = salesCOGS[m] * (a.supplierPrepayRatio[yM] / 100);
        const net = salesCOGS[m] - prepay;
        const prepayMonth = m - a.rmPrepayMonths[yM];
        if (prepayMonth >= 0) salesSupplierPrepaid[prepayMonth] += prepay;
        else salesSupplierPrepaid[0] += prepay;
        const netMonth = m + a.paymentNetMonths[yM];
        if (netMonth < N) salesSupplierNet[netMonth] += net;
      }
    }

    // Year1 override: sales net payment for month 0 (from prior-year production)
    if (overrides.salesNetPayment) {
      salesSupplierNet[0] += overrides.salesNetPayment;
    }

    // Compute totals per category
    const leaseSupplierTotal = new Array(N).fill(0);
    const salesSupplierTotal = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      leaseSupplierTotal[m] = leaseSupplierPrepaid[m] + leaseSupplierNet[m];
      salesSupplierTotal[m] = salesSupplierPrepaid[m] + salesSupplierNet[m];
      supplierPayments[m] = leaseSupplierTotal[m] + salesSupplierTotal[m];
    }

    // ===== 6. Depreciation =====
    const depreciation = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      if (robotsLeased[m] > 0) {
        const yM = yearOf(m);
        const lifetime = a.robotLifetime[yM];
        const monthlyDep = (robotsLeased[m] * a.productionCost[yM]) / lifetime;
        for (let d = m; d < Math.min(m + lifetime, N); d++) {
          depreciation[d] += monthlyDep;
        }
      }
    }

    // Total COGS for accounting (sales COGS + depreciation)
    const totalCOGSAccounting = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      totalCOGSAccounting[m] = salesCOGS[m] + depreciation[m];
    }

    // ===== 6b. Customer Tech Support =====
    const sparePartsCost = new Array(N).fill(0);
    const subcontractorCost = new Array(N).fill(0);
    const customerTechSupport = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      const yM = yearOf(m);
      sparePartsCost[m] = cumulativeHectares[m] * (a.sparePartsPerRobot ? a.sparePartsPerRobot[yM] : 0);
      subcontractorCost[m] = cumulativeHectares[m] * (a.subcontractorCostPerRobot ? a.subcontractorCostPerRobot[yM] : 0);
      customerTechSupport[m] = sparePartsCost[m] + subcontractorCost[m];
    }

    // ===== 7. Operational costs =====
    const salaryCosts = { rd: new Array(N).fill(0), sm: new Array(N).fill(0), ga: new Array(N).fill(0) };
    const totalSalaries = new Array(N).fill(0);

    for (const dept of ['rd', 'sm', 'ga']) {
      const hc = a.headcount[dept];
      for (let m = 0; m < N; m++) {
        const qIdx = yearOf(m) * 4 + quarterOf(m);
        const headcount = hc.quarters[qIdx] || 0;
        salaryCosts[dept][m] = headcount * hc.salary;
        totalSalaries[m] += salaryCosts[dept][m];
      }
    }

    const otherOpex = new Array(N).fill(0);
    const opexByCategory = {};
    for (const key in a.operationalCosts) {
      const cat = a.operationalCosts[key];
      opexByCategory[key] = { label: cat.label, values: new Array(N).fill(0) };
      for (let m = 0; m < N; m++) {
        const yIdx = yearOf(m);
        const val = cat.yearly[yIdx] || 0;
        opexByCategory[key].values[m] = val;
        otherOpex[m] += val;
      }
    }

    const totalOpex = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      totalOpex[m] = totalSalaries[m] + otherOpex[m];
    }

    // ===== 8. Loan amortization =====
    const loans = [];
    const loanPayments = new Array(N).fill(0);
    const loanInterest = new Array(N).fill(0);
    const loanPrincipal = new Array(N).fill(0);

    for (let y = 0; y < numYears; y++) {
      const amount = a.bankLoansPerYear[y];
      if (amount <= 0) continue;
      const startMonth = y * 12;
      const monthlyRate = (a.bankLoanRate[y] / 100) / 12;
      const termMonths = a.bankLoanTerm[y] * 12;
      const monthlyPayment = -PMT(monthlyRate, termMonths, amount);

      const loan = {
        year: YEARS[y],
        amount: amount,
        startMonth: startMonth,
        term: termMonths,
        termYears: a.bankLoanTerm[y],
        rate: a.bankLoanRate[y],
        schedule: []
      };

      let balance = amount;
      for (let p = 1; p <= termMonths; p++) {
        const mIdx = startMonth + p - 1;
        const interest = balance * monthlyRate;
        const principal = monthlyPayment - interest;
        balance -= principal;

        loan.schedule.push({
          month: mIdx,
          payment: monthlyPayment,
          interest: interest,
          principal: principal,
          balance: Math.max(balance, 0)
        });

        if (mIdx < N) {
          loanPayments[mIdx] += monthlyPayment;
          loanInterest[mIdx] += interest;
          loanPrincipal[mIdx] += principal;
        }
      }
      loans.push(loan);
    }

    // ===== 9. IIA Royalties =====
    const royalties = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      royalties[m] = totalRevenue[m] * (a.iiaRoyalties[yearOf(m)] / 100);
    }

    // ===== 10. Cash Flow =====
    const capitalInflows = new Array(N).fill(0);
    for (let y = 0; y < numYears; y++) {
      if (a.capitalRaised[y] > 0 && a.capitalMonth[y] >= 1 && a.capitalMonth[y] <= 12) {
        const mIdx = y * 12 + (a.capitalMonth[y] - 1);
        capitalInflows[mIdx] = a.capitalRaised[y];
      }
    }

    const cashFlowBeforeCredit = new Array(N).fill(0);
    const closingBalance = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      cashFlowBeforeCredit[m] =
        totalCollections[m]
        + capitalInflows[m]
        - totalOpex[m]
        - supplierPayments[m]
        - loanPayments[m]
        - royalties[m];
    }

    // ===== 11. Credit facility =====
    // Compute effective credit facility limit from Cresson + Bank (backward compat)
    const creditFacilityLimit = new Array(numYears).fill(0);
    if (a.cressonCreditFacility && a.bankLineOfCredit) {
      for (let y = 0; y < numYears; y++) {
        creditFacilityLimit[y] = (a.cressonCreditFacility[y] || 0) + (a.bankLineOfCredit[y] || 0);
      }
    } else if (a.creditFacilityLimit) {
      for (let y = 0; y < numYears; y++) {
        creditFacilityLimit[y] = a.creditFacilityLimit[y] || 0;
      }
    }

    const creditDrawdowns = new Array(N).fill(0);
    const creditRepayments = new Array(N).fill(0);
    const creditBalance = new Array(N).fill(0);
    const creditInterestPaid = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      const yM = yearOf(m);
      const monthlyFacilityRate = (a.creditFacilityRate[yM] / 100) / 12;
      const facilityLimit = creditFacilityLimit[yM];
      const prevBalance = m > 0 ? closingBalance[m - 1] : 0;
      const prevCreditBal = m > 0 ? creditBalance[m - 1] : 0;

      const interest = prevCreditBal * monthlyFacilityRate;
      creditInterestPaid[m] = interest;

      let cashPos = prevBalance + cashFlowBeforeCredit[m] - interest;

      if (cashPos < 0) {
        const drawNeeded = Math.min(-cashPos, Math.max(facilityLimit - prevCreditBal, 0));
        creditDrawdowns[m] = drawNeeded;
        cashPos += drawNeeded;
        creditBalance[m] = prevCreditBal + drawNeeded;
      } else if (prevCreditBal > 0 && cashPos > 0) {
        const repay = Math.min(cashPos, prevCreditBal);
        creditRepayments[m] = repay;
        cashPos -= repay;
        creditBalance[m] = prevCreditBal - repay;
      } else {
        creditBalance[m] = prevCreditBal;
      }

      closingBalance[m] = cashPos;
    }

    // ===== 12. EBITDA & P&L =====
    const grossProfit = new Array(N).fill(0);
    const ebitda = new Array(N).fill(0);
    const netIncome = new Array(N).fill(0);

    for (let m = 0; m < N; m++) {
      grossProfit[m] = totalRevenue[m] - cogs[m];
      ebitda[m] = grossProfit[m] - totalOpex[m];
      netIncome[m] = ebitda[m] - depreciation[m] - loanInterest[m] - creditInterestPaid[m] - royalties[m];
    }

    // ===== 13. Annual summary =====
    const annual = YEARS.map((yr, y) => {
      const start = y * 12;
      const end = start + 12;
      const sum = (arr) => arr.slice(start, end).reduce((a, b) => a + b, 0);
      return {
        year: yr,
        hectaresAdded: sum(addedHectares),
        cumulativeHectares: cumulativeHectares[end - 1],
        leaseRevenue: sum(leaseRevenue),
        salesRevenue: sum(salesRevenue),
        totalRevenue: sum(totalRevenue),
        totalCollections: sum(totalCollections),
        cogs: sum(cogs),
        grossProfit: sum(grossProfit),
        rdExpenses: sum(salaryCosts.rd),
        smExpenses: sum(salaryCosts.sm),
        gaExpenses: sum(salaryCosts.ga),
        totalSalaries: sum(totalSalaries),
        otherOpex: sum(otherOpex),
        totalOpex: sum(totalOpex),
        ebitda: sum(ebitda),
        depreciation: sum(depreciation),
        loanInterest: sum(loanInterest),
        creditInterest: sum(creditInterestPaid),
        royalties: sum(royalties),
        netIncome: sum(netIncome),
        capitalInflows: sum(capitalInflows),
        loanPayments: sum(loanPayments),
        loanInterestAnnual: sum(loanInterest),
        loanPrincipalAnnual: sum(loanPrincipal),
        creditDrawdowns: sum(creditDrawdowns),
        creditRepayments: sum(creditRepayments),
        supplierPayments: sum(supplierPayments),
        closingBalance: closingBalance[end - 1],
        creditBalance: creditBalance[end - 1],
        creditFacilityLimit: creditFacilityLimit[y]
      };
    });

    // ===== 14. FCF =====
    const fcf = new Array(N).fill(0);
    for (let m = 0; m < N; m++) {
      fcf[m] = closingBalance[m];
    }

    // ===== Package results =====
    results.labels = monthLabels();
    results.addedHectares = addedHectares;
    results.cumulativeHectares = cumulativeHectares;
    results.addedLeaseHa = addedLeaseHa;
    results.addedSaleHa = addedSaleHa;
    results.cumulativeLeaseHa = cumulativeLeaseHa;
    results.cumulativeSaleHa = cumulativeSaleHa;
    results.robotsSold = robotsSold;
    results.robotsLeased = robotsLeased;
    results.totalRobots = totalRobots;
    results.leaseRevenue = leaseRevenue;
    results.salesRevenue = salesRevenue;
    results.totalRevenue = totalRevenue;
    // Collection sub-components
    results.newLeaseAdvance = newLeaseAdvance;
    results.existingLeasePayment = existingLeasePayment;
    results.leaseCollections = leaseCollections;
    results.salesPrepaidPayment = salesPrepaidPayment;
    results.salesShipmentPayment = salesShipmentPayment;
    results.salesCollections = salesCollections;
    results.totalCollections = totalCollections;
    // COGS sub-components
    results.leaseCOGS = leaseCOGS;
    results.salesCOGS = salesCOGS;
    results.cogs = cogs;
    results.totalCOGSAccounting = totalCOGSAccounting;
    // Supplier payment sub-components
    results.leaseSupplierPrepaid = leaseSupplierPrepaid;
    results.leaseSupplierNet = leaseSupplierNet;
    results.leaseSupplierTotal = leaseSupplierTotal;
    results.salesSupplierPrepaid = salesSupplierPrepaid;
    results.salesSupplierNet = salesSupplierNet;
    results.salesSupplierTotal = salesSupplierTotal;
    results.supplierPayments = supplierPayments;
    results.depreciation = depreciation;
    results.salaryCosts = salaryCosts;
    results.totalSalaries = totalSalaries;
    results.otherOpex = otherOpex;
    results.opexByCategory = opexByCategory;
    results.totalOpex = totalOpex;
    results.loans = loans;
    results.loanPayments = loanPayments;
    results.loanInterest = loanInterest;
    results.loanPrincipal = loanPrincipal;
    results.sparePartsCost = sparePartsCost;
    results.subcontractorCost = subcontractorCost;
    results.customerTechSupport = customerTechSupport;
    results.royalties = royalties;
    results.capitalInflows = capitalInflows;
    results.cashFlowBeforeCredit = cashFlowBeforeCredit;
    results.creditDrawdowns = creditDrawdowns;
    results.creditRepayments = creditRepayments;
    results.creditBalance = creditBalance;
    results.creditFacilityLimit = creditFacilityLimit;
    results.creditInterestPaid = creditInterestPaid;
    results.closingBalance = closingBalance;
    results.grossProfit = grossProfit;
    results.ebitda = ebitda;
    results.netIncome = netIncome;
    results.annual = annual;

    return results;
  }

  return { calculate, monthLabels };
})();
