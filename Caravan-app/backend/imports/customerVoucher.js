const db = require("./database");

/** Assign the welcome voucher to a newly created customer, if it is configured. */
async function grantWelcomeVoucher(customerId) {
  if (!Number.isSafeInteger(customerId) || customerId < 1) {
    throw new Error("A valid customer ID is required to grant the welcome voucher.");
  }

  await db.execute({
    sql: `
      INSERT INTO Customer_vouchers (Customer_id, Voucher_id, Voucher_status)
      SELECT ?, Voucher_id, 'Unused'
      FROM Vouchers
      WHERE LOWER(TRIM(Voucher_name)) = 'welcome10'
      LIMIT 1
      ON CONFLICT(Customer_id, Voucher_id) DO NOTHING
    `,
    args: [customerId],
  });
}

module.exports = { grantWelcomeVoucher };
