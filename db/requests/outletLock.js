const supabase = require("../../services/db");

async function withOutletLock(outletId, fn) {

  const lockId = 900000 + Number(outletId);

  const { data: lockData, error: lockError } = await supabase
    .rpc("try_acquire_outlet_lock", { lock_id: lockId });

  if (lockError || !lockData) {
    throw new Error("OUTLET_LOCKED");
  }

  try {
    return await fn();
  } finally {
    await supabase.rpc("release_outlet_lock", { lock_id: lockId });
  }
}

module.exports = { withOutletLock };