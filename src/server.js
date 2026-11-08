require('dotenv').config();
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Uji koneksi ke database
    const res = await db.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log(`[Database Connected]: ${res.rows[0].db_name} at ${res.rows[0].current_time}`);

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  🔧 Serba Service Center System Running on Port ${PORT}`);
      console.log(`  📡 Web Dashboard: http://localhost:${PORT}`);
      console.log(`  🔗 REST API Base: http://localhost:${PORT}/api`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.warn(`[Warning]: Database connection check failed: ${err.message}`);
    console.log(`[Info]: Starting server anyway in offline/presentation mode...`);
    app.listen(PORT, () => {
      console.log(`  🔧 Serba Service Center Server Running on Port ${PORT}`);
      console.log(`  📡 Web Dashboard: http://localhost:${PORT}`);
    });
  }
}

startServer();
