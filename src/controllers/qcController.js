const db = require('../config/db');

// Mencatat hasil pengujian kendali mutu QC (UC-09)
async function submitQcTest(req, res) {
  const { service_ticket_id, tested_by_user_id, checklist_results, is_passed, notes } = req.body;
  if (!service_ticket_id || !tested_by_user_id || is_passed === undefined) {
    return res.status(400).json({ success: false, error: 'service_ticket_id, tested_by_user_id, is_passed wajib diisi' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const insertQc = await client.query(
      `INSERT INTO service_qc_tests (service_ticket_id, tested_by_user_id, checklist_results, is_passed, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [service_ticket_id, tested_by_user_id, JSON.stringify(checklist_results || {}), is_passed, notes || null]
    );

    const newStatus = is_passed ? 'READY_FOR_PICKUP' : 'IN_PROGRESS';
    await client.query(
      `UPDATE service_tickets SET status = $1, repaired_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [newStatus, service_ticket_id]
    );

    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'TESTING_QC', $2, $3, $4)`,
      [service_ticket_id, newStatus, tested_by_user_id, `QC Test Result: ${is_passed ? 'PASSED' : 'FAILED'} - ${notes || ''}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: insertQc.rows[0], ticket_status: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  submitQcTest,
};
