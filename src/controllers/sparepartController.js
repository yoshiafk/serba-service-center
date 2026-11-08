const db = require('../config/db');

// Mengambil seluruh katalog suku cadang
async function getSpareparts(req, res) {
  try {
    const result = await db.query(`
      SELECT p.*, c.name as category_name
      FROM spareparts p
      LEFT JOIN device_categories c ON c.id = p.category_id
      ORDER BY p.name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Menambah suku cadang ke gudang
async function createSparepart(req, res) {
  const { part_code, name, category_id, unit_price, cost_price, stock_quantity, min_stock_alert, unit_of_measure } = req.body;
  if (!part_code || !name || unit_price === undefined || cost_price === undefined) {
    return res.status(400).json({ success: false, error: 'part_code, name, unit_price, cost_price wajib diisi' });
  }

  try {
    const result = await db.query(
      `INSERT INTO spareparts (part_code, name, category_id, unit_price, cost_price, stock_quantity, min_stock_alert, unit_of_measure)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [part_code, name, category_id || null, unit_price, cost_price, stock_quantity || 0, min_stock_alert || 2, unit_of_measure || 'pcs']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Alokasi penggunaan suku cadang pada tiket servis (UC-07)
async function allocateSparepart(req, res) {
  const { service_ticket_id, sparepart_id, quantity, notes } = req.body;
  if (!service_ticket_id || !sparepart_id || !quantity || quantity <= 0) {
    return res.status(400).json({ success: false, error: 'service_ticket_id, sparepart_id, quantity (>0) wajib diisi' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Cek stok part
    const partRes = await client.query(`SELECT * FROM spareparts WHERE id = $1 FOR UPDATE`, [sparepart_id]);
    if (partRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Suku cadang tidak ditemukan' });
    }

    const part = partRes.rows[0];
    if (part.stock_quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Stok gudang tidak mencukupi (Tersedia: ${part.stock_quantity}, Diminta: ${quantity})`,
      });
    }

    const unitPrice = parseFloat(part.unit_price);
    const subtotal = unitPrice * parseInt(quantity, 10);

    // Simpan pemakaian part
    const insertRes = await client.query(
      `INSERT INTO service_spareparts (service_ticket_id, sparepart_id, quantity, unit_price, subtotal, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [service_ticket_id, sparepart_id, quantity, unitPrice, subtotal, notes || null]
    );

    // Potong stok inventaris
    await client.query(
      `UPDATE spareparts SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2`,
      [quantity, sparepart_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  getSpareparts,
  createSparepart,
  allocateSparepart,
};
