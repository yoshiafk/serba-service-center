const db = require('../config/db');

// Mengambil daftar seluruh pelanggan beserta perangkatnya
async function getCustomers(req, res) {
  try {
    const result = await db.query(`
      SELECT c.*, 
             COALESCE(json_agg(d.*) FILTER (WHERE d.id IS NOT NULL), '[]') as devices
      FROM customers c
      LEFT JOIN customer_devices d ON d.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Mendaftarkan pelanggan baru
async function createCustomer(req, res) {
  const { name, phone_number, email, address } = req.body;
  if (!name || !phone_number) {
    return res.status(400).json({ success: false, error: 'Nama dan nomor telepon wajib diisi' });
  }

  try {
    const customerCode = `CST-${Date.now().toString().slice(-6)}`;
    const result = await db.query(
      `INSERT INTO customers (customer_code, name, phone_number, email, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [customerCode, name, phone_number, email || null, address || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Mendaftarkan perangkat milik pelanggan
async function createCustomerDevice(req, res) {
  const { customer_id, category_id, brand, model_name, serial_number, color, physical_condition, accessories } = req.body;
  if (!customer_id || !category_id || !brand || !model_name) {
    return res.status(400).json({ success: false, error: 'customer_id, category_id, brand, dan model_name wajib diisi' });
  }

  try {
    const result = await db.query(
      `INSERT INTO customer_devices (customer_id, category_id, brand, model_name, serial_number, color, physical_condition, accessories)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [customer_id, category_id, brand, model_name, serial_number || null, color || null, physical_condition || null, accessories || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Mengambil seluruh kategori perangkat
async function getCategories(req, res) {
  try {
    const result = await db.query(`SELECT * FROM device_categories ORDER BY id ASC`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getCustomers,
  createCustomer,
  createCustomerDevice,
  getCategories,
};
