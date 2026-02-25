// Arugga 5-Year Budget — Assumption Definitions & Defaults
// All values based on "Arugga 5 Years Business Budget.xlsx"

const NUM_YEARS = 5;
let YEARS = [2026, 2027, 2028, 2029, 2030];
let TOTAL_MONTHS = 60; // 5 years x 12

function setVersion(startYear) {
  YEARS = [];
  for (let i = 0; i < NUM_YEARS; i++) {
    YEARS.push(startYear + i);
  }
  TOTAL_MONTHS = NUM_YEARS * 12;
}

// Create empty per-role headcount structure matching Excel 5Y_QTR_Headcount sheet
function makeEmptyHeadcount() {
  var q = function () { return new Array(NUM_YEARS * 4).fill(0); };
  return {
    rd: {
      label: 'Research & Development',
      roles: [
        { role: 'VP R&D',      salary: 0, quarters: q() },
        { role: 'Engineer',    salary: 0, quarters: q() },
        { role: 'Programmer',  salary: 0, quarters: q() },
        { role: 'QA',          salary: 0, quarters: q() },
        { role: 'Agronomist',  salary: 0, quarters: q() },
        { role: 'CTO',         salary: 0, quarters: q() },
        { role: 'IT',          salary: 0, quarters: q() }
      ]
    },
    sm: {
      label: 'Sales & Marketing',
      roles: [
        { role: 'VP Business Development',  salary: 0, quarters: q() },
        { role: 'VP Marketing & Sales',     salary: 0, quarters: q() },
        { role: 'Sales Manager',            salary: 0, quarters: q() },
        { role: 'Sales Coordinator',        salary: 0, quarters: q() },
        { role: 'Customer Service Manager', salary: 0, quarters: q() },
        { role: 'Technicians',              salary: 0, quarters: q() },
        { role: 'Marketing Manager',        salary: 0, quarters: q() }
      ]
    },
    ga: {
      label: 'General & Administrative',
      roles: [
        { role: 'CEO',             salary: 0, quarters: q() },
        { role: 'CFO',             salary: 0, quarters: q() },
        { role: 'COO',             salary: 0, quarters: q() },
        { role: 'Accountant',      salary: 0, quarters: q() },
        { role: 'Controller',      salary: 0, quarters: q() },
        { role: 'Administration',  salary: 0, quarters: q() },
        { role: 'Procurement',     salary: 0, quarters: q() },
        { role: 'Human Resources', salary: 0, quarters: q() }
      ]
    }
  };
}

// Create empty year0 data (12-month manual arrays for the year before version start)
function getEmptyYear0() {
  var z12 = function () { return new Array(12).fill(0); };
  return {
    // Top section (fractional)
    addedHectares: z12(), cumulativeHectares: z12(),
    // Total section
    totalAddedHectares: z12(), totalCumulativeHectares: z12(),
    totalRevenue: z12(), totalCollections: z12(),
    totalCOGS: z12(), costOfGoodsSold: z12(),
    depreciationLease: z12(), opex: z12(), supplierPayment: z12(),
    // Lease section
    leaseAddedHa: z12(), leaseHectares: z12(),
    leaseRevenue: z12(), leaseCollections: z12(),
    leaseNewAdvance: z12(), leaseExistingPayment: z12(),
    leaseRobotsProduction: z12(), leaseCostOfProduction: z12(),
    leaseDepreciation: z12(), leaseSupplierPayment: z12(),
    leasePrepaidExpenses: z12(), leaseNetPayment: z12(),
    // Sales section
    salesAddedHa: z12(), salesHectaresAccrual: z12(),
    salesRevenue: z12(), salesCollections: z12(),
    salesPrepaidPayment: z12(), salesShipmentPayment: z12(),
    salesCOGS: z12(), salesCostOfGoodsSold: z12(),
    salesSupplierPayment: z12(), salesPrepaidExpenses: z12(),
    salesNetPayment: z12()
  };
}

function getEmptyAssumptions() {
  const z = () => new Array(NUM_YEARS).fill(0);
  return {
    hectaresPerYear: z(),
    salesPct: new Array(NUM_YEARS).fill(35),
    leasingPct: new Array(NUM_YEARS).fill(65),
    quarterlyDist: Array.from({ length: NUM_YEARS }, () => [25, 25, 25, 25]),
    leasePrice:         z(),
    leaseAdvanceMonths: z(),
    salesPrice:         z(),
    salesPrepaidRatio:  z(),
    salesAdvanceMonths: z(),
    salesShipmentRatio: z(),
    robotLifetime:      new Array(NUM_YEARS).fill(60),
    productionCost:     z(),
    rmPrepayMonths:     z(),
    paymentNetMonths:   z(),
    supplierPrepayRatio:z(),
    capitalRaised:      z(),
    capitalMonth:       new Array(NUM_YEARS).fill(6),
    cressonCreditFacility: z(),
    bankLineOfCredit:   z(),
    creditFacilityRate: z(),
    bankLoansPerYear:   z(),
    bankLoanRate:       z(),
    bankLoanTerm:       new Array(NUM_YEARS).fill(1),
    collectionLoanPct:  z(),
    iiaRoyalties:       z(),
    monthsOfActivity:   new Array(NUM_YEARS).fill(12),
    opCostRatio:        new Array(NUM_YEARS).fill(80),
    overdueRatio:       new Array(NUM_YEARS).fill(10),
    collectionRatio:    new Array(NUM_YEARS).fill(90),
    sparePartsPerRobot:       new Array(NUM_YEARS).fill(50),
    subcontractorCostPerRobot:new Array(NUM_YEARS).fill(200),
    headcount: makeEmptyHeadcount(),
    operationalCosts: {
      subcontractors:  { label: 'Subcontractors',       yearly: z() },
      materials:       { label: 'Materials & Supplies',  yearly: z() },
      rent:            { label: 'Rent & Utilities',      yearly: z() },
      patents:         { label: 'Patents & IP',          yearly: z() },
      travel:          { label: 'Travel & Conferences',  yearly: z() },
      marketing:       { label: 'Marketing',             yearly: z() },
      insurance:       { label: 'Insurance',             yearly: z() },
      legal:           { label: 'Legal & Accounting',    yearly: z() },
      misc:            { label: 'Miscellaneous',         yearly: z() }
    },
    year0: getEmptyYear0(),
    year1Overrides: {
      salesHectaresAccrual: 0,
      salesNetPayment: 0
    }
  };
}

// Original 6-year defaults (used for migration)
function getLegacyDefaults() {
  return {
    hectaresPerYear: [200, 500, 850, 1250, 1700, 1700],
    salesPct: [35, 35, 35, 35, 35, 35],
    leasingPct: [65, 65, 65, 65, 65, 65],
    quarterlyDist: [
      [10, 20, 30, 40],
      [10, 20, 30, 40],
      [10, 20, 30, 40],
      [10, 20, 30, 40],
      [10, 20, 30, 40],
      [10, 20, 30, 40]
    ],
    leasePrice:         [997, 997, 997, 997, 997, 997],
    leaseAdvanceMonths: [6, 6, 6, 6, 6, 6],
    salesPrice:         [60000, 60000, 60000, 60000, 60000, 60000],
    salesPrepaidRatio:  [50, 50, 50, 50, 50, 50],
    salesAdvanceMonths: [3, 3, 3, 3, 3, 3],
    salesShipmentRatio: [50, 50, 50, 50, 50, 50],
    robotLifetime:      [60, 60, 60, 60, 60, 60],
    productionCost:     [25000, 25000, 25000, 25000, 25000, 25000],
    rmPrepayMonths:     [3, 3, 3, 3, 3, 3],
    paymentNetMonths:   [1, 1, 1, 1, 1, 1],
    supplierPrepayRatio:[50, 50, 50, 50, 50, 50],
    capitalRaised:      [5000000, 0, 0, 0, 0, 0],
    capitalMonth:       [6, 6, 6, 6, 6, 6],
    cressonCreditFacility: [3800000, 0, 0, 0, 0, 0],
    bankLineOfCredit:   [0, 3800000, 3800000, 0, 0, 0],
    creditFacilityRate: [8, 8, 8, 8, 8, 8],
    bankLoansPerYear:   [2200000, 1800000, 1500000, 1500000, 0, 0],
    bankLoanRate:       [7, 6, 5, 4, 1, 1],
    bankLoanTerm:       [3, 4, 3, 2, 1, 1],
    collectionLoanPct:  [25, 25, 25, 25, 25, 25],
    iiaRoyalties:       [3, 3, 3, 3, 3, 3],
    monthsOfActivity:   [12, 12, 12, 12, 12, 12],
    opCostRatio:        [80, 80, 80, 80, 80, 80],
    overdueRatio:       [10, 10, 10, 10, 10, 10],
    collectionRatio:    [90, 90, 90, 90, 90, 90],
    sparePartsPerRobot:       [50, 50, 50, 50, 50, 50],
    subcontractorCostPerRobot:[200, 180, 170, 160, 150, 150],
    headcount: {
      rd: {
        label: 'Research & Development',
        roles: [
          { role: 'VP R&D',      salary: 10000, quarters: [0.5,0.5,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'Engineer',    salary: 10000, quarters: [5,5,6,7,   7,7,7,8, 8,8,8,8, 9,9,9,9, 9,9,9,9] },
          { role: 'Programmer',  salary: 13500, quarters: [5,6,6,7,   7,7,7,8, 8,8,8,8, 8,8,8,8, 8,8,8,8] },
          { role: 'QA',          salary: 5000,  quarters: [1,1,2,2,   2,2,2,2, 2,2,2,2, 2,2,2,2, 2,2,2,2] },
          { role: 'Agronomist',  salary: 8000,  quarters: [1,1,2,2,   2,2,2,3, 3,3,3,3, 4,4,4,4, 4,4,4,4] },
          { role: 'CTO',         salary: 15000, quarters: [0,0,1,1,   1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'IT',          salary: 5000,  quarters: [0,0,0,0,   0,0,0,0.5, 0.5,0.5,0.5,0.5, 1,1,1,1, 1,1,1,1] }
        ]
      },
      sm: {
        label: 'Sales & Marketing',
        roles: [
          { role: 'VP Business Development',  salary: 18000, quarters: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'VP Marketing & Sales',     salary: 18000, quarters: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'Sales Manager',            salary: 12000, quarters: [1,2,3,3, 3,3,3,4, 4,4,4,4, 4,4,4,5, 5,5,5,5] },
          { role: 'Sales Coordinator',        salary: 5000,  quarters: [1,1,1,1, 1,1,1,2, 2,2,2,2, 2,2,2,3, 3,3,3,3] },
          { role: 'Customer Service Manager', salary: 6000,  quarters: [1,1,1,1, 1,1,2,2, 2,2,2,2, 2,2,2,3, 3,3,3,3] },
          { role: 'Technicians',              salary: 5000,  quarters: [0,1,1,1, 1,1,2,2, 2,2,2,2, 2,2,2,2, 2,2,2,2] },
          { role: 'Marketing Manager',        salary: 10000, quarters: [0.5,0.5,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] }
        ]
      },
      ga: {
        label: 'General & Administrative',
        roles: [
          { role: 'CEO',             salary: 10000, quarters: [0.5,0.5,1,1,   1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'CFO',             salary: 10000, quarters: [0.5,0.5,0.5,0.5, 0.5,0.5,0.5,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'COO',             salary: 10000, quarters: [0.5,0.5,0.5,0.5, 0.5,0.5,0.5,0.5, 0.5,0.5,0.5,0.5, 0.5,0.5,0.5,0.5, 1,1,1,1] },
          { role: 'Accountant',      salary: 10000, quarters: [0,0,1,1,   1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'Controller',      salary: 6000,  quarters: [1,1,1,1,   1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'Administration',  salary: 6000,  quarters: [1,1,1,1,   1,1,1,1, 1,1,1,1, 1,1,1,1, 2,2,2,2] },
          { role: 'Procurement',     salary: 6000,  quarters: [1,1,1,1,   1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
          { role: 'Human Resources', salary: 7000,  quarters: [0,0,0,0,   0,0,0,0.5, 0.5,0.5,0.5,0.5, 0.5,0.5,0.5,0.5, 1,1,1,1] }
        ]
      }
    },
    operationalCosts: {
      subcontractors:  { label: 'Subcontractors',       yearly: [5000, 8000, 12000, 15000, 18000, 18000] },
      materials:       { label: 'Materials & Supplies',  yearly: [2000, 3000, 5000, 7000, 9000, 9000] },
      rent:            { label: 'Rent & Utilities',      yearly: [8000, 10000, 15000, 20000, 25000, 25000] },
      patents:         { label: 'Patents & IP',          yearly: [3000, 4000, 5000, 5000, 5000, 5000] },
      travel:          { label: 'Travel & Conferences',  yearly: [2000, 4000, 6000, 8000, 10000, 10000] },
      marketing:       { label: 'Marketing',             yearly: [3000, 6000, 10000, 15000, 20000, 20000] },
      insurance:       { label: 'Insurance',             yearly: [2000, 3000, 4000, 5000, 6000, 6000] },
      legal:           { label: 'Legal & Accounting',    yearly: [4000, 5000, 6000, 7000, 8000, 8000] },
      misc:            { label: 'Miscellaneous',         yearly: [1000, 2000, 3000, 4000, 5000, 5000] }
    }
  };
}

// Migrate legacy 6-year defaults to 5-year (trim to first 5 elements)
function migrateLegacyTo5Year() {
  const legacy = getLegacyDefaults();
  const trim = arr => arr.slice(0, NUM_YEARS);

  const a = {
    hectaresPerYear: trim(legacy.hectaresPerYear),
    salesPct: trim(legacy.salesPct),
    leasingPct: trim(legacy.leasingPct),
    quarterlyDist: legacy.quarterlyDist.slice(0, NUM_YEARS),
    leasePrice: trim(legacy.leasePrice),
    leaseAdvanceMonths: trim(legacy.leaseAdvanceMonths),
    salesPrice: trim(legacy.salesPrice),
    salesPrepaidRatio: trim(legacy.salesPrepaidRatio),
    salesAdvanceMonths: trim(legacy.salesAdvanceMonths),
    salesShipmentRatio: trim(legacy.salesShipmentRatio),
    robotLifetime: trim(legacy.robotLifetime),
    productionCost: trim(legacy.productionCost),
    rmPrepayMonths: trim(legacy.rmPrepayMonths),
    paymentNetMonths: trim(legacy.paymentNetMonths),
    supplierPrepayRatio: trim(legacy.supplierPrepayRatio),
    capitalRaised: trim(legacy.capitalRaised),
    capitalMonth: trim(legacy.capitalMonth),
    cressonCreditFacility: trim(legacy.cressonCreditFacility),
    bankLineOfCredit: trim(legacy.bankLineOfCredit),
    creditFacilityRate: trim(legacy.creditFacilityRate),
    bankLoansPerYear: trim(legacy.bankLoansPerYear),
    bankLoanRate: trim(legacy.bankLoanRate),
    bankLoanTerm: trim(legacy.bankLoanTerm),
    collectionLoanPct: trim(legacy.collectionLoanPct),
    iiaRoyalties: trim(legacy.iiaRoyalties),
    monthsOfActivity: trim(legacy.monthsOfActivity),
    opCostRatio: trim(legacy.opCostRatio),
    overdueRatio: trim(legacy.overdueRatio),
    collectionRatio: trim(legacy.collectionRatio),
    sparePartsPerRobot: trim(legacy.sparePartsPerRobot),
    subcontractorCostPerRobot: trim(legacy.subcontractorCostPerRobot),
    headcount: {},
    operationalCosts: {},
    year0: getEmptyYear0(),
    year1Overrides: { salesHectaresAccrual: 0, salesNetPayment: 0 }
  };

  // Headcount is already per-role with exactly NUM_YEARS*4 quarters — use as-is
  a.headcount = JSON.parse(JSON.stringify(legacy.headcount));

  for (const key in legacy.operationalCosts) {
    a.operationalCosts[key] = {
      label: legacy.operationalCosts[key].label,
      yearly: trim(legacy.operationalCosts[key].yearly)
    };
  }

  return a;
}

// Keep backward compat — getDefaultAssumptions now returns migrated 5-year data
function getDefaultAssumptions() {
  return migrateLegacyTo5Year();
}
