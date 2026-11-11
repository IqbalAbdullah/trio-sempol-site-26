(function () {
  'use strict';

  var PRODUCTS = [
    { id: 'kacang', name: 'Saus Kacang', taste: 'Perpaduan kacang pilihan dengan rasa gurih khas yang bikin nagih.', image: 'assets/sauce-kacang.jpg', photoKey: 'sauce-kacang', mark: '◉', tint: '#eee1c9', color: '#83603c' },
    { id: 'bangkok', name: 'Saus Bangkok Gacaoan', taste: 'Rasa manis pedas dengan aroma rempah yang menggugah selera.', image: 'assets/sauce-bangkok.jpg', photoKey: 'sauce-bangkok', mark: '✳', tint: '#f4e6c7', color: '#a67531' },
    { id: 'lava', name: 'Saus Lava', taste: 'Pedas nendang untuk kamu yang suka tantangan.', image: 'assets/sauce-lava.jpg', photoKey: 'sauce-lava', mark: '♨', tint: '#f4d8d1', color: '#be4233' },
    { id: 'bbq', name: 'Saus BBQ', taste: 'Manis gurih dengan aroma smoky yang bikin ketagihan.', image: 'assets/sauce-bbq.jpg', photoKey: 'sauce-bbq', mark: '✷', tint: '#f5e1d3', color: '#a3472c' },
    { id: 'chilioil', name: 'Chili Oil', taste: 'Pedas gurih dengan sensasi minyak cabai pilihan.', image: 'assets/sauce-chili-oil.jpg', photoKey: 'sauce-chili-oil', mark: '◒', tint: '#e9dfd2', color: '#8a3f35' }
  ];
  var WEEKLY_SCHEDULE = {
    1: { name: 'Senin', slots: [['07:00', '10:00'], ['12:00', '13:00'], ['15:30', '19:00']] },
    2: { name: 'Selasa', slots: [['09:10', '11:00'], ['13:40', '19:00']] },
    3: { name: 'Rabu', slots: [['08:20', '09:20'], ['11:00', '13:00'], ['13:00', '14:50'], ['16:35', '19:00']] },
    4: { name: 'Kamis', slots: [['07:00', '10:15'], ['10:15', '11:10'], ['12:50', '19:00']] },
    5: { name: 'Jumat', slots: [['10:00', '13:00'], ['13:00', '14:40'], ['14:50', '17:40'], ['17:40', '19:00']] }
  };
  var STORAGE_KEY = 'trio-sempol-prototype-v1';
  var OWNER_KEY = 'trio-sempol-owner-account-v1';
  var OWNER_SESSION_KEY = 'trio-sempol-owner-session-v1';
  var defaultState = {
    inventory: { kacang: 18, bangkok: 20, lava: 18, bbq: 24, chilioil: 24 },
    orders: [], customers: [], financeEntries: [],
    settings: {
      price: 10000, deliveryFee: 10000, freeFrom: 8, payee: 'Trio Sempol', whatsapp: '', qrisImage: '',
      photos: { hero: '', menu: '', story: '' }, initialCash: 600000, domainMonthlyCost: 12500,
      poCapacity: 50, closedWeekdays: [], closedDates: [],
      costs: { sempolPackPrice: 10500, sticksPerPack: 22, sticksPerCup: 5, targetBatch: 50, otherPerCup: 3008,
        sauceBatch: { kacang: 15000, bangkok: 12000, lava: 12000, bbq: 13000, chilioil: 8000 } }
    }
  };
  var state = readState(), cart = {}, currentMember = null, currentOrderId = null;
  var activeAccountTab = 'login', activeAdminTab = 'orders', toastTimer = null;
  var reportStart = monthStart(), reportEnd = todayISO();

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function readState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return copy(defaultState);
      var result = copy(defaultState);
      result.inventory = Object.assign({}, result.inventory, saved.inventory || {});
      result.orders = Array.isArray(saved.orders) ? saved.orders : [];
      result.customers = Array.isArray(saved.customers) ? saved.customers : [];
      result.financeEntries = Array.isArray(saved.financeEntries) ? saved.financeEntries : [];
      result.settings = Object.assign({}, result.settings, saved.settings || {});
      result.settings.photos = Object.assign({}, defaultState.settings.photos, (saved.settings || {}).photos || {});
      result.settings.costs = Object.assign({}, defaultState.settings.costs, (saved.settings || {}).costs || {});
      result.settings.costs.sauceBatch = Object.assign({}, defaultState.settings.costs.sauceBatch, ((saved.settings || {}).costs || {}).sauceBatch || {});
      result.settings.closedDates = Array.isArray(result.settings.closedDates) ? result.settings.closedDates : [];
      result.settings.closedWeekdays = Array.isArray(result.settings.closedWeekdays) ? result.settings.closedWeekdays : [];
      if (result.settings.price === 7000) result.settings.price = 10000;
      result.orders.forEach(function (order) {
        if (!order.deliveryDate) order.deliveryDate = localDateKey(order.createdAt || new Date());
        if (!order.deliverySlot) order.deliverySlot = '';
        if (!order.channel) order.channel = 'Delivery';
        if (order.paidAt === undefined) order.paidAt = order.paymentStatus === 'Lunas terkonfirmasi' ? order.createdAt : null;
        if (order.courierActualCost === undefined) order.courierActualCost = null;
      });
      return result;
    } catch (error) { return copy(defaultState); }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch (error) { showToast('Penyimpanan browser penuh. Kecilkan atau hapus berkas lama.'); return false; }
  }
  function byId(id) { return document.getElementById(id); }
  function money(value) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function number(value) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function localDateKey(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return todayISO();
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function todayISO() { return localDateKey(new Date()); }
  function monthStart() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function dateLabel(value, options) {
    var date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    return date.toLocaleDateString('id-ID', options || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function product(id) { return PRODUCTS.find(function (item) { return item.id === id; }) || PRODUCTS[0]; }
  function totalCups(items) { return (items || []).reduce(function (sum, item) { return sum + Number(item.qty || 0); }, 0); }
  function costPerCup(id) {
    var c = state.settings.costs;
    var sempol = Number(c.sempolPackPrice || 0) / Math.max(1, Number(c.sticksPerPack || 1)) * Number(c.sticksPerCup || 0);
    var sauce = Number(c.sauceBatch[id] || 0) / Math.max(1, Number(c.targetBatch || 1));
    return Math.round(sempol + sauce + Number(c.otherPerCup || 0));
  }
  function selectedItems() {
    return PRODUCTS.filter(function (item) { return Number(cart[item.id]) > 0; }).map(function (item) {
      return { id: item.id, name: item.name, qty: Number(cart[item.id]), price: Number(state.settings.price), unitCost: costPerCup(item.id) };
    });
  }
  function subtotal(items) { return (items || []).reduce(function (sum, item) { return sum + Number(item.qty) * Number(item.price); }, 0); }
  function shipping(items) { return totalCups(items) >= Number(state.settings.freeFrom) ? 0 : Number(state.settings.deliveryFee); }
  function itemUnitCost(item) { return item.unitCost == null ? costPerCup(item.id) : Number(item.unitCost); }
  function isAdminAuthorized() {
    try { var account = JSON.parse(localStorage.getItem(OWNER_KEY)); return Boolean(account && sessionStorage.getItem(OWNER_SESSION_KEY) === account.sessionToken); }
    catch (error) { return false; }
  }
  function showToast(message) {
    var toast = byId('toast'); if (!toast) return;
    toast.textContent = message; toast.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('visible'); }, 3200);
  }
  function showModal(html, wide) {
    var panel = document.querySelector('.modal-panel');
    panel.classList.toggle('admin-wide', Boolean(wide));
    byId('modalBody').innerHTML = html; byId('modalBackdrop').hidden = false; document.body.style.overflow = 'hidden';
    var first = byId('modalBody').querySelector('input:not([type=file]), button, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function closeModal() {
    byId('modalBackdrop').hidden = true; document.body.style.overflow = ''; byId('modalBody').innerHTML = '';
  }
  function applyPhotos() {
    var photos = state.settings.photos || {};
    [['heroPhoto', 'hero'], ['menuPhoto', 'menu'], ['storyPhoto', 'story']].forEach(function (entry) {
      var image = byId(entry[0]); if (image && photos[entry[1]]) image.src = photos[entry[1]];
    });
  }
  function renderProducts() {
    byId('productGrid').innerHTML = PRODUCTS.map(function (item, index) {
      var quantity = Number(cart[item.id] || 0), stock = Math.max(0, Number(state.inventory[item.id] || 0));
      var image = (state.settings.photos || {})[item.photoKey] || item.image;
      return '<article class="flavor-card"><div class="flavor-photo-wrap"><img class="flavor-photo" src="' + escapeHTML(image) + '" alt="Sempol cup dengan ' + escapeHTML(item.name) + ' Trio Sempol" loading="lazy"><span class="flavor-index">0' + (index + 1) + '</span></div><div class="flavor-card-content"><div class="flavor-card-top"><span class="flavor-symbol" style="background:' + item.tint + ';color:' + item.color + '">' + item.mark + '</span><span class="flavor-kicker">SAUS PILIHAN</span></div>' +
        '<h3>' + escapeHTML(item.name) + '</h3><p>' + escapeHTML(item.taste) + '</p><div class="flavor-card-bottom"><span class="stock-label">Sisa <b>' + stock + '</b> cup</span><div class="qty-control">' +
        '<button class="qty-button" data-action="qty" data-id="' + item.id + '" data-step="-1" aria-label="Kurangi ' + escapeHTML(item.name) + '"' + (quantity < 1 ? ' disabled' : '') + '>−</button><span class="qty-value">' + quantity + '</span>' +
        '<button class="qty-button" data-action="qty" data-id="' + item.id + '" data-step="1" aria-label="Tambah ' + escapeHTML(item.name) + '"' + (stock < 1 || quantity >= stock ? ' disabled' : '') + '>+</button></div></div></div></article>';
    }).join('');
    byId('featuredPrice').textContent = money(state.settings.price);
    byId('deliveryFeeLabel').textContent = money(state.settings.deliveryFee);
    byId('freeFromLabel').textContent = String(state.settings.freeFrom);
    applyPhotos(); updateDock();
  }
  function renderPublicSchedule() {
    var days = Object.keys(WEEKLY_SCHEDULE).map(Number);
    byId('publicSchedule').innerHTML = days.map(function (day) {
      var item = WEEKLY_SCHEDULE[day], closed = state.settings.closedWeekdays.indexOf(day) !== -1;
      var slots = item.slots.map(function (slot) { return '<span class="po-slot">' + slot[0] + '–' + slot[1] + '</span>'; }).join('');
      var fridayPause = day === 5 ? '<span class="po-slot po-slot-closed">07:30–10:00 · Tutup sementara</span>' : '';
      return '<article class="po-day' + (closed ? ' po-day-closed' : '') + '"><h3>' + item.name + '</h3><div class="po-slots">' + (closed ? '<span class="po-slot po-slot-closed">PO mingguan ditutup</span>' : fridayPause + slots) + '</div><span class="po-day-capacity">' + (closed ? 'Tidak menerima pesanan' : 'Slot mengikuti kuota Open PO') + '</span></article>';
    }).join('');
  }
  function updateDock() {
    var items = selectedItems(), count = totalCups(items);
    byId('cartDock').hidden = count < 1;
    byId('cartCount').textContent = String(count);
    byId('cartSubtotal').textContent = money(subtotal(items));
  }
  function usedCapacity(date) {
    return state.orders.filter(function (order) { return order.deliveryDate === date && order.status !== 'Dibatalkan'; }).reduce(function (sum, order) { return sum + totalCups(order.items); }, 0);
  }
  function slotsForDate(date) {
    if (!date || state.settings.closedDates.indexOf(date) !== -1) return [];
    var weekday = new Date(date + 'T12:00:00').getDay();
    if (state.settings.closedWeekdays.indexOf(weekday) !== -1 || !WEEKLY_SCHEDULE[weekday]) return [];
    if (usedCapacity(date) >= Number(state.settings.poCapacity)) return [];
    return WEEKLY_SCHEDULE[weekday].slots;
  }
  function availableDates() {
    var list = [], base = new Date(); base.setHours(12, 0, 0, 0);
    for (var i = 1; i <= 21 && list.length < 12; i++) {
      var day = new Date(base); day.setDate(day.getDate() + i); var key = localDateKey(day);
      if (slotsForDate(key).length) list.push(key);
    }
    return list;
  }
  function openCheckout() {
    var items = selectedItems();
    if (!items.length) { showToast('Pilih minimal satu cup dulu.'); return; }
    var dates = availableDates();
    if (!dates.length) { showToast('Belum ada slot Open PO yang tersedia.'); return; }
    var initialDate = dates[0], slots = slotsForDate(initialDate);
    var rows = items.map(function (item) { return '<div class="checkout-item"><span>' + escapeHTML(item.name) + ' <b>× ' + item.qty + '</b></span><span>' + money(item.qty * item.price) + '</span></div>'; }).join('');
    var ship = shipping(items), count = totalCups(items);
    var dateOptions = dates.map(function (date) { return '<option value="' + date + '">' + escapeHTML(dateLabel(date)) + ' · sisa ' + Math.max(0, Number(state.settings.poCapacity) - usedCapacity(date)) + ' cup</option>'; }).join('');
    var slotOptions = slots.map(function (slot) { return '<option value="' + slot[0] + '–' + slot[1] + '">' + slot[0] + '–' + slot[1] + '</option>'; }).join('');
    var note = ship === 0 ? '<div class="free-shipping-note">Yeay! ' + count + ' cup memenuhi syarat gratis ongkir untuk satu alamat.</div>' : '';
    showModal('<div class="modal-eyebrow">PRE-ORDER TRIO SEMPOL</div><h2 class="modal-title" id="modalTitle">Lengkapi pesananmu.</h2><p class="modal-lead">Pesan tanpa akun. Pilih tanggal dan slot antar Open PO, lalu isi kontak serta alamatmu.</p>' +
      '<div class="checkout-items">' + rows + '</div><div class="checkout-total"><div class="total-line"><span>Subtotal · ' + count + ' cup</span><strong>' + money(subtotal(items)) + '</strong></div><div class="total-line"><span>Ongkir delivery</span><strong>' + (ship === 0 ? 'Gratis' : money(ship)) + '</strong></div><div class="total-line grand"><span>Total pembayaran</span><strong>' + money(subtotal(items) + ship) + '</strong></div></div>' + note +
      '<form id="checkoutForm"><div class="form-grid"><div class="field"><label for="deliveryDate">Tanggal Open PO / antar</label><select id="deliveryDate" name="deliveryDate" required>' + dateOptions + '</select></div><div class="field"><label for="deliverySlot">Slot waktu</label><select id="deliverySlot" name="deliverySlot" required>' + slotOptions + '</select></div>' +
      '<div class="field"><label for="customerName">Nama pemesan</label><input id="customerName" name="customerName" required maxlength="70" autocomplete="name" value="' + escapeHTML(currentMember ? currentMember.name : '') + '" placeholder="Nama lengkap"></div>' +
      '<div class="field"><label for="customerWa">Nomor WhatsApp</label><input id="customerWa" name="customerWa" required maxlength="20" inputmode="tel" autocomplete="tel" value="' + escapeHTML(currentMember ? currentMember.phone : '') + '" placeholder="08xxxxxxxxxx"></div>' +
      '<div class="field full"><label for="customerAddress">Alamat pengantaran</label><textarea id="customerAddress" name="customerAddress" required maxlength="260" autocomplete="street-address" placeholder="Nama jalan, nomor rumah/kos, patokan, dan area"></textarea><span class="field-hint">Gratis ongkir mulai ' + state.settings.freeFrom + ' cup untuk satu alamat; zona layanan tetap dikonfirmasi pemilik.</span></div></div>' +
      '<label class="check-row"><input type="checkbox" name="remember" ' + (currentMember ? 'checked' : '') + '><span>Simpan profil ini di browser agar checkout berikutnya lebih cepat.</span></label><button class="button button-primary" type="submit">Buat pesanan <span>↗</span></button></form>', false);
  }
  function createOrder(form) {
    var items = selectedItems(); if (!items.length) return;
    for (var i = 0; i < items.length; i++) {
      if (Number(state.inventory[items[i].id] || 0) < items[i].qty) { closeModal(); showToast('Stok ' + items[i].name + ' berubah. Periksa jumlah di menu.'); renderProducts(); return; }
    }
    var data = new FormData(form), date = String(data.get('deliveryDate') || ''), slot = String(data.get('deliverySlot') || '');
    if (slotsForDate(date).map(function (s) { return s[0] + '–' + s[1]; }).indexOf(slot) < 0) { showToast('Slot Open PO itu sudah tutup atau kuotanya habis.'); openCheckout(); return; }
    if (usedCapacity(date) + totalCups(items) > Number(state.settings.poCapacity)) { showToast('Kuota harian tidak cukup untuk jumlah cup ini.'); return; }
    var name = String(data.get('customerName') || '').trim(), phone = String(data.get('customerWa') || '').trim(), address = String(data.get('customerAddress') || '').trim();
    if (!/^[+0-9()\s.-]{8,20}$/.test(phone)) { showToast('Periksa format nomor WhatsApp.'); byId('customerWa').focus(); return; }
    var now = new Date(), orderId = 'TS' + localDateKey(now).replace(/-/g, '').slice(2) + Math.random().toString(36).slice(2, 6).toUpperCase();
    var ship = shipping(items), order = {
      id: orderId, createdAt: now.toISOString(), paidAt: null, customerName: name, phone: phone, address: address,
      channel: 'Delivery', deliveryDate: date, deliverySlot: slot, items: items, subtotal: subtotal(items), shipping: ship, total: subtotal(items) + ship,
      status: 'Menunggu pembayaran', paymentStatus: 'Belum dibayar', payerName: '', proof: '', courierActualCost: null, stockReleased: false,
      statusMessage: 'Pesanan dibuat. Silakan selesaikan pembayaran.'
    };
    items.forEach(function (item) { state.inventory[item.id] = Math.max(0, Number(state.inventory[item.id]) - item.qty); });
    state.orders.unshift(order);
    if (data.get('remember')) saveMember(name, phone);
    persist(); cart = {}; currentOrderId = orderId; closeModal(); renderProducts(); openPayment(orderId);
  }
  function openPayment(orderId) {
    var order = state.orders.find(function (item) { return item.id === orderId; });
    if (!order) { showToast('Pesanan tidak ditemukan.'); return; }
    currentOrderId = orderId;
    var qris = state.settings.qrisImage ? '<img src="' + state.settings.qrisImage + '" alt="QRIS pembayaran Trio Sempol">' : '<div class="qr-placeholder"><div class="qr-placeholder-mark">QRIS</div><strong>QRIS belum diatur</strong><span>Pemilik perlu menambahkan QRIS merchant.</span></div>';
    showModal('<div class="modal-eyebrow">PESANAN ' + escapeHTML(order.id) + '</div><h2 class="modal-title" id="modalTitle">Satu langkah lagi.</h2><p class="modal-lead">Bayar sesuai nominal berikut, lalu unggah bukti. Slot antar: ' + escapeHTML(dateLabel(order.deliveryDate)) + ', ' + escapeHTML(order.deliverySlot) + '.</p>' +
      '<div class="payment-layout"><div><div class="qr-box">' + qris + '</div><div class="payee-card"><span>Penerima pembayaran</span><strong>' + escapeHTML(state.settings.payee || 'Trio Sempol') + '</strong></div></div>' +
      '<div><div class="payment-total">' + money(order.total) + '</div><div class="field"><label for="payerName">Nama pada rekening / e-wallet</label><input id="payerName" maxlength="70" value="' + escapeHTML(order.payerName || '') + '" placeholder="Nama pengirim"></div>' +
      '<div class="field"><label for="proofFile">Foto bukti pembayaran</label><input id="proofFile" type="file" accept="image/*"><span class="field-hint">Gambar bukti akan diperkecil otomatis untuk penyimpanan prototipe.</span></div>' +
      (order.proof ? '<img class="proof-preview" src="' + order.proof + '" alt="Bukti pembayaran yang diunggah">' : '') +
      '<button class="button button-primary" data-action="upload-proof" type="button">Kirim bukti pembayaran <span>↗</span></button><div class="payment-receipt-link"><button class="small-action" data-action="receipt" data-id="' + escapeHTML(order.id) + '">Lihat / cetak struk</button></div></div></div>' +
      '<p class="field-hint" style="margin-top:18px">Simpan kode pesanan ini untuk mengecek status tanpa akun.</p><div class="order-code">' + escapeHTML(order.id) + '</div>', false);
  }
  function uploadProof() {
    var order = state.orders.find(function (item) { return item.id === currentOrderId; }), input = byId('proofFile'), payer = byId('payerName');
    if (!order || !payer) return;
    var file = input.files && input.files[0];
    if (!file && !order.proof) { showToast('Pilih foto bukti pembayaran terlebih dahulu.'); input.focus(); return; }
    order.payerName = payer.value.trim();
    if (!order.payerName) { showToast('Isi nama pemilik rekening atau e-wallet.'); payer.focus(); return; }
    if (file) {
      if (!file.type.startsWith('image/')) { showToast('Bukti pembayaran perlu berupa gambar.'); return; }
      compressImage(file, 1100, 0.76).then(function (dataUrl) {
        order.proof = dataUrl; order.paymentStatus = 'Menunggu konfirmasi'; order.statusMessage = 'Bukti pembayaran diterima. Menunggu konfirmasi pemilik.';
        persist(); openPayment(order.id); showToast('Bukti pembayaran tersimpan pada browser ini.');
      }).catch(function () { showToast('Gambar bukti tidak dapat dibaca.'); });
    } else { order.paymentStatus = 'Menunggu konfirmasi'; order.statusMessage = 'Bukti pembayaran diterima. Menunggu konfirmasi pemilik.'; persist(); openPayment(order.id); showToast('Bukti pembayaran tercatat.'); }
  }
  function openReceipt(orderId) {
    var order = state.orders.find(function (item) { return item.id === orderId; });
    if (!order) { showToast('Kode pesanan tidak ditemukan di browser ini.'); return; }
    currentOrderId = orderId;
    var date = new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    var lines = order.items.map(function (item) { return '<div class="checkout-item"><span>' + escapeHTML(item.name) + ' × ' + item.qty + ' cup</span><span>' + money(item.qty * item.price) + '</span></div>'; }).join('');
    showModal('<div class="receipt-head"><img src="assets/logo-trio-sempol.png" alt=""><div class="receipt-brand">TRIO SEMPOL<small>Sempol celup, saus pilihanmu.</small></div></div>' +
      '<h2 class="modal-title" id="modalTitle" style="margin-top:18px">Struk pesanan.</h2><div class="receipt-meta"><span>' + escapeHTML(date) + '</span><span class="order-code">' + escapeHTML(order.id) + '</span></div>' +
      '<div class="receipt-delivery"><strong>Slot antar</strong><br>' + escapeHTML(dateLabel(order.deliveryDate)) + ' · ' + escapeHTML(order.deliverySlot) + '</div>' +
      '<div><strong>' + escapeHTML(order.customerName) + '</strong><div class="field-hint" style="margin-top:3px">' + escapeHTML(order.phone) + '<br>' + escapeHTML(order.address) + '</div></div>' +
      '<div class="receipt-lines">' + lines + '<div class="checkout-item"><span>Subtotal</span><span>' + money(order.subtotal) + '</span></div><div class="checkout-item"><span>Ongkir</span><span>' + (order.shipping ? money(order.shipping) : 'Gratis') + '</span></div><div class="checkout-item receipt-grand"><span>Total</span><span>' + money(order.total) + '</span></div></div>' +
      '<div class="receipt-status">Pembayaran: ' + escapeHTML(order.paymentStatus) + '<br>Status pesanan: ' + escapeHTML(order.status) + '</div><div class="receipt-actions"><button class="button button-primary" data-action="print-receipt">Cetak / simpan PDF</button><button class="button button-quiet" data-action="payment" data-id="' + escapeHTML(order.id) + '">Pembayaran</button></div>' +
      '<p class="field-hint" style="margin-top:13px">Struk dan kode pesanan ini tersimpan pada browser yang digunakan.</p>', false);
  }
  function openTrack() {
    showModal('<div class="modal-eyebrow">CEK PESANAN</div><h2 class="modal-title" id="modalTitle">Pesananmu sampai mana?</h2><p class="modal-lead">Masukkan kode yang tampil setelah membuat pesanan. Tanpa akun pun bisa.</p>' +
      '<form id="trackForm"><div class="field"><label for="trackCode">Kode pesanan</label><input id="trackCode" name="trackCode" placeholder="Contoh: TS261111ABCD" required></div><button class="button button-primary" type="submit">Lihat status <span>↗</span></button></form>', false);
  }
  function openAccount(tab) { activeAccountTab = tab || 'login'; renderAccount(); }
  function renderAccount(message) {
    var isRegister = activeAccountTab === 'register';
    showModal('<div class="modal-eyebrow">AKUN PELANGGAN</div><h2 class="modal-title" id="modalTitle">' + (isRegister ? 'Buat profil pelanggan.' : 'Selamat datang kembali.') + '</h2><p class="modal-lead">Profil membantu mengisi nama dan WhatsApp. Pesan tetap bisa dibuat tanpa akun.</p>' +
      '<div class="account-tabs"><button class="account-tab ' + (!isRegister ? 'active' : '') + '" data-action="account-tab" data-tab="login">Masuk</button><button class="account-tab ' + (isRegister ? 'active' : '') + '" data-action="account-tab" data-tab="register">Daftar</button></div>' +
      (message ? '<p class="field-hint message-box">' + escapeHTML(message) + '</p>' : '') + '<form id="accountForm">' +
      (isRegister ? '<div class="field"><label for="accountName">Nama lengkap</label><input id="accountName" name="name" required maxlength="70" placeholder="Nama lengkap"></div>' : '') +
      '<div class="field"><label for="accountPhone">Nomor WhatsApp</label><input id="accountPhone" name="phone" required inputmode="tel" maxlength="20" placeholder="08xxxxxxxxxx"></div><div class="field"><label for="accountPin">PIN profil</label><input id="accountPin" name="pin" required minlength="4" maxlength="12" type="password" autocomplete="current-password" placeholder="PIN 4–12 karakter"></div>' +
      '<button class="button button-primary" type="submit">' + (isRegister ? 'Buat profil' : 'Masuk') + ' <span>↗</span></button></form><div class="local-note">Profil hanya tersimpan di browser ini; akun tidak wajib untuk memesan.</div>', false);
  }
  async function hashPin(pin, salt) {
    var payload = salt + ':' + pin;
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      var digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    }
    return btoa(unescape(encodeURIComponent(payload)));
  }
  async function handleAccount(form) {
    var data = new FormData(form), phone = String(data.get('phone') || '').trim(), pin = String(data.get('pin') || '');
    var profile = state.customers.find(function (item) { return item.phone === phone; });
    if (activeAccountTab === 'register') {
      if (profile) { renderAccount('Nomor ini sudah terdaftar di browser ini. Silakan masuk.'); return; }
      var name = String(data.get('name') || '').trim(), salt = Math.random().toString(36).slice(2, 14);
      profile = { name: name, phone: phone, salt: salt, pinHash: await hashPin(pin, salt) };
      state.customers.push(profile); persist(); saveMember(name, phone); closeModal(); showToast('Profil tersimpan di browser ini.'); return;
    }
    if (!profile || await hashPin(pin, profile.salt) !== profile.pinHash) { renderAccount('Nomor WhatsApp atau PIN tidak cocok di browser ini.'); return; }
    saveMember(profile.name, profile.phone); closeModal(); showToast('Profil berhasil dimuat.');
  }
  function saveMember(name, phone) {
    if (!name || !phone) return;
    currentMember = { name: name, phone: phone }; localStorage.setItem('trio-sempol-member-v1', JSON.stringify(currentMember));
  }
  function compressImage(file, maxDimension, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var image = new Image(); image.onerror = reject;
        image.onload = function () {
          var scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function randomHex(length) {
    var bytes = new Uint8Array(length || 24);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }
  async function ownerHash(password, salt) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      var key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      var bits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 180000, hash: 'SHA-256' }, key, 256);
      return Array.from(new Uint8Array(bits)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    }
    return hashPin(password, salt);
  }
  function readOwnerAccount() {
    try { return JSON.parse(localStorage.getItem(OWNER_KEY)); } catch (error) { return null; }
  }
  function openOwner(message) {
    if (isAdminAuthorized()) { openAdmin(); return; }
    var account = readOwnerAccount();
    if (!account) {
      showModal('<div class="modal-eyebrow">AKUN PEMILIK</div><h2 class="modal-title" id="modalTitle">Buat akun pemilik.</h2><p class="modal-lead">Daftarkan email dan kata sandi pribadi untuk membuka panel pada browser ini.</p>' +
        (message ? '<p class="message-box">' + escapeHTML(message) + '</p>' : '') +
        '<form id="ownerSetupForm"><div class="field"><label for="ownerEmail">Email pemilik</label><input id="ownerEmail" name="email" type="email" required autocomplete="email" placeholder="Email pribadi"></div><div class="field"><label for="ownerPassword">Kata sandi</label><input id="ownerPassword" name="password" type="password" required minlength="12" autocomplete="new-password" placeholder="Minimal 12 karakter"></div><div class="field"><label for="ownerPasswordConfirm">Ulangi kata sandi</label><input id="ownerPasswordConfirm" name="confirm" type="password" required minlength="12" autocomplete="new-password"></div><button class="button button-primary" type="submit">Buat akun pemilik <span>↗</span></button></form>' +
        '<div class="local-note">Pengaturan awal hanya tersedia pada browser ini. Situs statis belum menyediakan akun aman lintas perangkat; jangan gunakan data keuangan nyata sebelum backend autentikasi diaktifkan.</div>', false);
      return;
    }
    showModal('<div class="modal-eyebrow">RUANG PEMILIK</div><h2 class="modal-title" id="modalTitle">Masuk ke akun pemilik.</h2><p class="modal-lead">Panel pesanan, foto website, Open PO, dan laporan keuangan.</p>' +
      (message ? '<p class="message-box">' + escapeHTML(message) + '</p>' : '') +
      '<form id="ownerLoginForm"><div class="field"><label for="ownerEmail">Email pemilik</label><input id="ownerEmail" name="email" type="email" required autocomplete="username" value="' + escapeHTML(account.email) + '"></div><div class="field"><label for="ownerPassword">Kata sandi</label><input id="ownerPassword" name="password" type="password" required autocomplete="current-password" placeholder="Kata sandi"></div><button class="button button-primary" type="submit">Masuk ke panel <span>↗</span></button></form>' +
      '<div class="local-note">Akses dilindungi akun pada browser ini. Untuk proteksi publik yang sebenarnya, situs memerlukan autentikasi backend.</div>', false);
  }
  async function handleOwnerSetup(form) {
    var data = new FormData(form), email = String(data.get('email') || '').trim().toLowerCase();
    var password = String(data.get('password') || ''), confirm = String(data.get('confirm') || '');
    if (password.length < 12) { openOwner('Kata sandi harus sedikitnya 12 karakter.'); return; }
    if (password !== confirm) { openOwner('Kata sandi belum sama.'); return; }
    if (readOwnerAccount()) { openOwner('Akun pemilik sudah dibuat pada browser ini.'); return; }
    try {
      var salt = randomHex(16), account = { email: email, salt: salt, passwordHash: await ownerHash(password, salt), sessionToken: randomHex(24) };
      localStorage.setItem(OWNER_KEY, JSON.stringify(account)); sessionStorage.setItem(OWNER_SESSION_KEY, account.sessionToken);
      activeAdminTab = 'orders'; renderAdmin(); showToast('Akun pemilik berhasil dibuat.');
    } catch (error) { openOwner('Browser tidak dapat membuat kredensial. Buka website lewat HTTPS atau localhost.'); }
  }
  async function handleOwnerLogin(form) {
    var data = new FormData(form), email = String(data.get('email') || '').trim().toLowerCase(), password = String(data.get('password') || '');
    var account = readOwnerAccount();
    try {
      if (!account || account.email !== email || await ownerHash(password, account.salt) !== account.passwordHash) { openOwner('Email atau kata sandi tidak cocok.'); return; }
      sessionStorage.setItem(OWNER_SESSION_KEY, account.sessionToken); activeAdminTab = 'orders'; renderAdmin(); showToast('Berhasil masuk ke ruang pemilik.');
    } catch (error) { openOwner('Browser tidak dapat memeriksa akun. Buka website lewat HTTPS atau localhost.'); }
  }
  function openAdmin() {
    if (!isAdminAuthorized()) { openOwner(); return; }
    renderAdmin();
  }
  function requireAdmin() { if (isAdminAuthorized()) return true; openOwner('Sesi panel berakhir. Silakan masuk kembali.'); return false; }
  function monthKey(date) { return String(date).slice(0, 7); }
  function dateInRange(date, start, end) { var key = String(date || '').slice(0, 10); return key >= start && key <= end; }
  function amountForItem(item) { return Number(item.qty || 0) * Number(item.price || state.settings.price); }
  function orderDateForCash(order) { return localDateKey(order.paidAt || order.createdAt); }
  function financeData(start, end) {
    var allEntries = state.financeEntries || [];
    var paidAll = state.orders.filter(function (order) { return order.paymentStatus === 'Lunas terkonfirmasi' && order.status !== 'Dibatalkan'; });
    var paid = paidAll.filter(function (order) { return dateInRange(orderDateForCash(order), start, end); });
    var unpaid = state.orders.filter(function (order) { return order.status !== 'Dibatalkan' && order.paymentStatus !== 'Lunas terkonfirmasi' && dateInRange(order.createdAt, start, end); });
    var productRevenue = 0, shippingRevenue = 0, soldCups = 0, hppSold = 0, deliverySubsidy = 0, salesByFlavor = {}, channel = { Delivery: { orders: 0, cups: 0, revenue: 0, fee: 0, courier: 0, missingCourier: 0 }, Pickup: { orders: 0, cups: 0, revenue: 0, fee: 0, courier: 0, missingCourier: 0 } };
    PRODUCTS.forEach(function (item) { salesByFlavor[item.id] = { name: item.name, cups: 0, revenue: 0, cost: 0 }; });
    paid.forEach(function (order) {
      var row = order.channel === 'Pickup' ? channel.Pickup : channel.Delivery;
      row.orders += 1; row.cups += totalCups(order.items); row.revenue += Number(order.subtotal || 0); row.fee += Number(order.shipping || 0);
      productRevenue += Number(order.subtotal || 0); shippingRevenue += Number(order.shipping || 0);
      (order.items || []).forEach(function (item) {
        var cost = Number(item.qty || 0) * itemUnitCost(item); soldCups += Number(item.qty || 0); hppSold += cost;
        if (!salesByFlavor[item.id]) salesByFlavor[item.id] = { name: item.name || item.id, cups: 0, revenue: 0, cost: 0 };
        salesByFlavor[item.id].cups += Number(item.qty || 0); salesByFlavor[item.id].revenue += amountForItem(item); salesByFlavor[item.id].cost += cost;
      });
      if (order.channel !== 'Pickup') {
        if (order.courierActualCost == null || order.courierActualCost === '') row.missingCourier += 1;
        else { row.courier += Number(order.courierActualCost || 0); deliverySubsidy += Math.max(0, Number(order.courierActualCost || 0) - Number(order.shipping || 0)); }
      }
    });
    var entries = allEntries.filter(function (entry) { return dateInRange(entry.date, start, end); });
    var operational = entries.filter(function (entry) { return entry.type === 'operational'; }).reduce(function (sum, entry) { return sum + Number(entry.amount || 0); }, 0);
    var purchases = entries.filter(function (entry) { return entry.type === 'purchase'; }).reduce(function (sum, entry) { return sum + Number(entry.amount || 0); }, 0);
    var withdrawals = entries.filter(function (entry) { return entry.type === 'withdrawal'; }).reduce(function (sum, entry) { return sum + Number(entry.amount || 0); }, 0);
    var wasteCups = 0, freeCups = 0, wasteHpp = 0;
    entries.filter(function (entry) { return entry.type === 'waste' || entry.type === 'free'; }).forEach(function (entry) {
      var qty = Number(entry.quantity || 0), cost = qty * costPerCup(entry.variant || PRODUCTS[0].id);
      wasteHpp += cost;
      if (entry.type === 'waste') wasteCups += qty; else freeCups += qty;
    });
    var courierCost = channel.Delivery.courier + channel.Pickup.courier;
    var domain = Number(state.settings.domainMonthlyCost || 0) * Math.max(1, (new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000 + 1) / 30;
    var grossProfit = productRevenue - hppSold - wasteHpp;
    var netProfit = grossProfit + shippingRevenue - courierCost - operational - domain;
    var pending = unpaid.reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
    var cashInRange = paid.reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
    function entryBefore(entry) { return String(entry.date || '') < start; }
    var entriesBefore = allEntries.filter(entryBefore);
    var cashBefore = Number(state.settings.initialCash || 0) + paidAll.filter(function (order) { return orderDateForCash(order) < start; }).reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
    cashBefore -= entriesBefore.filter(function (entry) { return entry.type === 'operational' || entry.type === 'purchase' || entry.type === 'withdrawal'; }).reduce(function (sum, entry) { return sum + Number(entry.amount || 0); }, 0);
    cashBefore -= paidAll.filter(function (order) { return order.channel !== 'Pickup' && order.courierActualCost != null && localDateKey(order.deliveryDate || order.createdAt) < start; }).reduce(function (sum, order) { return sum + Number(order.courierActualCost || 0); }, 0);
    var cashOutRange = operational + purchases + withdrawals + courierCost;
    var netCash = cashInRange - cashOutRange;
    var rangeDays = Math.max(1, Math.round((new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000) + 1);
    var daily = [];
    for (var d = new Date(start + 'T12:00:00'); d <= new Date(end + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
      var key = localDateKey(d), dayOrders = paid.filter(function (order) { return orderDateForCash(order) === key; });
      var rev = 0, cogs = 0, courier = 0;
      dayOrders.forEach(function (order) { rev += Number(order.subtotal || 0) + Number(order.shipping || 0); (order.items || []).forEach(function (item) { cogs += Number(item.qty || 0) * itemUnitCost(item); }); courier += Number(order.courierActualCost || 0); });
      var dayExpense = allEntries.filter(function (entry) { return entry.date === key && entry.type === 'operational'; }).reduce(function (sum, entry) { return sum + Number(entry.amount || 0); }, 0);
      daily.push({ date: key, revenue: rev, profit: rev - cogs - courier - dayExpense - Number(state.settings.domainMonthlyCost || 0) / 30 });
    }
    var counts = state.orders.filter(function (order) { return order.status !== 'Dibatalkan' && dateInRange(order.createdAt, start, end); });
    var averageOrder = paid.length ? (productRevenue + shippingRevenue) / paid.length : 0;
    var averageCups = paid.length ? soldCups / paid.length : 0;
    return {
      paid: paid, unpaid: unpaid, entries: entries, productRevenue: productRevenue, shippingRevenue: shippingRevenue,
      soldCups: soldCups, hppSold: hppSold, wasteCups: wasteCups, freeCups: freeCups, wasteHpp: wasteHpp,
      grossProfit: grossProfit, netProfit: netProfit, operational: operational, purchases: purchases, withdrawals: withdrawals,
      domain: domain, courierCost: courierCost, deliverySubsidy: deliverySubsidy, pending: pending, cashIn: cashInRange,
      cashStart: cashBefore, cashOut: cashOutRange, netCash: netCash, cashEnd: cashBefore + netCash,
      salesByFlavor: salesByFlavor, channel: channel, daily: daily, counts: counts, averageOrder: averageOrder,
      averageCups: averageCups, missingCourier: channel.Delivery.missingCourier, rangeDays: rangeDays
    };
  }
  function compactMoney(value) {
    var n = Number(value) || 0;
    if (Math.abs(n) >= 1000000) return 'Rp' + (n / 1000000).toFixed(1).replace('.', ',') + ' jt';
    if (Math.abs(n) >= 1000) return 'Rp' + Math.round(n / 1000) + ' rb';
    return 'Rp' + Math.round(n);
  }
  function renderLineChart(daily) {
    var width = 960, height = 290, left = 70, right = 24, top = 20, bottom = 42;
    if (!daily.length) return '<div class="admin-empty">Belum ada data pada rentang ini.</div>';
    var values = daily.reduce(function (acc, d) { acc.push(d.revenue, d.profit); return acc; }, [0]);
    var min = Math.min(0, Math.min.apply(Math, values)), max = Math.max(1, Math.max.apply(Math, values));
    if (max === min) max = min + 1;
    function y(value) { return top + (max - value) / (max - min) * (height - top - bottom); }
    function x(index) { return left + (daily.length < 2 ? 0 : index * (width - left - right) / (daily.length - 1)); }
    var grid = [0, 1, 2, 3].map(function (i) {
      var value = max - (max - min) * i / 3, yy = y(value);
      return '<line x1="' + left + '" y1="' + yy + '" x2="' + (width - right) + '" y2="' + yy + '" class="chart-grid-line"/><text x="' + (left - 9) + '" y="' + (yy + 4) + '" text-anchor="end" class="chart-axis-label">' + compactMoney(value) + '</text>';
    }).join('');
    var revenue = daily.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.revenue).toFixed(1); }).join(' ');
    var profit = daily.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.profit).toFixed(1); }).join(' ');
    var step = Math.max(1, Math.ceil(daily.length / 8));
    var labels = daily.map(function (d, i) { if (i % step !== 0 && i !== daily.length - 1) return ''; return '<text x="' + x(i).toFixed(1) + '" y="' + (height - 12) + '" text-anchor="middle" class="chart-axis-label">' + d.date.slice(8, 10) + '/' + d.date.slice(5, 7) + '</text>'; }).join('');
    return '<div class="chart-legend"><span><i class="legend-revenue"></i> Omzet</span><span><i class="legend-profit"></i> Laba bersih harian*</span></div><div class="chart-scroll"><svg class="finance-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Grafik omzet dan laba bersih harian">' + grid + '<path d="' + revenue + '" class="chart-path chart-path-revenue"/><path d="' + profit + '" class="chart-path chart-path-profit"/>' + daily.map(function (d, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(d.revenue).toFixed(1) + '" r="3.5" class="chart-dot-revenue"><title>' + d.date + ' · omzet ' + money(d.revenue) + '</title></circle>'; }).join('') + labels + '</svg></div><p class="chart-footnote">*Laba harian memakai HPP estimasi dan alokasi biaya domain; angka laba periode pada tabel adalah ringkasan utama.</p>';
  }
  function renderFlavorChart(data) {
    var rows = PRODUCTS.map(function (item) { return data.salesByFlavor[item.id] || { name: item.name, cups: 0, revenue: 0 }; });
    var max = Math.max(1, Math.max.apply(Math, rows.map(function (r) { return r.cups; })));
    return '<div class="flavor-report">' + rows.map(function (row, index) { return '<div class="flavor-report-row"><span class="flavor-report-name">' + escapeHTML(row.name) + '</span><span class="flavor-track"><i style="width:' + (row.cups / max * 100) + '%;--bar-color:' + PRODUCTS[index].color + '"></i></span><strong>' + number(row.cups) + ' cup</strong></div>'; }).join('') + '</div>';
  }
  function renderChannelChart(data) {
    var delivery = data.channel.Delivery, pickup = data.channel.Pickup;
    return '<div class="channel-report-grid"><article><span>Pesanan Delivery</span><strong>' + number(delivery.orders) + '</strong><small>' + number(delivery.cups) + ' cup · omzet produk ' + money(delivery.revenue) + '</small></article><article><span>Ongkir dibayar pelanggan</span><strong>' + money(delivery.fee) + '</strong><small>Biaya kurir yang dicatat ' + money(delivery.courier) + '</small></article><article><span>Subsidi delivery tercatat</span><strong>' + money(data.deliverySubsidy) + '</strong><small>Selisih biaya kurir dengan ongkir pelanggan</small></article><article><span>Pesanan Pickup</span><strong>' + number(pickup.orders) + '</strong><small>' + number(pickup.cups) + ' cup · ' + money(pickup.revenue) + '</small></article></div>' + (data.missingCourier ? '<p class="data-alert">' + data.missingCourier + ' pesanan delivery lunas belum memiliki input biaya kurir aktual; analisis subsidi belum lengkap.</p>' : '');
  }
  function renderForecast(data) {
    var avgPrice = state.settings.price, avgCost = PRODUCTS.reduce(function (sum, item) { return sum + costPerCup(item.id); }, 0) / PRODUCTS.length;
    var fixed = data.operational + data.domain;
    var scenarios = [{ name: 'Sepi', cups: 20 }, { name: 'Target batch', cups: 50 }, { name: 'Ramai', cups: 80 }];
    var results = scenarios.map(function (item) { return { name: item.name, cups: item.cups, profit: item.cups * (avgPrice - avgCost) - fixed }; });
    var min = Math.min(0, Math.min.apply(Math, results.map(function (x) { return x.profit; }))), max = Math.max(1, Math.max.apply(Math, results.map(function (x) { return x.profit; })));
    var range = Math.max(1, max - min);
    return '<div class="forecast-banner">SIMULASI · bukan transaksi aktual. HPP ' + (state.settings.hppValidated ? 'ditandai tervalidasi' : 'masih estimasi') + '.</div><div class="forecast-bars">' + results.map(function (item) {
      var height = Math.max(9, Math.abs(item.profit) / range * 128);
      return '<article><div class="forecast-bar-wrap"><i class="forecast-bar ' + (item.profit < 0 ? 'negative' : '') + '" style="height:' + height + 'px"></i></div><strong>' + money(item.profit) + '</strong><span>' + item.name + ' · ' + item.cups + ' cup</span></article>';
    }).join('') + '</div><p class="chart-footnote">Dihitung dari harga jual dan HPP estimasi saat ini, ditambah biaya operasional periode terpilih. Tidak termasuk ongkir atau pertumbuhan penjualan.</p>';
  }
  function renderFinanceOrders(data) {
    var rows = data.paid.map(function (order) {
      var items = (order.items || []).map(function (item) { return escapeHTML(item.name) + ' × ' + number(item.qty); }).join('<br>');
      return '<tr><td>' + escapeHTML(dateLabel(orderDateForCash(order), { day: 'numeric', month: 'short', year: 'numeric' })) + '</td><td>' + escapeHTML(order.id) + '<br><small>' + escapeHTML(order.customerName) + '</small></td><td>' + items + '</td><td>' + escapeHTML(order.channel || 'Delivery') + '<br><small>' + escapeHTML(order.deliverySlot || '') + '</small></td><td>' + money(order.subtotal) + '</td><td>' + money(order.shipping) + '</td><td>' + (order.courierActualCost == null ? 'Belum dicatat' : money(order.courierActualCost)) + '</td></tr>';
    }).join('');
    return '<section class="finance-panel finance-panel-wide finance-orders-panel"><div class="finance-panel-heading"><div><span class="panel-kicker">RINCIAN TRANSAKSI AKTUAL</span><h3>Pesanan lunas per order</h3></div><p>Ongkir pelanggan dan biaya kurir dipisahkan untuk rekonsiliasi.</p></div><div class="finance-table-wrap"><table class="finance-table finance-order-table"><thead><tr><th>Tanggal bayar</th><th>Order / pemesan</th><th>Varian dan cup</th><th>Kanal / slot</th><th>Omzet produk</th><th>Ongkir masuk</th><th>Kurir aktual</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">Belum ada pesanan lunas pada periode ini.</td></tr>') + '</tbody></table></div></section>';
  }
  function financeEntryFields(type) {
    if (type === 'waste' || type === 'free') {
      return '<div class="field"><label for="entryVariant">Varian saus</label><select id="entryVariant" name="variant">' + PRODUCTS.map(function (item) { return '<option value="' + item.id + '">' + escapeHTML(item.name) + '</option>'; }).join('') + '</select></div><div class="field"><label for="entryQuantity">Jumlah cup</label><input id="entryQuantity" name="quantity" type="number" min="1" step="1" required></div><p class="field-hint">HPP cup akan dihitung otomatis sebagai produk gratis atau terbuang.</p>';
    }
    var label = type === 'purchase' ? 'Total belanja aktual' : type === 'withdrawal' ? 'Jumlah penarikan' : 'Jumlah biaya operasional';
    return '<div class="field"><label for="entryAmount">' + label + ' (Rp)</label><input id="entryAmount" name="amount" type="number" min="1" step="500" required></div><div class="field"><label for="entryCategory">Kategori / nama barang</label><input id="entryCategory" name="category" required maxlength="80" placeholder="Contoh: promosi, sempol, cup, domain"></div><div class="field"><label for="entryMethod">Metode pembayaran</label><select id="entryMethod" name="method"><option>Tunai</option><option>Transfer</option><option>E-wallet</option><option>Lainnya</option></select></div>';
  }
  function renderLedger(entries) {
    if (!entries.length) return '<div class="admin-empty">Belum ada input biaya, belanja, atau waste pada periode ini.</div>';
    return '<div class="ledger-list">' + entries.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (entry) {
      var labels = { operational: 'Biaya operasional', purchase: 'Belanja stok/aset', withdrawal: 'Penarikan pemilik', waste: 'Cup terbuang', free: 'Cup gratis' };
      var detail = entry.type === 'waste' || entry.type === 'free' ? number(entry.quantity) + ' cup · ' + escapeHTML(product(entry.variant).name) : money(entry.amount) + ' · ' + escapeHTML(entry.method || 'Tunai');
      return '<article class="ledger-row"><div><strong>' + escapeHTML(labels[entry.type] || entry.type) + '</strong><span>' + escapeHTML(entry.category || (entry.type === 'waste' ? 'Waste produksi' : 'Cup gratis')) + '</span><small>' + escapeHTML(dateLabel(entry.date, { day: 'numeric', month: 'short', year: 'numeric' })) + ' · ' + detail + '</small></div><button class="small-action" data-action="delete-entry" data-id="' + escapeHTML(entry.id) + '" aria-label="Hapus catatan">Hapus</button></article>';
    }).join('') + '</div>';
  }
  function renderFinance() {
    var start = reportStart || monthStart(), end = reportEnd || todayISO(), data = financeData(start, end);
    var unpaidCount = data.unpaid.length, margin = data.productRevenue ? data.netProfit / data.productRevenue * 100 : 0;
    var complete = !data.missingCourier;
    var entriesHtml = renderLedger(data.entries);
    var chart = renderLineChart(data.daily);
    var profitClass = data.netProfit >= 0 ? 'positive' : 'negative';
    var summary = '<div class="finance-kpis"><article><span>Omzet produk lunas</span><strong>' + money(data.productRevenue) + '</strong><small>' + number(data.soldCups) + ' cup terjual</small></article><article><span>Kas diterima</span><strong>' + money(data.cashIn) + '</strong><small>termasuk ongkir pelanggan</small></article><article><span>Laba kotor</span><strong>' + money(data.grossProfit) + '</strong><small>setelah HPP penjualan & waste</small></article><article class="' + profitClass + '"><span>Laba / rugi bersih</span><strong>' + money(data.netProfit) + '</strong><small>margin produk ' + margin.toFixed(1).replace('.', ',') + '%</small></article><article><span>Saldo kas akhir</span><strong>' + money(data.cashEnd) + '</strong><small>saldo awal + arus kas periode</small></article><article><span>PO menunggu pembayaran</span><strong>' + money(data.pending) + '</strong><small>' + number(unpaidCount) + ' pesanan non-batal</small></article></div>';
    var pl = '<div class="finance-table-wrap"><table class="finance-table"><tbody>' +
      '<tr><th colspan="2">Laporan laba-rugi · ' + escapeHTML(dateLabel(start, { day: 'numeric', month: 'short', year: 'numeric' })) + ' – ' + escapeHTML(dateLabel(end, { day: 'numeric', month: 'short', year: 'numeric' })) + '</th></tr>' +
      '<tr><td>Penjualan produk dari pesanan lunas</td><td>' + money(data.productRevenue) + '</td></tr><tr><td>Ongkir diterima pelanggan</td><td>' + money(data.shippingRevenue) + '</td></tr><tr class="sub-total"><td>Total penerimaan pelanggan</td><td>' + money(data.productRevenue + data.shippingRevenue) + '</td></tr>' +
      '<tr><td>HPP produk terjual <small>(' + (state.settings.hppValidated ? 'ditandai tervalidasi' : 'estimasi') + ')</small></td><td>− ' + money(data.hppSold) + '</td></tr><tr><td>HPP cup gratis / terbuang (' + data.freeCups + ' gratis, ' + data.wasteCups + ' waste)</td><td>− ' + money(data.wasteHpp) + '</td></tr><tr class="sub-total"><td>Laba kotor produk</td><td>' + money(data.grossProfit) + '</td></tr>' +
      '<tr><td>Biaya kurir aktual tercatat</td><td>− ' + money(data.courierCost) + '</td></tr><tr><td>Biaya operasional</td><td>− ' + money(data.operational) + '</td></tr><tr><td>Alokasi domain bulanan (prorata)</td><td>− ' + money(data.domain) + '</td></tr><tr class="grand-total"><td>Laba / rugi bersih</td><td>' + money(data.netProfit) + '</td></tr></tbody></table></div>' +
      '<div class="finance-table-wrap"><table class="finance-table"><tbody><tr><th colspan="2">Laporan arus kas</th></tr><tr><td>Saldo kas awal periode</td><td>' + money(data.cashStart) + '</td></tr><tr><td>Penerimaan pelanggan</td><td>+ ' + money(data.cashIn) + '</td></tr><tr><td>Belanja bahan, kemasan, dan aset</td><td>− ' + money(data.purchases) + '</td></tr><tr><td>Biaya operasional dibayar</td><td>− ' + money(data.operational) + '</td></tr><tr><td>Biaya kurir aktual tercatat</td><td>− ' + money(data.courierCost) + '</td></tr><tr><td>Penarikan pemilik</td><td>− ' + money(data.withdrawals) + '</td></tr><tr class="sub-total"><td>Arus kas bersih</td><td>' + (data.netCash >= 0 ? '+ ' : '− ') + money(Math.abs(data.netCash)) + '</td></tr><tr class="grand-total"><td>Saldo kas akhir periode</td><td>' + money(data.cashEnd) + '</td></tr></tbody></table></div>';
    var recordTable = '<section class="finance-panel"><div class="finance-panel-heading"><div><span class="panel-kicker">INPUT YANG DIPERLUKAN</span><h3>Biaya dan pergerakan kas</h3></div><p>Penjualan dihitung dari pesanan lunas. Catat biaya operasional, belanja aktual, penarikan pemilik, cup gratis, dan waste.</p></div><form id="financeEntryForm" class="finance-entry-form"><div class="field"><label for="entryDate">Tanggal</label><input id="entryDate" name="date" type="date" value="' + todayISO() + '" required></div><div class="field"><label for="entryType">Jenis catatan</label><select id="entryType" name="type"><option value="operational">Biaya operasional</option><option value="purchase">Belanja bahan / kemasan / aset</option><option value="withdrawal">Penarikan pemilik</option><option value="free">Cup gratis</option><option value="waste">Cup terbuang / waste</option></select></div><div id="financeEntryDynamic" class="finance-entry-dynamic">' + financeEntryFields('operational') + '</div><div class="field full"><label for="entryNote">Catatan (opsional)</label><input id="entryNote" name="note" maxlength="160" placeholder="Nomor nota atau keterangan"></div><button class="button button-primary" type="submit">Simpan catatan <span>↗</span></button></form>' + entriesHtml + '</section>';
    return '<section class="finance-dashboard"><div class="finance-toolbar"><div><span class="panel-kicker">RUANG PEMILIK · ANALISIS USAHA</span><h3>Laporan keuangan</h3></div><div class="finance-toolbar-actions"><form id="reportPeriodForm" class="period-form"><label for="reportStart">Dari</label><input id="reportStart" name="start" type="date" value="' + start + '" required><label for="reportEnd">sampai</label><input id="reportEnd" name="end" type="date" value="' + end + '" required><button class="small-action" type="submit">Terapkan</button></form><button class="small-action" data-action="print-finance">Cetak / Simpan PDF</button><button class="small-action" data-action="export-finance">Unduh CSV</button></div></div>' +
      '<div class="finance-assumption ' + (state.settings.hppValidated ? 'validated' : '') + '"><strong>' + (state.settings.hppValidated ? 'HPP ditandai tervalidasi' : 'HPP masih estimasi') + '</strong><span>Angka awal berasal dari worksheet, termasuk asumsi kemasan dan operasional per cup. Perbarui di Pengaturan setelah resep dan nota diperiksa.</span>' + (complete ? '' : '<span>Biaya kurir belum lengkap pada ' + data.missingCourier + ' order delivery.</span>') + '</div>' + summary +
      '<div class="finance-layout"><section class="finance-panel finance-panel-wide"><div class="finance-panel-heading"><div><span class="panel-kicker">TREN TRANSAKSI LUNAS</span><h3>Omzet dan laba harian</h3></div><p>Hanya pesanan lunas non-batal masuk ke omzet aktual. PO belum lunas ditampilkan terpisah.</p></div>' + chart + '</section>' +
      '<section class="finance-panel"><div class="finance-panel-heading"><div><span class="panel-kicker">PENJUALAN PRODUK</span><h3>Varian saus</h3></div><p>Jumlah cup terjual per rasa dalam periode ini.</p></div>' + renderFlavorChart(data) + '</section>' +
      '<section class="finance-panel"><div class="finance-panel-heading"><div><span class="panel-kicker">KANAL & PENGIRIMAN</span><h3>Delivery dan pickup</h3></div><p>Biaya kurir diinput per pesanan agar subsidi tidak ditebak.</p></div>' + renderChannelChart(data) + '</section>' +
      '<section class="finance-panel finance-panel-wide"><div class="finance-panel-heading"><div><span class="panel-kicker">PERENCANAAN</span><h3>Simulasi sepi, target, dan ramai</h3></div><p>Proyeksi memakai HPP rata-rata lima varian dan tidak dicampur ke transaksi aktual.</p></div>' + renderForecast(data) + '</section>' +
      '<section class="finance-panel finance-panel-wide"><div class="finance-panel-heading"><div><span class="panel-kicker">RINGKASAN OTOMATIS</span><h3>Laba-rugi dan arus kas</h3></div><p>Belanja persediaan masuk arus kas dan tidak dipotong lagi sebagai HPP.</p></div><div class="finance-tables">' + pl + '</div><p class="chart-footnote">Saldo kas memakai modal awal dari worksheet (dapat diganti di Pengaturan) dan catatan transaksi yang tersedia. Angka simulasi bukan realisasi.</p></section>' + renderFinanceOrders(data) +
      '<section class="finance-panel finance-panel-wide">' + recordTable + '</section></div></section>';
  }

  function printFinanceReport() {
    if (!requireAdmin()) return;
    var dashboard = document.querySelector('#modalBody .finance-dashboard');
    if (!dashboard) { showToast('Buka tab Keuangan dan pilih periode laporan terlebih dahulu.'); return; }
    var clone = dashboard.cloneNode(true);
    var toolbar = clone.querySelector('.finance-toolbar-actions'); if (toolbar) toolbar.remove();
    var entryForm = clone.querySelector('.finance-entry-form'); if (entryForm) entryForm.remove();
    clone.querySelectorAll('[data-action="delete-entry"]').forEach(function (button) { button.remove(); });
    clone.querySelectorAll('button').forEach(function (button) { button.remove(); });
    var entryHeading = clone.querySelector('.finance-entry-form') && clone.querySelector('.finance-entry-form').parentElement.querySelector('.panel-kicker');
    if (entryHeading) entryHeading.textContent = 'CATATAN TRANSAKSI';
    var start = reportStart || monthStart(), end = reportEnd || todayISO();
    var popup = window.open('', '_blank');
    if (!popup) { showToast('Browser memblokir jendela cetak. Izinkan pop-up untuk membuka laporan.'); return; }
    var base = location.href.split('#')[0];
    var printCss = '<style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#fff;color:#30221f;font-family:Arial,sans-serif}body *{visibility:visible!important}#modalBackdrop{display:none!important}.print-report-heading{margin:0 0 14px;padding-bottom:12px;border-bottom:2px solid #8e1822}.print-report-heading h1{margin:0;color:#8e1822;font-size:23px}.print-report-heading p{margin:5px 0 0;color:#66564e;font-size:12px}.finance-dashboard{gap:11px}.finance-assumption{font-size:10px;padding:8px 11px}.finance-assumption strong{font-size:11px}.finance-kpis{grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.finance-kpis article{min-height:75px;padding:8px}.finance-kpis article span,.finance-kpis article small{font-size:8px}.finance-kpis article strong{font-size:13px}.finance-layout{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.finance-panel,.finance-panel-wide{grid-column:auto;padding:10px;box-shadow:none;break-inside:avoid;border:1px solid #dfd3c5}.finance-panel-wide{grid-column:1/-1}.finance-panel-heading{margin-bottom:8px}.finance-panel-heading h3,.finance-toolbar h3{font-size:15px}.finance-panel-heading p,.chart-footnote{font-size:8px}.finance-chart{min-width:0;width:100%}.chart-scroll,.finance-table-wrap{overflow:visible}.chart-axis-label{font-size:9px}.chart-legend{font-size:9px;margin:3px 0}.forecast-bars article{padding:6px}.forecast-bar-wrap{height:90px}.forecast-bar{width:32px}.forecast-bars strong{font-size:10px}.forecast-bars span,.forecast-banner{font-size:8px}.finance-tables{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.finance-table{font-size:8px}.finance-table th{padding:6px;font-size:9px}.finance-table td{padding:5px 6px}.finance-table td small{font-size:7px}.finance-order-table{font-size:7px}.finance-order-table th{font-size:7px}.finance-order-table td{white-space:normal}.finance-order-table td:first-child,.finance-order-table td:nth-child(2){white-space:nowrap}.finance-order-table small{font-size:7px}.flavor-report{gap:7px}.flavor-report-row{grid-template-columns:115px 1fr auto;gap:6px}.flavor-report-name,.flavor-report-row strong{font-size:8px}.flavor-track{height:8px}.channel-report-grid article{padding:7px}.channel-report-grid article span,.channel-report-grid article small{font-size:8px}.channel-report-grid article strong{font-size:12px}.ledger-row{padding:6px}.ledger-row strong,.ledger-row span{font-size:8px}.ledger-row small{font-size:7px}.finance-orders-panel{break-before:page}.finance-order-table tr{break-inside:avoid}a{color:inherit;text-decoration:none}@media print{body{background:#fff}}</style>';
    popup.document.open();
    popup.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><base href="' + escapeHTML(base) + '"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laporan Keuangan Trio Sempol</title><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="enhancements.css">' + printCss + '</head><body><header class="print-report-heading"><h1>Laporan Keuangan Trio Sempol</h1><p>Periode ' + escapeHTML(dateLabel(start)) + ' – ' + escapeHTML(dateLabel(end)) + ' · Dicetak ' + escapeHTML(new Date().toLocaleString('id-ID')) + '</p></header>' + clone.outerHTML + '</body></html>');
    popup.document.close();
    popup.focus();
    setTimeout(function () { try { popup.print(); } catch (error) { showToast('Gunakan Cetak pada jendela laporan untuk menyimpan PDF.'); } }, 700);
  }

  function renderAdminOrders() {
    var orders = state.orders.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    if (!orders.length) return '<div class="admin-empty">Belum ada pesanan di browser ini.</div>';
    return '<div class="admin-orders">' + orders.map(function (order) {
      var lines = (order.items || []).map(function (item) { return escapeHTML(item.name) + ' × ' + number(item.qty); }).join(' · ');
      var messageText = order.paymentStatus === 'Lunas terkonfirmasi' ? 'Halo ' + order.customerName + ', pembayaran pesanan ' + order.id + ' sudah kami konfirmasi. Status pesanan: ' + order.status + '.' : 'Halo ' + order.customerName + ', status pesanan ' + order.id + ': ' + order.status + '.';
      var waNumber = String(order.phone || '').replace(/\D/g, ''); if (waNumber.charAt(0) === '0') waNumber = '62' + waNumber.slice(1);
      var proof = order.proof ? '<img class="proof-preview" src="' + order.proof + '" alt="Bukti pembayaran ' + escapeHTML(order.id) + '">' : '<p>Bukti pembayaran belum diunggah.</p>';
      var courier = order.channel === 'Pickup' ? '' : '<form class="courier-form" data-order="' + escapeHTML(order.id) + '"><label>Biaya kurir aktual (Rp)<input name="courierActualCost" type="number" min="0" step="500" value="' + (order.courierActualCost == null ? '' : Number(order.courierActualCost)) + '" placeholder="Isi setelah dikirim"></label><button class="small-action" type="submit">Simpan ongkir aktual</button></form>';
      return '<article class="admin-order"><div class="admin-order-head"><div><strong>' + escapeHTML(order.id) + ' · ' + escapeHTML(order.customerName) + '</strong><small>Dibuat ' + escapeHTML(new Date(order.createdAt).toLocaleString('id-ID')) + ' · ' + escapeHTML(order.phone) + '</small></div><span class="status-pill">' + escapeHTML(order.paymentStatus) + '</span></div>' +
        '<p class="admin-order-details">' + lines + '<br><strong>' + money(order.total) + '</strong> · ' + escapeHTML(order.address) + '<br><strong>Slot antar:</strong> ' + escapeHTML(dateLabel(order.deliveryDate || order.createdAt)) + ' · ' + escapeHTML(order.deliverySlot || 'Belum dipilih') + '</p>' +
        (order.payerName ? '<p>Nama pembayar: <strong>' + escapeHTML(order.payerName) + '</strong></p>' : '') + proof + '<div><span class="status-pill">' + escapeHTML(order.status) + '</span></div>' + courier +
        '<div class="admin-order-actions"><button class="small-action" data-action="mark-paid" data-id="' + escapeHTML(order.id) + '"' + (order.paymentStatus === 'Lunas terkonfirmasi' ? ' disabled' : '') + '>Konfirmasi lunas</button>' +
        '<button class="small-action" data-action="set-status" data-id="' + escapeHTML(order.id) + '" data-status="Sedang disiapkan">Siapkan</button><button class="small-action" data-action="set-status" data-id="' + escapeHTML(order.id) + '" data-status="Dalam pengantaran">Dalam antar</button>' +
        '<button class="small-action" data-action="set-status" data-id="' + escapeHTML(order.id) + '" data-status="Selesai">Selesai</button><button class="small-action" data-action="set-status" data-id="' + escapeHTML(order.id) + '" data-status="Dibatalkan">Batalkan</button>' +
        '<a class="small-action" href="https://wa.me/' + waNumber + '?text=' + encodeURIComponent(messageText) + '" target="_blank" rel="noreferrer">Hubungi WhatsApp</a><button class="small-action" data-action="receipt" data-id="' + escapeHTML(order.id) + '">Struk</button></div></article>';
    }).join('') + '</div>';
  }
  function renderAdminInventory() {
    return '<form id="inventoryForm"><div class="inventory-list">' + PRODUCTS.map(function (item) {
      return '<label class="inventory-row"><span><strong>' + escapeHTML(item.name) + '</strong><small>' + money(state.settings.price) + ' / cup · porsi ' + state.settings.costs.sticksPerCup + ' tusuk</small></span><span class="field-hint">Sisa cup</span><input name="' + item.id + '" type="number" min="0" max="9999" value="' + Number(state.inventory[item.id] || 0) + '" aria-label="Stok ' + escapeHTML(item.name) + '"></label>';
    }).join('') + '</div><div class="form-action-row"><button class="button button-primary" type="submit">Simpan stok <span>↗</span></button></div></form><p class="field-hint">Pesanan baru mengurangi stok otomatis. Batalkan pesanan akan mengembalikan stok satu kali.</p>';
  }
  function renderClosedDateManager() {
    var dates = state.settings.closedDates.slice().sort();
    return '<section class="schedule-admin"><div><h4>Penutupan tanggal Open PO</h4><p>Blokir tanggal tertentu di luar jadwal mingguan, misalnya saat stok atau kapasitas tidak tersedia.</p></div><form id="closeDateForm"><label for="closePoDate">Tanggal</label><input id="closePoDate" name="date" type="date" min="' + todayISO() + '" required><button class="small-action" type="submit">Tutup tanggal</button></form>' +
      (dates.length ? '<div class="closed-date-list">' + dates.map(function (date) { return '<span>' + escapeHTML(dateLabel(date)) + ' <button class="small-action" data-action="open-date" data-date="' + date + '">Buka kembali</button></span>'; }).join('') + '</div>' : '<p class="field-hint">Belum ada tanggal yang ditutup manual.</p>') + '</section>';
  }
  function renderAdminSettings() {
    var costs = state.settings.costs;
    var weekdays = Object.keys(WEEKLY_SCHEDULE).map(Number);
    var photoEntries = [['hero', 'Foto utama', 'assets/cup-saus.jpg'], ['menu', 'Foto produk utama', 'assets/sempol-crispy.jpg'], ['story', 'Foto cerita', 'assets/cup-saus.jpg']].concat(PRODUCTS.map(function (item) { return [item.photoKey, 'Foto ' + item.name, item.image]; }));
    return '<form id="settingsForm"><div class="admin-setting-grid"><div><h3>Harga, Open PO, dan kas</h3>' +
      '<div class="field"><label for="payee">Nama penerima QRIS</label><input id="payee" name="payee" value="' + escapeHTML(state.settings.payee) + '" required maxlength="70"></div>' +
      '<div class="field"><label for="adminWhatsapp">WhatsApp pemilik</label><input id="adminWhatsapp" name="whatsapp" inputmode="tel" value="' + escapeHTML(state.settings.whatsapp) + '" placeholder="628xxxxxxxxxx"></div>' +
      '<div class="field"><label for="price">Harga per cup (porsi saat ini ' + costs.sticksPerCup + ' tusuk)</label><input id="price" name="price" type="number" min="1000" step="500" value="' + Number(state.settings.price) + '"></div>' +
      '<div class="field"><label for="deliveryFee">Ongkir 1–7 cup (Rp/order)</label><input id="deliveryFee" name="deliveryFee" type="number" min="0" step="1000" value="' + Number(state.settings.deliveryFee) + '"></div>' +
      '<div class="field"><label for="freeFrom">Gratis ongkir mulai cup</label><input id="freeFrom" name="freeFrom" type="number" min="1" max="999" value="' + Number(state.settings.freeFrom) + '"></div>' +
      '<div class="field"><label for="poCapacity">Kuota Open PO per tanggal (cup)</label><input id="poCapacity" name="poCapacity" type="number" min="1" max="9999" value="' + Number(state.settings.poCapacity) + '"></div>' +
      '<div class="field"><label for="initialCash">Modal awal / saldo kas awal (Rp)</label><input id="initialCash" name="initialCash" type="number" min="0" step="1000" value="' + Number(state.settings.initialCash) + '"><span class="field-hint">Nilai contoh dari worksheet. Ganti dengan uang usaha yang benar-benar tersedia.</span></div>' +
      '<div class="field"><label for="domainMonthlyCost">Alokasi biaya domain per bulan (Rp)</label><input id="domainMonthlyCost" name="domainMonthlyCost" type="number" min="0" step="500" value="' + Number(state.settings.domainMonthlyCost) + '"></div>' +
      '<fieldset class="closed-weekdays"><legend>Hari PO ditutup</legend>' + weekdays.map(function (day) { return '<label><input type="checkbox" name="closedWeekdays" value="' + day + '"' + (state.settings.closedWeekdays.indexOf(day) !== -1 ? ' checked' : '') + '> ' + WEEKLY_SCHEDULE[day].name + '</label>'; }).join('') + '</fieldset></div>' +
      '<div><h3>HPP dan pembayaran</h3><p class="field-hint">Angka awal mengikuti worksheet dan masih asumsi. Perbarui sesuai nota, takaran resep, dan hasil produksi.</p>' +
      '<div class="field"><label for="sempolPackPrice">Harga sempol per pak (Rp)</label><input id="sempolPackPrice" name="sempolPackPrice" type="number" min="0" step="100" value="' + Number(costs.sempolPackPrice) + '"></div>' +
      '<div class="field"><label for="sticksPerPack">Tusuk per pak sempol</label><input id="sticksPerPack" name="sticksPerPack" type="number" min="1" step="1" value="' + Number(costs.sticksPerPack) + '"></div>' +
      '<div class="field"><label for="sticksPerCup">Tusuk per cup</label><input id="sticksPerCup" name="sticksPerCup" type="number" min="1" step="1" value="' + Number(costs.sticksPerCup) + '"></div>' +
      '<div class="field"><label for="targetBatch">Target cup per batch (pembagi biaya saus)</label><input id="targetBatch" name="targetBatch" type="number" min="1" step="1" value="' + Number(costs.targetBatch) + '"></div>' +
      '<div class="field"><label for="otherPerCup">Biaya variabel lain per cup (Rp)</label><input id="otherPerCup" name="otherPerCup" type="number" min="0" step="10" value="' + Number(costs.otherPerCup) + '"><span class="field-hint">Estimasi awal Rp3.008 mencakup minyak, cup, tutup, sarung tangan, kantong, stiker, gas, utilitas, kebersihan.</span></div>' +
      '<div class="sauce-cost-grid">' + PRODUCTS.map(function (item) { return '<div class="field"><label for="sauce-' + item.id + '">Biaya ' + escapeHTML(item.name) + ' per batch (Rp)</label><input id="sauce-' + item.id + '" name="sauce-' + item.id + '" type="number" min="0" step="100" value="' + Number(costs.sauceBatch[item.id]) + '"></div>'; }).join('') + '</div>' +
      '<label class="check-row hpp-validated-row"><input type="checkbox" name="hppValidated"' + (state.settings.hppValidated ? ' checked' : '') + '><span>Saya sudah memeriksa HPP ini dengan resep dan nota aktual.</span></label>' +
      '<div class="field"><label for="qrisUpload">Gambar QRIS merchant</label><input id="qrisUpload" type="file" accept="image/*"><span class="field-hint">Gunakan QRIS usaha yang benar, bukan gambar contoh.</span></div>' + (state.settings.qrisImage ? '<img class="qr-admin-preview" id="qrisAdminPreview" src="' + state.settings.qrisImage + '" alt="QRIS saat ini">' : '<div class="qr-admin-preview qris-placeholder-admin" id="qrisAdminPreview">QRIS belum diunggah</div>') +
      '</div></div><button class="button button-primary" type="submit">Simpan pengaturan <span>↗</span></button></form>' + renderClosedDateManager() +
      '<section class="photo-manager"><div><h3>Foto halaman publik</h3><p>Foto hanya dapat diganti dari ruang pemilik. Pilih gambar baru pada setiap area yang ingin diubah.</p></div><div class="photo-manager-grid">' +
      photoEntries.map(function (entry) { var src = state.settings.photos[entry[0]]; return '<label class="photo-upload-card"><span>' + escapeHTML(entry[1]) + '</span><img src="' + (src || entry[2]) + '" alt="Pratinjau ' + escapeHTML(entry[1]) + '"><input type="file" accept="image/*" data-photo-key="' + escapeHTML(entry[0]) + '"><small>Maks. gambar akan diperkecil otomatis.</small></label>'; }).join('') +
      '</div></section><p class="local-note">Pengaturan, foto, biaya, pesanan, dan laporan saat ini tersimpan hanya di browser/perangkat ini. Login akun pemilik pada prototipe statis belum menggantikan autentikasi backend.</p>';
  }
  function renderAdmin() {
    if (!requireAdmin()) return;
    var orders = state.orders, waiting = orders.filter(function (order) { return order.paymentStatus === 'Menunggu konfirmasi' && order.status !== 'Dibatalkan'; }).length;
    var totalStock = PRODUCTS.reduce(function (sum, item) { return sum + Number(state.inventory[item.id] || 0); }, 0);
    var monthReport = financeData(monthStart(), todayISO());
    var labels = { orders: 'Pesanan', inventory: 'Stok menu', finance: 'Keuangan', settings: 'Pengaturan' };
    var tabs = '<div class="admin-tabs">' + ['orders', 'inventory', 'finance', 'settings'].map(function (tab) { return '<button class="admin-tab ' + (activeAdminTab === tab ? 'active' : '') + '" data-action="admin-tab" data-tab="' + tab + '">' + labels[tab] + '</button>'; }).join('') + '</div>';
    var body = activeAdminTab === 'orders' ? renderAdminOrders() : activeAdminTab === 'inventory' ? renderAdminInventory() : activeAdminTab === 'finance' ? renderFinance() : renderAdminSettings();
    showModal('<div class="owner-panel-head"><div><div class="modal-eyebrow">TRIO SEMPOL · AKUN PEMILIK</div><h2 class="modal-title" id="modalTitle">Ruang pemilik</h2></div><button class="small-action logout-action" data-action="logout-admin">Keluar</button></div><p class="modal-lead">Pesanan, stok, Open PO, keuangan, dan konten website.</p>' +
      '<div class="admin-summary"><div class="summary-card"><span>Total pesanan</span><strong>' + number(orders.length) + '</strong></div><div class="summary-card"><span>Menunggu verifikasi</span><strong>' + number(waiting) + '</strong></div><div class="summary-card"><span>Total stok</span><strong>' + number(totalStock) + ' cup</strong></div><div class="summary-card"><span>Omzet lunas bulan ini</span><strong>' + money(monthReport.productRevenue) + '</strong></div></div>' + tabs + '<div class="admin-content">' + body + '</div>', true);
  }

  function updateDeliverySlots(date) {
    var select = byId('deliverySlot'); if (!select) return;
    var slots = slotsForDate(date);
    select.innerHTML = slots.map(function (slot) { return '<option value="' + slot[0] + '–' + slot[1] + '">' + slot[0] + '–' + slot[1] + '</option>'; }).join('');
    if (!slots.length) showToast('Tanggal itu tidak memiliki slot Open PO.');
  }
  function recordFinanceEntry(form) {
    var data = new FormData(form), type = String(data.get('type') || 'operational'), date = String(data.get('date') || todayISO());
    var entry = { id: 'FE' + Date.now().toString(36).toUpperCase(), date: date, type: type, note: String(data.get('note') || '').trim() };
    if (type === 'waste' || type === 'free') {
      entry.quantity = Math.max(1, Number(data.get('quantity') || 0)); entry.variant = String(data.get('variant') || PRODUCTS[0].id);
      entry.category = type === 'waste' ? 'Cup terbuang / waste' : 'Cup gratis';
    } else {
      entry.amount = Math.max(0, Number(data.get('amount') || 0)); entry.category = String(data.get('category') || '').trim(); entry.method = String(data.get('method') || 'Tunai');
    }
    state.financeEntries.push(entry); persist(); renderAdmin(); showToast('Catatan keuangan tersimpan.');
  }
  function exportFinanceCsv() {
    if (!requireAdmin()) return;
    var start = reportStart || monthStart(), end = reportEnd || todayISO(), data = financeData(start, end);
    var rows = [
      ['Ringkasan Trio Sempol', 'Nilai'], ['Periode', start + ' sampai ' + end], ['Omzet produk lunas', data.productRevenue], ['Ongkir pelanggan', data.shippingRevenue],
      ['HPP produk terjual', data.hppSold], ['HPP cup gratis/waste', data.wasteHpp], ['Laba kotor', data.grossProfit], ['Biaya kurir aktual', data.courierCost],
      ['Biaya operasional', data.operational], ['Alokasi domain', data.domain], ['Laba/rugi bersih', data.netProfit], ['Saldo kas awal', data.cashStart],
      ['Kas diterima', data.cashIn], ['Belanja stok/aset', data.purchases], ['Penarikan pemilik', data.withdrawals], ['Saldo kas akhir', data.cashEnd], [],
      ['Pesanan lunas', 'Tanggal bayar', 'Kode', 'Nama', 'WhatsApp', 'Kanal', 'Tanggal antar', 'Slot antar', 'Varian dan cup', 'Omzet produk', 'Ongkir pelanggan', 'Kurir aktual', 'Status']
    ];
    data.paid.forEach(function (order) { rows.push([orderDateForCash(order), orderDateForCash(order), order.id, order.customerName, order.phone, order.channel || 'Delivery', order.deliveryDate, order.deliverySlot, (order.items || []).map(function (item) { return item.name + ' x' + item.qty; }).join('; '), order.subtotal, order.shipping, order.courierActualCost == null ? '' : order.courierActualCost, order.status]); });
    rows.push([], ['Catatan input'], ['Jenis', 'Tanggal', 'Kategori/varian', 'Jumlah Rp', 'Jumlah cup', 'Metode', 'Catatan']);
    data.entries.forEach(function (entry) { rows.push([entry.type, entry.date, entry.category || product(entry.variant).name, entry.amount || '', entry.quantity || '', entry.method || '', entry.note || '']); });
    var csv = '\uFEFF' + rows.map(function (row) { return row.map(function (value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = 'trio-sempol-laporan-' + start + '-sampai-' + end + '.csv'; link.click(); URL.revokeObjectURL(url);
  }
  async function storeImage(file, key) {
    if (!file || !file.type.startsWith('image/')) { showToast('Pilih file gambar.'); return; }
    try {
      var maxDimension = key === 'qris' ? 1200 : key.indexOf('sauce-') === 0 ? 900 : 1400;
      var quality = key === 'qris' ? 0.88 : key.indexOf('sauce-') === 0 ? 0.74 : 0.78;
      var dataUrl = await compressImage(file, maxDimension, quality);
      if (key === 'qris') state.settings.qrisImage = dataUrl;
      else state.settings.photos[key] = dataUrl;
      if (persist()) { renderProducts(); renderAdmin(); showToast(key === 'qris' ? 'QRIS diperbarui.' : 'Foto website diperbarui.'); }
    } catch (error) { showToast('Gambar tidak dapat diproses.'); }
  }
  function submitSettings(form) {
    var data = new FormData(form), c = state.settings.costs;
    state.settings.payee = String(data.get('payee') || '').trim();
    state.settings.whatsapp = String(data.get('whatsapp') || '').trim();
    state.settings.price = Math.max(1000, Number(data.get('price') || 10000));
    state.settings.deliveryFee = Math.max(0, Number(data.get('deliveryFee') || 0));
    state.settings.freeFrom = Math.max(1, Number(data.get('freeFrom') || 8));
    state.settings.poCapacity = Math.max(1, Number(data.get('poCapacity') || 50));
    state.settings.initialCash = Math.max(0, Number(data.get('initialCash') || 0));
    state.settings.domainMonthlyCost = Math.max(0, Number(data.get('domainMonthlyCost') || 0));
    state.settings.closedWeekdays = data.getAll('closedWeekdays').map(function (day) { return Number(day); });
    c.sempolPackPrice = Math.max(0, Number(data.get('sempolPackPrice') || 0));
    c.sticksPerPack = Math.max(1, Number(data.get('sticksPerPack') || 1));
    c.sticksPerCup = Math.max(1, Number(data.get('sticksPerCup') || 1));
    c.targetBatch = Math.max(1, Number(data.get('targetBatch') || 1));
    c.otherPerCup = Math.max(0, Number(data.get('otherPerCup') || 0));
    PRODUCTS.forEach(function (item) { c.sauceBatch[item.id] = Math.max(0, Number(data.get('sauce-' + item.id) || 0)); });
    state.settings.hppValidated = Boolean(data.get('hppValidated'));
    persist(); renderProducts(); renderPublicSchedule(); renderAdmin(); showToast('Pengaturan usaha disimpan.');
  }
  function addBlockedDate(form) {
    var date = String(new FormData(form).get('date') || '');
    if (!date || date < todayISO()) { showToast('Pilih tanggal hari ini atau setelahnya.'); return; }
    if (state.settings.closedDates.indexOf(date) < 0) state.settings.closedDates.push(date);
    persist(); renderPublicSchedule(); renderAdmin(); showToast('Tanggal Open PO ditutup.');
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action]'); if (!button) return;
    var action = button.dataset.action;
    if (action === 'qty') {
      var item = product(button.dataset.id), next = Math.max(0, Number(cart[item.id] || 0) + Number(button.dataset.step));
      if (next > Number(state.inventory[item.id] || 0)) { showToast('Stok ' + item.name + ' tidak mencukupi.'); return; }
      cart[item.id] = next; renderProducts();
    } else if (action === 'checkout') openCheckout();
    else if (action === 'close-modal') closeModal();
    else if (action === 'track') openTrack();
    else if (action === 'account') openAccount();
    else if (action === 'account-tab') { activeAccountTab = button.dataset.tab; renderAccount(); }
    else if (action === 'admin-tab') { if (!requireAdmin()) return; activeAdminTab = button.dataset.tab; renderAdmin(); }
    else if (action === 'logout-admin') { sessionStorage.removeItem(OWNER_SESSION_KEY); closeModal(); history.replaceState(null, '', location.pathname + location.search); showToast('Anda sudah keluar dari ruang pemilik.'); }
    else if (action === 'upload-proof') uploadProof();
    else if (action === 'payment') openPayment(button.dataset.id);
    else if (action === 'receipt') openReceipt(button.dataset.id);
    else if (action === 'print-receipt') window.print();
    else if (action === 'export-finance') exportFinanceCsv();
    else if (action === 'print-finance') printFinanceReport();
    else if (action === 'delete-entry') {
      if (!requireAdmin()) return;
      state.financeEntries = state.financeEntries.filter(function (entry) { return entry.id !== button.dataset.id; }); persist(); renderAdmin(); showToast('Catatan dihapus.');
    } else if (action === 'open-date') {
      if (!requireAdmin()) return;
      state.settings.closedDates = state.settings.closedDates.filter(function (date) { return date !== button.dataset.date; }); persist(); renderPublicSchedule(); renderAdmin(); showToast('Open PO pada tanggal tersebut dibuka kembali.');
    } else if (action === 'mark-paid') {
      if (!requireAdmin()) return;
      var paid = state.orders.find(function (order) { return order.id === button.dataset.id; });
      if (paid && paid.status !== 'Dibatalkan') { paid.paymentStatus = 'Lunas terkonfirmasi'; paid.paidAt = new Date().toISOString(); if (paid.status === 'Menunggu pembayaran') paid.status = 'Sedang disiapkan'; paid.statusMessage = 'Pembayaran dikonfirmasi oleh pemilik.'; persist(); renderAdmin(); showToast('Pembayaran ditandai lunas.'); }
    } else if (action === 'set-status') {
      if (!requireAdmin()) return;
      var target = state.orders.find(function (order) { return order.id === button.dataset.id; });
      if (target && !(target.status === 'Dibatalkan' && button.dataset.status !== 'Dibatalkan')) {
        var previous = target.status; target.status = button.dataset.status; target.statusMessage = 'Status diperbarui oleh pemilik.';
        if (target.status === 'Dibatalkan' && previous !== 'Dibatalkan' && !target.stockReleased) { target.items.forEach(function (entry) { state.inventory[entry.id] = Number(state.inventory[entry.id] || 0) + Number(entry.qty || 0); }); target.stockReleased = true; }
        persist(); renderAdmin(); renderProducts(); showToast('Status pesanan diperbarui.');
      }
    } else if (action === 'mobile-menu') document.querySelector('.main-nav').classList.toggle('mobile-open');
  });

  document.addEventListener('submit', function (event) {
    if (event.target.id === 'checkoutForm') { event.preventDefault(); createOrder(event.target); }
    else if (event.target.id === 'trackForm') {
      event.preventDefault(); var code = String(new FormData(event.target).get('trackCode') || '').toUpperCase().trim();
      var order = state.orders.find(function (entry) { return entry.id.toUpperCase() === code; });
      if (order) openReceipt(order.id); else showToast('Kode belum ditemukan di browser ini.');
    } else if (event.target.id === 'accountForm') { event.preventDefault(); handleAccount(event.target); }
    else if (event.target.id === 'ownerSetupForm') { event.preventDefault(); handleOwnerSetup(event.target); }
    else if (event.target.id === 'ownerLoginForm') { event.preventDefault(); handleOwnerLogin(event.target); }
    else if (event.target.id === 'inventoryForm') {
      event.preventDefault(); if (!requireAdmin()) return; var data = new FormData(event.target);
      PRODUCTS.forEach(function (item) { state.inventory[item.id] = Math.max(0, Number(data.get(item.id) || 0)); });
      persist(); renderProducts(); renderAdmin(); showToast('Stok berhasil diperbarui.');
    } else if (event.target.id === 'settingsForm') { event.preventDefault(); if (requireAdmin()) submitSettings(event.target); }
    else if (event.target.id === 'financeEntryForm') { event.preventDefault(); if (requireAdmin()) recordFinanceEntry(event.target); }
    else if (event.target.id === 'reportPeriodForm') {
      event.preventDefault(); if (!requireAdmin()) return; var period = new FormData(event.target);
      reportStart = String(period.get('start') || monthStart()); reportEnd = String(period.get('end') || todayISO());
      if (reportStart > reportEnd) { showToast('Tanggal awal harus sebelum tanggal akhir.'); return; } renderAdmin();
    } else if (event.target.id === 'closeDateForm') { event.preventDefault(); if (requireAdmin()) addBlockedDate(event.target); }
    else if (event.target.classList.contains('courier-form')) {
      event.preventDefault(); if (!requireAdmin()) return; var courier = new FormData(event.target), orderId = event.target.dataset.order;
      var target = state.orders.find(function (order) { return order.id === orderId; });
      if (target) { var input = courier.get('courierActualCost'); target.courierActualCost = input === '' ? null : Math.max(0, Number(input)); persist(); renderAdmin(); showToast('Biaya kurir aktual disimpan.'); }
    }
  });
  document.addEventListener('change', function (event) {
    if (event.target.id === 'deliveryDate') updateDeliverySlots(event.target.value);
    else if (event.target.id === 'entryType') { var target = byId('financeEntryDynamic'); if (target) target.innerHTML = financeEntryFields(event.target.value); }
    else if (event.target.id === 'qrisUpload') { var qris = event.target.files && event.target.files[0]; if (qris) storeImage(qris, 'qris'); }
    else if (event.target.dataset.photoKey) { var photo = event.target.files && event.target.files[0]; if (photo) storeImage(photo, event.target.dataset.photoKey); }
  });
  byId('modalBackdrop').addEventListener('click', function (event) { if (event.target === byId('modalBackdrop')) closeModal(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !byId('modalBackdrop').hidden) closeModal(); });
  window.addEventListener('hashchange', function () { if (location.hash === '#pemilik') openOwner(); });
  try {
    var savedMember = JSON.parse(localStorage.getItem('trio-sempol-member-v1'));
    if (savedMember && savedMember.name && savedMember.phone) currentMember = savedMember;
  } catch (error) {}
  renderProducts(); renderPublicSchedule();
  if (location.hash === '#pemilik') setTimeout(openOwner, 120);
}());
