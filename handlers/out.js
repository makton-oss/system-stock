const { withRole } = require("../core/withRole");
const { handleStockRequest } = require("../services/stock/handleStockRequest");

module.exports = withRole(["staff"], async (ctx) => {
  return handleStockRequest("out", ctx);
});