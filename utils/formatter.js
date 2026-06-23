const helpers      = require("./helpers");
const stockFormat  = require("./formatters/stockFormat");
const reportFormat = require("./formatters/reportFormat");
const staffFormat  = require("./formatters/staffFormat");
const dbHelpers    = require("./formatters/dbHelpers");
const { ROLE_GUIDE, getRoleGuide } = require("./formatters/roleGuide");

module.exports = {
  // helpers
  toProperCase:      helpers.toProperCase,
  formatCurrency:    helpers.formatCurrency,
  formatAmount:      helpers.formatAmount,
  nowMY:             helpers.nowMY,
  formatLogDateTime: helpers.formatLogDateTime,
  parseMonthInput:   helpers.parseMonthInput,
  formatMonthLabel:  helpers.formatMonthLabel,

  // stock & item
  formatItemNameList:  stockFormat.formatItemNameList,
  formatItemList:      stockFormat.formatItemList,
  formatItemListAdmin: stockFormat.formatItemListAdmin,
  formatStock:         stockFormat.formatStock,
  formatStockAdmin:    stockFormat.formatStockAdmin,
  formatStockByCategory: stockFormat.formatStockByCategory,
  formatStockAdminByCategory: stockFormat.formatStockAdminByCategory,
  formatPending:       stockFormat.formatPending,
  formatPendingAdmin:  stockFormat.formatPendingAdmin,
  formatLowStockAlert: stockFormat.formatLowStockAlert,
  formatLowStockAlertGroup: stockFormat.formatLowStockAlertGroup,

  // reports
  formatMainReport:      reportFormat.formatMainReport,
  formatInventoryReport: reportFormat.formatInventoryReport,
  formatFlowReport:      reportFormat.formatFlowReport,
  formatDetailReport:    reportFormat.formatDetailReport,
  formatDeadReport:      reportFormat.formatDeadReport,
  formatSummaryReport:   reportFormat.formatSummaryReport,
  formatUsageReport:     reportFormat.formatUsageReport,
  formatWastageReport:   reportFormat.formatWastageReport,

  // staff
  formatStaffList:      staffFormat.formatStaffList,
  formatStaffListAdmin: staffFormat.formatStaffListAdmin,
  formatStaffOrgView:   staffFormat.formatStaffOrgView,
  formatStaffSummaryGlobal: staffFormat.formatStaffSummaryGlobal,

  // db-coupled
  formatLogs:     dbHelpers.formatLogs,
  getUserDisplay: dbHelpers.getUserDisplay,
  checkRole:      dbHelpers.checkRole,
  writeLog:       dbHelpers.writeLog,

  // role guide
  ROLE_GUIDE,
  getRoleGuide
};