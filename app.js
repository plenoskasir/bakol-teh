// --- 1. PENGATURAN TOKO UTAMA ---
const WA_NUMBER = "66930712297"; 
const STORE_OPEN_HOUR = 10;   // Buka Jam 10:00 Pagi
const STORE_CLOSE_HOUR = 22;  // Tutup Jam 22:00 Malam

// --- 2. PENGATURAN ONGKOS KIRIM & PROMO ---
const MIN_ORDER_DELIVERY = 20000; 
const FREE_SHIPPING_MIN_ORDER = 50000; 
const FREE_RADIUS_KM = 2; 
const SHIPPING_RATE_PER_KM = 2000; 

// --- 3. URL GOOGLE APPS SCRIPT (BACKUP KE GOOGLE SHEETS) ---
const GOOGLE_SCRIPT_URL = ""; 

// --- 4. PENGATURAN DAFTAR TOPPING ---
const AVAILABLE_TOPPINGS = [
    { name: "Tanpa Topping", price: 0 },
    { name: "Boba", price: 3000 },
    { name: "Cheese Foam", price: 5000 },
    { name: "Jelly", price: 2000 },
    { name: "Oreo Crumb", price: 2500 }
];

const KEMASAN_PRICES = {
    "Reguler": 0,    
    "Large": 3000,   
    "Botol": 4000    
};

// --- DATABASE PRODUK ---
const categories = ["Semua", "Teh"]; 
const products = [
    { id: 1, name: "Thai cup", price: 7000, category: "Teh", image: "https://ibb.co.com/whKgfntb" },
    { id: 2, name: "Thai botol", price: 10000, category: "Teh", image: "https://ibb.co.com/VcRH5yzG" }
];

// --- STATE APLIKASI ---
let cart = JSON.parse(localStorage.getItem('bakolteh_cart_v2')) || [];
let deliveryMethod = 'delivery'; 
let isCartOpen = false;
let activeCategory = "Semua";
let isStoreOpen = true;
let tempSelectedProduct = null;

// --- FUNGSI FORMAT RUPIAH ---
const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

function checkStoreHours() {
    const currentHour = new Date().getHours();
    isStoreOpen = (currentHour >= STORE_OPEN_HOUR && currentHour < STORE_CLOSE_HOUR);
    
    const badge = document.getElementById('storeStatusBadge');
    const closedMsg = document.getElementById('storeClosedMsg');
    const schedType = document.getElementById('orderScheduleType');
    const warnCheckout = document.getElementById('closedWarningCheckout');

    if (isStoreOpen) {
        badge.innerText = `Buka (Tutup jam ${STORE_CLOSE_HOUR}:00)`;
        badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded mt-1 inline-block bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
        closedMsg.classList.add('hidden');
        warnCheckout.classList.add('hidden');
        
        if(schedType && schedType.querySelector('option[value="now"]').disabled) {
            schedType.querySelector('option[value="now"]').disabled = false;
            schedType.value = "now";
            toggleScheduleTime();
        }
    } else {
        badge.innerText = `Tutup (Bisa Pesan Untuk Nanti/Besok)`;
        badge.className = "text-[10px] font-semibold px-2 py-0.5 rounded mt-1 inline-block bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
        closedMsg.classList.add('hidden'); 
        warnCheckout.classList.remove('hidden');
        
        if(schedType) {
            schedType.value = "later";
            schedType.querySelector('option[value="now"]').disabled = true;
            toggleScheduleTime();
        }
    }
}

function toggleScheduleTime() {
    const type = document.getElementById('orderScheduleType').value;
    const timeInput = document.getElementById('orderScheduleTime');
    if(type === 'later') {
        timeInput.classList.remove('hidden');
    } else {
        timeInput.classList.add('hidden');
    }
}

function toggleSizeOptions() {
    const kemasan = document.querySelector('input[name="packaging"]:checked').value;
    const sizeContainer = document.getElementById('sizeContainer');
    if (kemasan === 'Cup') {
        sizeContainer.classList.remove('hidden');
        sizeContainer.classList.add('block');
    } else {
        sizeContainer.classList.add('hidden');
        sizeContainer.classList.remove('block');
    }
    updateModalPrice();
}

function updateModalPrice() {
    if(!tempSelectedProduct) return;
    
    let extra = 0;
    const kemasan = document.querySelector('input[name="packaging"]:checked').value;
    if(kemasan === 'Cup') {
        const size = document.querySelector('input[name="size"]:checked').value;
        extra += KEMASAN_PRICES[size];
    } else {
        extra += KEMASAN_PRICES["Botol"];
    }

    const toppingEl = document.querySelector('input[name="topping"]:checked');
    if(toppingEl) extra += parseInt(toppingEl.dataset.price);

    document.getElementById('optPrice').innerText = formatRp(tempSelectedProduct.price + extra);
}

function renderCategories() {
    const container = document.getElementById('categoryFilter');
    container.innerHTML = categories.map(cat => `
        <button onclick="setCategory('${cat}')" class="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${activeCategory === cat ? 'bg-brand-500 text-white border-brand-500' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}">
            ${cat}
        </button>
    `).join('');
}

function setCategory(cat) {
    activeCategory = cat;
    renderCategories();
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';
    
    const filtered = activeCategory === "Semua" ? products : products.filter(p => p.category === activeCategory);

    filtered.forEach(p => {
        grid.innerHTML += `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                <div class="relative pt-[100%] bg-gray-200 dark:bg-gray-700">
                    <img src="${p.image}" class="absolute top-0 left-0 w-full h-full object-cover" loading="lazy">
                </div>
                <div class="p-4 flex flex-col flex-1 justify-between">
                    <div>
                        <h3 class="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base leading-tight mb-1">${p.name}</h3>
                        <p class="text-brand-500 font-bold text-sm sm:text-base mb-3">${formatRp(p.price)}</p>
                    </div>
                    <button onclick="openOptionsModal(${p.id})" class="w-full bg-gray-100 dark:bg-gray-700 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 text-gray-800 dark:text-gray-200 font-medium py-2 rounded-xl text-sm transition">
                        + Keranjang
                    </button>
                </div>
            </div>
        `;
    });
}

function openOptionsModal(id) {
    tempSelectedProduct = products.find(p => p.id === id);
    document.getElementById('optTitle').innerText = tempSelectedProduct.name;
    
    const toppingContainer = document.getElementById('toppingContainer');
    toppingContainer.innerHTML = AVAILABLE_TOPPINGS.map((top, index) => `
        <label class="flex items-center justify-between p-3 border rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition" onchange="updateModalPrice()">
            <div class="flex items-center gap-2">
                <input type="radio" name="topping" value="${top.name}" data-price="${top.price}" class="text-brand-500 focus:ring-brand-500" ${index === 0 ? 'checked' : ''}>
                <span class="text-sm">${top.name}</span>
            </div>
            ${top.price > 0 ? `<span class="text-sm text-gray-500">+${formatRp(top.price)}</span>` : ''}
        </label>
    `).join('');

    const modal = document.getElementById('optionsModal');
    const panel = document.getElementById('optionsPanel');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => panel.classList.add('modal-enter-active'));
    
    document.querySelector('input[name="sugar"][value="Normal"]').checked = true;
    document.querySelector('input[name="ice"][value="Normal"]').checked = true;
    document.querySelector('input[name="packaging"][value="Cup"]').checked = true;
    document.querySelector('input[name="size"][value="Reguler"]').checked = true;
    
    toggleSizeOptions();
}

function closeOptionsModal() {
    const modal = document.getElementById('optionsModal');
    const panel = document.getElementById('optionsPanel');
    panel.classList.remove('modal-enter-active');
    setTimeout(() => modal.classList.add('hidden'), 200);
    
    setTimeout(() => {
        tempSelectedProduct = null;
    }, 300);
}

function confirmAddToCart() {
    if (!tempSelectedProduct) return;

    const sugar = document.querySelector('input[name="sugar"]:checked').value;
    const ice = document.querySelector('input[name="ice"]:checked').value;
    const toppingEl = document.querySelector('input[name="topping"]:checked');
    const topping = toppingEl.value;
    const toppingPrice = parseInt(toppingEl.dataset.price);

    const packaging = document.querySelector('input[name="packaging"]:checked').value;
    let size = "Botol";
    let packagingPrice = KEMASAN_PRICES["Botol"];
    
    if (packaging === "Cup") {
        size = document.querySelector('input[name="size"]:checked').value;
        packagingPrice = KEMASAN_PRICES[size];
    }

    const cartItemId = `${tempSelectedProduct.id}_${packaging}_${size}_${sugar}_${ice}_${topping}`;
    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        cart.push({
            cartItemId: cartItemId,
            id: tempSelectedProduct.id,
            name: tempSelectedProduct.name,
            basePrice: tempSelectedProduct.price,
            toppingPrice: toppingPrice,
            packagingPrice: packagingPrice,
            finalPrice: tempSelectedProduct.price + toppingPrice + packagingPrice,
            qty: 1,
            options: { sugar, ice, topping, packaging, size }
        });
    }

    const productName = tempSelectedProduct.name;
    saveCart();
    updateCartUI();
    closeOptionsModal();
    showToast(`${productName} masuk keranjang!`);
}

function updateQty(cartItemId, change) {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (!item) return;

    item.qty += change;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.cartItemId !== cartItemId);
    }
    saveCart();
    updateCartUI();
}

function saveCart() { localStorage.setItem('bakolteh_cart_v2', JSON.stringify(cart)); }

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    badge.innerText = totalItems;
    totalItems > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');

    const content = document.getElementById('cartContent');
    if (cart.length === 0) {
        content.innerHTML = `<p class="text-center text-gray-400 py-6">Keranjang kosong</p>`;
    } else {
        content.innerHTML = cart.map(item => `
            <div class="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-medium text-sm">${item.name}</h4>
                    <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <button onclick="updateQty('${item.cartItemId}', -1)" class="px-2 py-0.5 text-gray-600 dark:text-gray-300">-</button>
                        <span class="px-2 text-xs font-medium">${item.qty}</span>
                        <button onclick="updateQty('${item.cartItemId}', 1)" class="px-2 py-0.5 text-gray-600 dark:text-gray-300">+</button>
                    </div>
                </div>
                <p class="text-[11px] text-gray-500 mb-1 leading-tight">
                    Kemasan: ${item.options.packaging === 'Cup' ? 'Cup ' + item.options.size : 'Botol'}<br>
                    Gula: ${item.options.sugar}, Es: ${item.options.ice}<br>
                    ${item.options.topping !== 'Tanpa Topping' ? `Topping: ${item.options.topping}` : ''}
                </p>
                <p class="text-brand-500 font-semibold text-sm mt-1">${formatRp(item.finalPrice * item.qty)}</p>
            </div>
        `).join('');
    }
    calculateTotal();
}

function setDeliveryMethod(method) {
    deliveryMethod = method;
    document.getElementById('btnDelivery').className = `flex-1 py-2 text-sm font-medium rounded-lg transition ${method === 'delivery' ? 'shadow bg-white dark:bg-gray-800 text-brand-500' : 'text-gray-500 dark:text-gray-300 hover:text-gray-800'}`;
    document.getElementById('btnPickup').className = `flex-1 py-2 text-sm font-medium rounded-lg transition ${method === 'pickup' ? 'shadow bg-white dark:bg-gray-800 text-brand-500' : 'text-gray-500 dark:text-gray-300 hover:text-gray-800'}`;
    
    document.getElementById('deliveryFields').classList.toggle('hidden', method !== 'delivery');
    document.getElementById('pickupFields').classList.toggle('hidden', method !== 'pickup');
    calculateTotal();
}

function calculateTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.finalPrice * item.qty), 0);
    let shippingCost = 0;
    let isFreeShipping = false;

    const warningEl = document.getElementById('deliveryWarning');
    const btnCheckout = document.getElementById('btnCheckout');
    const badgePromo = document.getElementById('badgePromoOngkir');

    if (deliveryMethod === 'delivery' && subtotal > 0 && subtotal < MIN_ORDER_DELIVERY) {
        warningEl.classList.remove('hidden');
        btnCheckout.disabled = true;
        btnCheckout.classList.add('opacity-50');
    } else {
        warningEl.classList.add('hidden');
        btnCheckout.disabled = false;
        btnCheckout.classList.remove('opacity-50');
    }

    if (deliveryMethod === 'delivery' && subtotal > 0) {
        if (subtotal >= FREE_SHIPPING_MIN_ORDER) {
            shippingCost = 0;
            isFreeShipping = true;
            badgePromo.classList.remove('hidden');
        } else {
            badgePromo.classList.add('hidden');
            const distance = parseFloat(document.getElementById('custDistance').value) || 0;
            if (distance > FREE_RADIUS_KM) {
                shippingCost = Math.ceil(distance - FREE_RADIUS_KM) * SHIPPING_RATE_PER_KM;
            }
        }
    } else {
        badgePromo.classList.add('hidden');
    }

    document.getElementById('summarySubtotal').innerText = formatRp(subtotal);
    document.getElementById('summaryShipping').innerText = isFreeShipping ? "Rp 0" : formatRp(shippingCost);
    document.getElementById('summaryTotal').innerText = formatRp(subtotal + shippingCost);
}

async function processCheckout() {
    if (cart.length === 0) return showToast("Keranjang kosong!");
    
    const name = document.getElementById('custName').value.trim();
    if (!name) return showToast("Mohon isi Nama Anda");

    const schedType = document.getElementById('orderScheduleType').value;
    let orderTimeText = "Secepatnya (Sekarang)";
    if (schedType === 'later') {
        const t = document.getElementById('orderScheduleTime').value;
        if (!t) return showToast("Mohon isi Tanggal & Waktu pemesanan");
        orderTimeText = "Sesuai Jadwal: " + new Date(t).toLocaleString('id-ID');
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.finalPrice * item.qty), 0);
    let shippingCost = 0;
    let address = "-", notes = "-", distance = 0;

    if (deliveryMethod === 'delivery') {
        address = document.getElementById('custAddress').value.trim();
        notes = document.getElementById('custNotes').value.trim();
        distance = parseFloat(document.getElementById('custDistance').value) || 0;
        
        if (!address) return showToast("Mohon isi Alamat");
        if (subtotal < MIN_ORDER_DELIVERY) return showToast(`Minimal belanja delivery ${formatRp(MIN_ORDER_DELIVERY)}`);

        if (subtotal < FREE_SHIPPING_MIN_ORDER && distance > FREE_RADIUS_KM) {
            shippingCost = Math.ceil(distance - FREE_RADIUS_KM) * SHIPPING_RATE_PER_KM;
        }
    }

    const total = subtotal + shippingCost;
    let pesananTeks = "";
    cart.forEach(item => {
        const opt = item.options;
        const kemasanTxt = opt.packaging === 'Cup' ? `Cup ${opt.size}` : `Botol`;
        const note = `[${kemasanTxt}, Gula:${opt.sugar}, Es:${opt.ice}, Top:${opt.topping}]`;
        pesananTeks += `- ${item.name} ${note} (${item.qty}x) = ${formatRp(item.finalPrice * item.qty)}\n`;
    });

    const orderData = {
        waktu: new Date().toLocaleString('id-ID'),
        jadwal: orderTimeText,
        nama: name,
        metode: deliveryMethod === 'delivery' ? 'Dikirim' : 'Ambil Sendiri',
        alamat: address,
        jarak_km: distance,
        catatan: notes,
        pesanan: pesananTeks,
        subtotal: subtotal,
        ongkir: shippingCost,
        total_bayar: total
    };

    const btn = document.getElementById('btnCheckout');
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = `Memproses...`;
    btn.disabled = true;

    if (GOOGLE_SCRIPT_URL !== "") {
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
        } catch (e) {
            console.log("Backup ke sheet gagal, lanjut ke WA", e);
        }
    }

    let waMsg = `Halo BakolTeh, saya mau pesan:\n\n${pesananTeks}`;
    waMsg += `\n*Subtotal:* ${formatRp(subtotal)}`;
    waMsg += `\n\n*Informasi Pelanggan:*`;
    waMsg += `\nNama: ${name}`;
    waMsg += `\nWaktu: ${orderTimeText}`;
    
    if (deliveryMethod === 'delivery') {
        waMsg += `\nMetode: Dikirim (Delivery)`;
        waMsg += `\nAlamat: ${address}`;
        if (notes) waMsg += `\nCatatan: ${notes}`;
        waMsg += `\nJarak: ${distance} KM`;
        if(shippingCost === 0) waMsg += `\n\n*Ongkir: GRATIS (Promo)*`;
        else waMsg += `\n\n*Ongkir:* ${formatRp(shippingCost)}`;
    } else {
        waMsg += `\nMetode: Ambil di Tempat (Pickup)`;
    }
    
    waMsg += `\n*TOTAL BAYAR:* ${formatRp(total)}\n\nTerima kasih!`;

    cart = [];
    saveCart();
    updateCartUI();
    
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let waUrl = "";
    
    if (isMobile) {
        waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    } else {
        waUrl = `https://web.whatsapp.com/send?phone=${WA_NUMBER}&text=${encodeURIComponent(waMsg)}`;
    }
    
    window.location.href = waUrl;
}

function toggleCart() {
    const modal = document.getElementById('cartModal');
    const panel = document.getElementById('cartPanel');
    isCartOpen = !isCartOpen;
    if (isCartOpen) {
        modal.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-y-full', 'sm:translate-x-full'), 10);
    } else {
        panel.classList.add('translate-y-full', 'sm:translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function showToast(msg) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = "bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium toast-enter";
    t.innerText = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-enter-active'));
    setTimeout(() => {
        t.classList.remove('toast-enter-active');
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

function initTheme() {
    const t = document.getElementById('themeToggle');
    const h = document.documentElement.classList;
    if (localStorage.getItem('bakolteh_theme') === 'light') h.remove('dark');
    t.addEventListener('click', () => {
        h.toggle('dark');
        localStorage.setItem('bakolteh_theme', h.contains('dark') ? 'dark' : 'light');
    });
}

window.onload = () => {
    initTheme();
    checkStoreHours(); 
    renderCategories();
    renderProducts();
    updateCartUI();
    setInterval(checkStoreHours, 60000); 
};
