// Definisi Diagram Mermaid untuk Presentasi
const ERD_MERMAID = `
erDiagram
    USERS {
        bigint id PK
        varchar username UK
        varchar full_name
        varchar role
    }
    CUSTOMERS {
        bigint id PK
        varchar customer_code UK
        varchar name
        varchar phone_number
    }
    DEVICE_CATEGORIES {
        bigint id PK
        varchar category_code UK
        varchar name
    }
    CUSTOMER_DEVICES {
        bigint id PK
        bigint customer_id FK
        bigint category_id FK
        varchar brand
        varchar model_name
        varchar serial_number
    }
    SERVICE_TICKETS {
        bigint id PK
        varchar ticket_number UK
        bigint customer_device_id FK
        bigint customer_id FK
        bigint cs_id FK
        bigint technician_id FK
        text initial_complaint
        varchar status
        numeric labor_cost
    }
    SERVICE_QUOTATIONS {
        bigint id PK
        varchar quotation_number UK
        bigint service_ticket_id FK
        numeric total_estimated_cost
        varchar approval_status
    }
    SPAREPARTS {
        bigint id PK
        varchar part_code UK
        varchar name
        numeric unit_price
        int stock_quantity
    }
    SERVICE_SPAREPARTS {
        bigint id PK
        bigint service_ticket_id FK
        bigint sparepart_id FK
        int quantity
        numeric subtotal
    }
    SERVICE_QC_TESTS {
        bigint id PK
        bigint service_ticket_id FK
        boolean is_passed
    }
    INVOICES {
        bigint id PK
        varchar invoice_number UK
        bigint service_ticket_id FK
        numeric grand_total
        varchar payment_status
    }
    PAYMENTS {
        bigint id PK
        varchar payment_number UK
        bigint invoice_id FK
        varchar payment_method
        numeric amount_paid
    }
    SERVICE_WARRANTIES {
        bigint id PK
        varchar warranty_code UK
        bigint service_ticket_id FK
        date labor_expiry_date
    }
    DEVICE_HANDOVERS {
        bigint id PK
        varchar handover_number UK
        bigint service_ticket_id FK
        varchar received_by_name
    }

    CUSTOMERS ||--o{ CUSTOMER_DEVICES : "owns"
    DEVICE_CATEGORIES ||--o{ CUSTOMER_DEVICES : "categorizes"
    DEVICE_CATEGORIES ||--o{ SPAREPARTS : "filters"
    CUSTOMER_DEVICES ||--o{ SERVICE_TICKETS : "serviced_in"
    CUSTOMERS ||--o{ SERVICE_TICKETS : "requests"
    USERS ||--o{ SERVICE_TICKETS : "created_by"
    USERS ||--o{ SERVICE_TICKETS : "assigned_to"
    SERVICE_TICKETS ||--o{ SERVICE_QUOTATIONS : "estimates"
    SERVICE_TICKETS ||--o{ SERVICE_SPAREPARTS : "consumes"
    SPAREPARTS ||--o{ SERVICE_SPAREPARTS : "used_in"
    SERVICE_TICKETS ||--o{ SERVICE_QC_TESTS : "verified_in"
    SERVICE_TICKETS ||--|| INVOICES : "billed_as"
    INVOICES ||--o{ PAYMENTS : "paid_by"
    SERVICE_TICKETS ||--o| SERVICE_WARRANTIES : "guaranteed"
    SERVICE_TICKETS ||--|| DEVICE_HANDOVERS : "released_via"
`;

const USECASE_MERMAID = `
flowchart LR
    ActCust["👤 Pelanggan"]
    ActCS["🧑‍💼 CS Loket"]
    ActTech["🧑‍🔧 Teknisi"]
    ActCash["🧑‍💻 Kasir"]
    ActAdmin["👑 Administrator"]

    subgraph System["Sistem Serba Service Center"]
        UC01(["UC-01: Registrasi Pelanggan & Unit"])
        UC02(["UC-02: Penerbitan Tiket Servis"])
        UC03(["UC-03: Diagnosis Kerusakan"])
        UC04(["UC-04: Penyusunan Estimasi Biaya"])
        UC05(["UC-05: Konfirmasi Persetujuan Estimasi"])
        UC06(["UC-06: Pelaksanaan Reparasi Fisik"])
        UC07(["UC-07: Alokasi Suku Cadang"])
        UC08(["UC-08: Pemesanan Part Indent"])
        UC09(["UC-09: Pengujian Mutu (QC)"])
        UC10(["UC-10: Penerbitan Faktur (Invoice)"])
        UC11(["UC-11: Pembayaran (DP / Lunas)"])
        UC12(["UC-12: Aktivasi Garansi Purna Jual"])
        UC13(["UC-13: Serah Terima Perangkat"])
        UC14(["UC-14: Audit Log Histori Status"])
    end

    ActCust --- UC01
    ActCust --- UC05
    ActCust --- UC11
    ActCust --- UC13

    ActCS --- UC01
    ActCS --- UC02
    ActCS --- UC05
    ActCS --- UC13

    ActTech --- UC03
    ActTech --- UC04
    ActTech --- UC06
    ActTech --- UC07
    ActTech --- UC09

    ActCash --- UC10
    ActCash --- UC11

    ActAdmin --- UC14

    UC01 -.->|"<<include>>"| UC02
    UC03 -.->|"<<include>>"| UC04
    UC07 -.->|"<<extend>>"| UC08
    UC06 -.->|"<<include>>"| UC09
    UC09 -.->|"<<include>>"| UC10
    UC11 -.->|"<<include>>"| UC12
    UC12 -.->|"<<include>>"| UC13
`;

const FLOW_MERMAID = `
flowchart TD
    Start(["Mulai: Pelanggan Datang"]) --> Intake["Penerimaan & Registrasi: Data Pelanggan & Perangkat"]
    Intake --> Ticket["Terbitkan Tiket Servis Masuk"]
    Ticket --> Inspect["Teknisi Lakukan Diagnosis Kerusakan"]
    
    Inspect --> DecisionRepair{"Dapat Diservis?"}
    
    DecisionRepair -->|Tidak| Unrepairable["Catat Alasan Teknis Tidak Dapat Diservis"]
    Unrepairable --> HandoverUnrepairable["Barang Diserahkan Kembali ke Pelanggan"]
    HandoverUnrepairable --> CloseUnrepairable(["Selesai: Ditutup - Unrepairable"])
    
    DecisionRepair -->|Ya| Estimate["Teknisi Susun Estimasi Biaya (Quotation)"]
    Estimate --> QuotationGate{"Persetujuan Pelanggan?"}
    
    QuotationGate -->|Ditolak| QuoteReject["Penawaran Ditolak: Batal Servis"]
    QuoteReject --> HandoverCancel["Barang Diserahkan Kembali"]
    HandoverCancel --> CloseCancel(["Selesai: Ditutup - Dibatalkan"])
    
    QuotationGate -->|Disetujui| PartCheck{"Butuh Sparepart?"}
    
    PartCheck -->|Tidak| RepairDirect["Proses Reparasi Teknis (Soldering / PCB)"]
    
    PartCheck -->|Ya| StockCheck{"Stok Ready di Gudang?"}
    StockCheck -->|Ya| ReservePart["Alokasikan Sparepart & Potong Stok"]
    StockCheck -->|Tidak| IndentOrder["Pemesanan Indent Sparepart"]
    IndentOrder --> ReservePart
    ReservePart --> RepairPart["Proses Pemasangan Suku Cadang"]
    
    RepairDirect --> QC["Pengujian Mutu (QC Testing)"]
    RepairPart --> QC
    
    QC --> QCTest{"Lulus Uji QC?"}
    QCTest -->|Gagal| ReRepair["Perbaikan Ulang oleh Teknisi"]
    ReRepair --> QC
    
    QCTest -->|Lulus| Ready["Status: Siap Diambil (Ready for Pickup)"]
    Ready --> Billing["Sistem Terbitkan Invoice Final"]
    
    Billing --> Payment["Pelanggan Membayar (Tunai / Transfer / QRIS)"]
    Payment --> Warranty["Aktivasi Garansi Purna Jual"]
    Warranty --> HandoverSuccess["Serah Terima Barang & Cetak Berita Acara"]
    HandoverSuccess --> CloseSuccess(["Selesai: Ditutup - Sukses"])
`;

// Helper untuk render diagram Mermaid ke elemen target
async function renderMermaid(elementId, syntax) {
  const target = document.getElementById(elementId);
  if (!target) return;
  target.innerHTML = `<div class="loading">Memproses diagram...</div>`;

  try {
    const code = syntax || (elementId === 'erd-view' ? ERD_MERMAID : elementId === 'usecase-view' ? USECASE_MERMAID : FLOW_MERMAID);
    const id = `svg-${elementId}-${Date.now()}`;
    const { svg } = await mermaid.render(id, code.trim());
    target.innerHTML = svg;
  } catch (err) {
    console.error(`Gagal render diagram ${elementId}:`, err);
    target.innerHTML = `<div class="text-danger">Gagal merender diagram: ${err.message}</div>`;
  }
}

// Inisialisasi Tab Navigasi
function initTabs() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) {
        targetTab.classList.add('active');
        if (btn.dataset.tab === 'tab-erd') renderMermaid('erd-view');
        if (btn.dataset.tab === 'tab-usecase') renderMermaid('usecase-view');
        if (btn.dataset.tab === 'tab-flow') renderMermaid('flow-view');
        if (btn.dataset.tab === 'tab-live') {
          loadLiveTickets();
          loadLiveSpareparts();
        }
      }
    });
  });
}

// Memuat data tiket servis live dari backend Express
async function loadLiveTickets() {
  const listEl = document.getElementById('ticket-list');
  listEl.innerHTML = '<p class="text-muted">Mengambil data dari API /api/tickets...</p>';
  try {
    const res = await fetch('/api/tickets');
    const json = await res.json();
    if (!json.success || !json.data || json.data.length === 0) {
      listEl.innerHTML = '<p class="text-muted">Belum ada tiket servis terdaftar.</p>';
      return;
    }

    listEl.innerHTML = json.data
      .map(
        (t) => `
      <div class="ticket-item">
        <div class="ticket-header">
          <span>${t.ticket_number}</span>
          <span class="ticket-status status-${t.status}">${t.status}</span>
        </div>
        <div style="font-size: 0.85rem; color: #475569;">
          <strong>Pelanggan:</strong> ${t.customer_name} (${t.customer_phone})<br/>
          <strong>Perangkat:</strong> ${t.device_brand} ${t.device_model}<br/>
          <strong>Keluhan:</strong> ${t.initial_complaint}<br/>
          ${t.grand_total ? `<strong>Tagihan:</strong> Rp ${parseFloat(t.grand_total).toLocaleString()} (${t.payment_status})` : ''}
        </div>
      </div>
    `
      )
      .join('');
  } catch (err) {
    listEl.innerHTML = `<p class="text-danger">Koneksi API gagal: ${err.message}. Pastikan server aktif.</p>`;
  }
}

// Memuat data spareparts live dari backend Express
async function loadLiveSpareparts() {
  const listEl = document.getElementById('sparepart-list');
  listEl.innerHTML = '<p class="text-muted">Mengambil data dari API /api/spareparts...</p>';
  try {
    const res = await fetch('/api/spareparts');
    const json = await res.json();
    if (!json.success || !json.data || json.data.length === 0) {
      listEl.innerHTML = '<p class="text-muted">Katalog suku cadang kosong.</p>';
      return;
    }

    listEl.innerHTML = json.data
      .map(
        (p) => `
      <div class="ticket-item">
        <div class="ticket-header">
          <span>${p.part_code} - ${p.name}</span>
          <span class="ticket-status" style="background:#e0f2fe; color:#0369a1;">Stok: ${p.stock_quantity} ${p.unit_of_measure}</span>
        </div>
        <div style="font-size: 0.85rem; color: #475569;">
          <strong>Harga Jual:</strong> Rp ${parseFloat(p.unit_price).toLocaleString()} | 
          <strong>Kategori:</strong> ${p.category_name || '-'}
        </div>
      </div>
    `
      )
      .join('');
  } catch (err) {
    listEl.innerHTML = `<p class="text-danger">Koneksi API gagal: ${err.message}.</p>`;
  }
}

// Start saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderMermaid('erd-view');
});
