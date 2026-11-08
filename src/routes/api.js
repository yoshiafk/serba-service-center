const express = require('express');
const router = express.Router();

const customerCtrl = require('../controllers/customerController');
const ticketCtrl = require('../controllers/ticketController');
const quotationCtrl = require('../controllers/quotationController');
const sparepartCtrl = require('../controllers/sparepartController');
const qcCtrl = require('../controllers/qcController');
const billingCtrl = require('../controllers/billingController');
const handoverCtrl = require('../controllers/handoverController');

// --- Pelanggan & Perangkat ---
router.get('/customers', customerCtrl.getCustomers);
router.post('/customers', customerCtrl.createCustomer);
router.post('/devices', customerCtrl.createCustomerDevice);
router.get('/categories', customerCtrl.getCategories);

// --- Tiket Servis ---
router.get('/tickets', ticketCtrl.getTickets);
router.get('/tickets/:id', ticketCtrl.getTicketById);
router.post('/tickets', ticketCtrl.createTicket);
router.put('/tickets/:id/diagnose', ticketCtrl.diagnoseTicket);

// --- Penawaran Estimasi (Quotation) ---
router.post('/quotations', quotationCtrl.createQuotation);
router.put('/quotations/:id/respond', quotationCtrl.respondQuotation);

// --- Suku Cadang (Spareparts) ---
router.get('/spareparts', sparepartCtrl.getSpareparts);
router.post('/spareparts', sparepartCtrl.createSparepart);
router.post('/spareparts/allocate', sparepartCtrl.allocateSparepart);

// --- Pengujian Mutu (QC) ---
router.post('/qc-tests', qcCtrl.submitQcTest);

// --- Penagihan & Kasir ---
router.post('/invoices', billingCtrl.createInvoice);
router.post('/payments', billingCtrl.recordPayment);

// --- Serah Terima (Handover) ---
router.post('/handovers', handoverCtrl.recordHandover);

module.exports = router;
