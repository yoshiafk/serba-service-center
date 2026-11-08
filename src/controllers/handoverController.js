const db = require('../config/db');

// Mencatat berita acara serah terima pengembalian perangkat (UC-13)
async function recordHandover(req, res) {
  const { service_ticket_id, handed_by_user_id, received_by_name, receiver_phone, handover_type, notes } = req.body;

  if (!service_ticket_id || !handed_by_user_id || !received_by_name || !handover_type) {
    return res.status(400).json({
      success: false,
      error: 'service_ticket_id, handed_by_user_id, received_by_name, handover_type wajib diisi',
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const handoverNumber = `HND-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const insertHandover = await client.query(
      `INSERT INTO device_handovers (handover_number, service_ticket_id, handed_by_user_id, received_by_name, receiver_phone, handover_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [handoverNumber, service_ticket_id, handed_by_user_id, received_by_name, receiver_phone || null, handover_type, notes || null]
    );

    // Update status akhir tiket servis menjadi CLOSED
    await client.query(
      `UPDATE service_tickets SET status = 'CLOSED', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [service_ticket_id]
    );

    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'READY_FOR_PICKUP', 'CLOSED', $2, $3)`,
      [service_ticket_id, handed_by_user_id, `Handover #${handoverNumber} kepada ${received_by_name} (${handover_type})`]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: insertHandover.rows[0], ticket_status: 'CLOSED' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  recordHandover,
};
