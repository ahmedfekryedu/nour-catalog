
// ===== Promo system (auto + stable per current catalog/page) =====
let pagePromo = {};

function promoHash(input){
  let h = 0;
  const s = String(input || "");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function buildPagePromo(slice, currentPage){
  const items = (slice || []).map(it => ({
    id: String(it.msg_id ?? it.fp ?? it.code ?? ""),
    code: String(it.code ?? ""),
    price: Number(it.price || 0)
  })).filter(it => it.id);

  if (!items.length) return {};

  const ranked = [...items].sort((a, b) => {
    const ha = promoHash(`${currentPage}|${a.id}|${a.code}|${a.price}`);
    const hb = promoHash(`${currentPage}|${b.id}|${b.code}|${b.price}`);
    return ha - hb;
  });

  const picked = ranked.slice(0, Math.min(6, ranked.length));
  const result = {};

  picked.forEach((it, idx) => {
    if (idx < 2) {
      result[it.id] = { type: "best" };
    } else if (idx < 4) {
      result[it.id] = { type: "orders", value: [2, 5][idx - 2] };
    } else {
      result[it.id] = { type: "stock", value: [3, 4][idx - 4] };
    }
  });

  return result;
}

const TG_CHANNEL_LINK = "https://t.me/+ZyR4F-gUMfthYjBk"; // رابط القناة
// روابط الشات (واتساب وتليجرام) موجودة بالفعل داخل HTML لضمان السرعة

const DEFAULT_PAGE_SIZE = 72;

/* =========================
   Cart Core (localStorage)
   ========================= */
const WA_NUMBER = "201151447782";
const CART_KEY = "noure_cart_v1";

function cartLoad(){
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch(e){ return []; }
}
function cartSave(items){
  try { localStorage.setItem(CART_KEY, JSON.stringify(items || [])); } catch(e){}
}
function cartCount(){
  return cartLoad().reduce((sum,it)=> sum + (it.qty||0), 0);
}
function handleOrderIntent(url, message = "تم تجهيز طلبك — سيتم تحويلك إلى واتساب"){
  if (!url) return;
  showToast(message);
  setTimeout(() => {
    window.open(url, "_blank", "noopener");
  }, 320);
}
function cartFmtPrice(p){
  const n = Number(p || 0);
  return `${n.toLocaleString()} ج.م`;
}
function cartIdOf(it){
  return String(it.msg_id ?? it.fp ?? it.code ?? "");
}
function cartGetQty(id){
  const cart = cartLoad();
  const f = cart.find(x => x.id === String(id));
  return f ? (f.qty || 0) : 0;
}
function cartAdd(item){
  const id = cartIdOf(item);
  if (!id) return { ok:false, msg:"لا يوجد ID للمنتج" };

  const cart = cartLoad();
  const i = cart.findIndex(x => x.id === id);

  if (i >= 0) {
    cart[i].qty = (cart[i].qty || 1) + 1;
  } else {
    cart.push({
      id,
      code: item.code || "",
      price: Number(item.price || 0),
      thumb: item.thumb || (item.images?.[0] || ""),
      desc: (item.description || "").trim(),
      qty: 1
    });
  }

  cartSave(cart);
  cartRefreshUI();
  return { ok:true };
}

function cartChangeQty(id, delta){
  const cart = cartLoad();
  const i = cart.findIndex(x => x.id === id);
  if (i < 0) return;
  cart[i].qty = Math.max(1, (cart[i].qty || 1) + delta);
  cartSave(cart);
  cartRefreshUI();
}
function cartRemove(id){
  const cart = cartLoad().filter(x => x.id !== id);
  cartSave(cart);
  cartRefreshUI();
}

function cartBuildWhatsAppText(){
  const cart = cartLoad();
  let total = 0;

  const lines = cart.map((it, idx) => {
    const lineTotal = (Number(it.price||0) * Number(it.qty||1));
    total += lineTotal;
    const code = it.code ? `#${it.code}` : "(بدون كود)";
    return `${idx+1}) ${code} × ${it.qty} = ${lineTotal.toLocaleString()} ج.م`;
  });

  const msg =
`مرحباً، أريد تأكيد طلب من كتالوج نور العيون:

${lines.join("\n")}

الإجمالي: ${total.toLocaleString()} ج.م`;

  return msg;
}

function cartWhatsAppUrl(){
  const text = cartBuildWhatsAppText();
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

/* =========================
   Cart Drawer UI
   ========================= */
function cartEl(id){ return document.getElementById(id); }

function showBrandConfirm(message, onConfirm){
  let modal = document.getElementById("brandConfirmModal");
  if (!modal){
    modal = document.createElement("div");
    modal.id = "brandConfirmModal";
    modal.className = "brand-confirm";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="brand-confirm__backdrop" data-confirm-close></div>
      <div class="brand-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="brandConfirmTitle">
        <div class="brand-confirm__icon"><i class="fas fa-trash-alt"></i></div>
        <div class="brand-confirm__title" id="brandConfirmTitle">تأكيد الحذف</div>
        <div class="brand-confirm__text"></div>
        <div class="brand-confirm__actions">
          <button type="button" class="btn btn--ghost" data-confirm-cancel>إلغاء</button>
          <button type="button" class="btn btn--primary" data-confirm-ok>حذف الجميع</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => {
      modal.hidden = true;
      modal.classList.remove("open");
    };
    modal.addEventListener("click", (e) => {
      if (e.target.matches("[data-confirm-close],[data-confirm-cancel]")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) close();
    });
    modal.querySelector("[data-confirm-ok]").addEventListener("click", () => {
      const handler = modal._onConfirm;
      close();
      if (typeof handler === "function") handler();
    });
  }

  modal.querySelector(".brand-confirm__text").textContent = message;
  modal._onConfirm = onConfirm;
  modal.hidden = false;
  modal.classList.add("open");
}

function cartOpen(){
  const d = cartEl("cartDrawer");
  const o = cartEl("cartOverlay");
  if (o){ o.hidden = false; }
  if (d){ d.classList.add("open"); d.setAttribute("aria-hidden","false"); }
  const b = cartEl("cartBtn");
  if (b) b.setAttribute("aria-expanded","true");
}
function cartClose(){
  const d = cartEl("cartDrawer");
  const o = cartEl("cartOverlay");
  if (o){ o.hidden = true; }
  if (d){ d.classList.remove("open"); d.setAttribute("aria-hidden","true"); }
  const b = cartEl("cartBtn");
  if (b) b.setAttribute("aria-expanded","false");
}

function cartBindUI(){
  const b = cartEl("cartBtn");
  const c = cartEl("cartClose");
  const o = cartEl("cartOverlay");

  if (b) b.addEventListener("click", (e)=>{ e.preventDefault(); cartOpen(); });
  if (c) c.addEventListener("click", (e)=>{ e.preventDefault(); cartClose(); });
  if (o) o.addEventListener("click", cartClose);
  const order = cartEl("cartOrder");
  if (order) order.addEventListener("click", (e) => {
    if (cartCount() <= 0) return;
    e.preventDefault();
    handleOrderIntent(order.dataset.orderUrl || order.href, "تم تجهيز طلبك — سيتم تحويلك إلى واتساب");
  });
  const clear = cartEl("cartClear");
  if (clear) clear.addEventListener("click", ()=>{
    showBrandConfirm("مسح كل المنتجات من السلة؟", () => {
      cartSave([]);
      cartRefreshUI();
    });
  });
}

function cartRefreshUI(){
  const badge = cartEl("cartBadge");
  const itemsWrap = cartEl("cartItems");
  const totalEl = cartEl("cartTotal");
  const orderEl = cartEl("cartOrder");
  const countLineEl = cartEl("cartCountLine");

  const cart = cartLoad();
  const count = cartCount();

  if (badge){
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  }

  if (itemsWrap){
    if (cart.length === 0){
      itemsWrap.innerHTML = `<div style="padding:14px;color:#6b7280;font-weight:700">السلة فاضية حالياً.</div>`;
    } else {
      // ✅ التعديل هنا: إضافة كلمة "كود" و "السعر" وخانة المواصفات
      itemsWrap.innerHTML = cart.map(it => {
        const code = it.code ? `#${it.code}` : "—";
        const desc = (it.desc || "").trim();
        // تقصير الوصف ليظهر بشكل لائق في السلة
        const shortDesc = desc ? `مواصفات: ${desc.slice(0, 50)}...` : "مواصفات: —";
        
        return `
          <div class="cart-item">
            <img src="${it.thumb || ""}" alt="${code}">
            <div class="cart-item__meta">
              <div class="cart-item__title">كود: ${code}</div>
              <div class="cart-item__sub">
                <div class="cart-item__price">السعر: ${cartFmtPrice(it.price)}</div>
                <button class="btn btn--ghost" style="height:34px;padding:0 10px" data-cart-remove="${it.id}">
                  حذف
                </button>
              </div>
              <div class="cart-item__spec" style="font-size:11px; color:#666; margin-top:4px;">${shortDesc}</div>
              <div class="qty">
                <button type="button" data-cart-dec="${it.id}">-</button>
                <span>${it.qty || 1}</span>
                <button type="button" data-cart-inc="${it.id}">+</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  let total = 0;
  cart.forEach(it => total += Number(it.price||0) * Number(it.qty||1));
  if (totalEl) totalEl.textContent = cartFmtPrice(total);
  if (countLineEl) countLineEl.textContent = String(count);

  if (orderEl){
    if (cart.length === 0){
      orderEl.style.pointerEvents = "none";
      orderEl.style.opacity = "0.6";
      orderEl.href = `https://wa.me/${WA_NUMBER}`;
      orderEl.dataset.orderUrl = `https://wa.me/${WA_NUMBER}`;
    } else {
      orderEl.style.pointerEvents = "";
      orderEl.style.opacity = "";
      orderEl.href = cartWhatsAppUrl();
      orderEl.dataset.orderUrl = cartWhatsAppUrl();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cartBindUI();
  cartRefreshUI();

  // Delegation لأزرار السلة داخل الـ drawer
  document.addEventListener("click", (e) => {
    const t = e.target;

    const rem = t.closest?.("[data-cart-remove]")?.getAttribute("data-cart-remove");
    if (rem){ cartRemove(rem); return; }

    const inc = t.closest?.("[data-cart-inc]")?.getAttribute("data-cart-inc");
    if (inc){ cartChangeQty(inc, +1); return; }

    const dec = t.closest?.("[data-cart-dec]")?.getAttribute("data-cart-dec");
    if (dec){ cartChangeQty(dec, -1); return; }
  });
});

let all = [];
let view = [];
let page = 1;
let firstOpenRenderDone = false;

// Elements
const elGrid = document.getElementById("grid");
const elQ = document.getElementById("q");
const searchAnimatedHint = document.getElementById("searchAnimatedHint");
const searchAnimatedText = document.getElementById("searchAnimatedText");

const searchWords = [
  "كود المنتج",
  "قطن مستورد",
  "ستان مستورد",
  "قطيفة مستورد",
  "بلور مستورد",
  "تركي",
  "One size",
  "Big size"
];

let searchWordIndex = 0;
let searchCharIndex = 0;
let searchIsDeleting = false;
let searchTypingTimer = null;

function runSearchTypingEffect() {
  if (!searchAnimatedHint || !searchAnimatedText || !elQ) return;

  // لو المستخدم كتب حاجة، نخفي الأنيميشن
  if (elQ.value.trim() !== "") {
    searchAnimatedHint.classList.add("is-hidden");
    searchTypingTimer = setTimeout(runSearchTypingEffect, 300);
    return;
  }

  searchAnimatedHint.classList.remove("is-hidden");

  const currentWord = searchWords[searchWordIndex];

  if (!searchIsDeleting) {
    searchCharIndex++;
    searchAnimatedText.textContent = currentWord.slice(0, searchCharIndex);

    if (searchCharIndex === currentWord.length) {
      searchIsDeleting = true;
      searchTypingTimer = setTimeout(runSearchTypingEffect, 1200); // وقفة للقراءة
      return;
    }

    searchTypingTimer = setTimeout(runSearchTypingEffect, 90); // سرعة الكتابة
  } else {
    searchCharIndex--;
    searchAnimatedText.textContent = currentWord.slice(0, searchCharIndex);

    if (searchCharIndex === 0) {
      searchIsDeleting = false;
      searchWordIndex = (searchWordIndex + 1) % searchWords.length;
      searchTypingTimer = setTimeout(runSearchTypingEffect, 250);
      return;
    }

    searchTypingTimer = setTimeout(runSearchTypingEffect, 45); // سرعة المسح
  }
}
const elSort = document.getElementById("sort");
const elBand = document.getElementById("priceBand");
const elCount = document.getElementById("count");
const elPageMeta = document.getElementById("pageMeta");
let pageJumpChoices = null;
const elPages = document.getElementById("pages");
let sortChoices = null;
let bandChoices = null;
let pageSize = DEFAULT_PAGE_SIZE;
// --- Install Banner عناصر ---
const installBanner = document.getElementById("installBanner");
const installBtn = document.getElementById("installBtn");
const installClose = document.getElementById("installClose");
const installBannerHint = document.getElementById("installBannerHint");

let deferredPrompt = null;

function isIos(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandalone(){
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}


function showInstallNotice(title, message){
  let modal = document.getElementById("installNoticeModal");
  if (!modal){
    modal = document.createElement("div");
    modal.id = "installNoticeModal";
    modal.className = "install-notice";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="install-notice__backdrop" data-install-notice-close></div>
      <div class="install-notice__dialog" role="dialog" aria-modal="true" aria-labelledby="installNoticeTitle">
        <div class="install-notice__icon"><i class="fas fa-download"></i></div>
        <div class="install-notice__title" id="installNoticeTitle"></div>
        <div class="install-notice__text"></div>
        <div class="install-notice__actions">
          <button type="button" class="btn btn--primary" data-install-notice-ok>تمام</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => {
      modal.hidden = true;
      modal.classList.remove("open");
    };
    modal.addEventListener("click", (e) => {
      if (e.target.matches("[data-install-notice-close],[data-install-notice-ok]")) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  }
  modal.querySelector(".install-notice__title").textContent = title || "تثبيت التطبيق";
  modal.querySelector(".install-notice__text").textContent = message || "";
  modal.hidden = false;
  modal.classList.add("open");
}

function showInstallBanner(mode){
  if (!installBanner) return;
  if (isInStandalone()) return; // لو متثبت خلاص
  if (localStorage.getItem("appInstalled") === "1") return;
  // قفل لو المستخدم قفله قبل كده
  if (localStorage.getItem("installBannerClosed") === "1") return;

  // نص iOS مختلف
  if (mode === "ios") {
    installBtn.textContent = "الخطوات";
    installBannerHint.textContent = "على iPhone: Share ثم Add to Home Screen";
  } else {
    installBtn.textContent = "تثبيت";
    installBannerHint.textContent = "ثبّته علشان يفتح أسرع من غير متصفح ✨";
  }

  installBanner.hidden = false;
}

function hideInstallBanner(){
  if (!installBanner) return;

  // ✅ إخفاء أكيد
  installBanner.hidden = true;
  installBanner.style.display = "none";

  // ✅ تخزين آمن بدون ما يوقف الكود لو حصل Error
  try {
    localStorage.setItem("installBannerClosed", "1");
  } catch (e) {}
}


// ✅ لو اتفتح في وضع متثبت: خزّن الحالة واقفل البانر نهائيًا
document.addEventListener("DOMContentLoaded", () => {
  if (isInStandalone()) {
    try { localStorage.setItem("appInstalled", "1"); } catch(e) {}
    hideInstallBanner();
  }
});


// Android/Chrome: اصطياد حدث التثبيت
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner("android");
});

window.addEventListener("appinstalled", () => {
  try { localStorage.setItem("appInstalled", "1"); } catch(e) {}
  hideInstallBanner();
});

// زر التثبيت/الخطوات
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    // iOS: مفيش Prompt، هنفتح تعليمات فقط
if (isIos()) {
  showInstallNotice("تثبيت على iPhone", "افتحي مشاركة ثم اختاري إضافة إلى الشاشة الرئيسية.");
  hideInstallBanner(); // ✅ يخفي البانر بعد التعليمات
  return;
}

    if (!deferredPrompt) {
  showInstallNotice("التثبيت غير متاح الآن", "جربي فتح الموقع من Chrome أو Safari من المتصفح العادي، ولو كان التطبيق مثبتًا بالفعل فلن يظهر زر التثبيت داخله.");
  return;
}
deferredPrompt.prompt();
const choice = await deferredPrompt.userChoice;

if (choice && choice.outcome === "accepted") {
  localStorage.setItem("appInstalled", "1"); // ✅ اتثبت
}

deferredPrompt = null;
hideInstallBanner();

  });
}

if (installClose) {
  installClose.addEventListener("click", hideInstallBanner);
}

// لو iOS Safari ومش Standalone: اعرض البانر فورًا
document.addEventListener("DOMContentLoaded", () => {
  if (isIos() && !isInStandalone()) {
    showInstallBanner("ios");
  }
});

// --- 1. إعداد رابط القناة في الهيدر ---
document.getElementById("tgBtn").href = TG_CHANNEL_LINK;

document.addEventListener('DOMContentLoaded', () => {
  const choicesBottom = {
    searchEnabled: false,
    itemSelectText: '',
    shouldSort: false,
    position: 'bottom',   // ✅ للأحدث/الأقدم والسعر
  };

  sortChoices = new Choices(elSort, choicesBottom);
  bandChoices = new Choices(elBand, choicesBottom);
  elSort.addEventListener('change', () => applyFilters());
  elBand.addEventListener('change', () => applyFilters());
});

// --- 3. الوظائف المنطقية ---

function fmtPrice(p){
  if (p === null || p === undefined || p === "") return "";
  return `${p.toLocaleString()} ج.م`;
}

function normalizeArabic(str=""){
  return String(str)
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s#]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchScore(item, query){
  const q = normalizeArabic(query);
  if (!q) return 0;

  const code = normalizeArabic(String(item.code || ""));
  const title = normalizeArabic(item.title || "");
  const desc = normalizeArabic(item.description || "");
  const price = normalizeArabic(String(item.price || ""));
  const allText = `${code} ${title} ${desc} ${price}`.trim();
  const tokens = q.split(" ").filter(Boolean);

  let score = 0;
  if (code && (q === code || q === `#${code}`)) score += 150;
  if (code && code.startsWith(q.replace(/^#/, ""))) score += 110;
  else if (code && code.includes(q.replace(/^#/, ""))) score += 80;

  if (title.includes(q)) score += 60;
  if (desc.includes(q)) score += 35;
  if (allText.includes(q)) score += 20;

  if (tokens.length) {
    const matched = tokens.filter(tok => allText.includes(tok)).length;
    if (matched === tokens.length) score += 25;
    else score += matched * 5;
  }
  return score;
}

function priceBandOk(p, band){
  if (band === "all") return true;
  if (typeof p !== "number") return false;
  if (band === "lt300") return p < 300;
  if (band === "300_500") return p >= 300 && p <= 500;
  if (band === "500_800") return p > 500 && p <= 800;
  if (band === "gt800") return p > 800;
  return true;
}
function shuffleArray(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function applyFilters(resetPage = true){
  const q = (elQ.value || "").trim();
  const band = elBand.value;

  view = all
    .map(it => ({ ...it, _searchScore: q ? getSearchScore(it, q) : 0 }))
    .filter(it => {
      if (!priceBandOk(it.price, band)) return false;
      if (!q) return true;
      return it._searchScore > 0;
    });

  const sort = elSort.value;
  view.sort((a, b) => {
    if (q && (b._searchScore || 0) !== (a._searchScore || 0)) {
      return (b._searchScore || 0) - (a._searchScore || 0);
    }
    if (sort === "price_asc") return (a.price||1e18) - (b.price||1e18);
    if (sort === "price_desc") return (b.price||-1) - (a.price||-1);
    return (b.ts||0) - (a.ts||0);
  });

  if (resetPage) page = 1;
  render();
}


function card(it){
  const cid = cartIdOf(it);
  const q = cartGetQty(cid);

  const thumb = it.thumb || "";
  const desc = (it.description || "").trim();
  const code = it.code ? `#${it.code}` : "";

  const id = String(it.msg_id ?? it.fp ?? it.code ?? "");
  const promo = pagePromo[id] || null;

  const waOrder = `https://wa.me/201151447782?text=${encodeURIComponent('مرحبا، أريد الاستفسار عن الموديل: ' + (it.code || ''))}`;
  const detailsUrl = `product.html?id=${encodeURIComponent(id)}`;

  const wrap = document.createElement("div");
  wrap.className = "card";

  const ribbon = promo && promo.type==="best"
    ? `<span class="top-ribbon">الأكثر طلبًا</span>`
    : "";

  const badge =
    promo && promo.type==="stock"
      ? `<div class="card__signals"><span class="micro-badge micro-badge--stock">متبقي ${promo.value} قطع</span></div>`
      : promo && promo.type==="orders"
      ? `<div class="card__signals"><span class="micro-badge micro-badge--orders">تم طلبه ${promo.value} مرات</span></div>`
      : "";

  wrap.innerHTML = `
    <a href="${detailsUrl}" class="thumb">
      ${ribbon}
      ${
        thumb
          ? `<img src="${thumb}" loading="lazy" alt="${code}" />`
          : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ccc"><i class="fas fa-image fa-2x"></i></div>'
      }
    </a>

    <div class="card__body">
      <div class="meta-row">
        ${code ? `<span class="code-badge">${code}</span>` : '<span></span>'}
        <span class="price">${fmtPrice(it.price)}</span>
      </div>

      ${badge}

      <div class="desc" title="${desc}">${desc || "لا يوجد وصف"}</div>

      <div class="card__actions actions-stack">
        <button class="btn btn--primary" type="button" data-order-url="${waOrder}">
          <i class="fab fa-whatsapp"></i> أطلبي الآن
        </button>

<button class="btn btn--cart" type="button"
  data-addcart="${encodeURIComponent(cid)}">
  <i class="fas fa-cart-plus"></i> إضافة إلى السلة${q ? ` (${q})` : ""}
</button>
      </div>
    </div>
  `;

  return wrap;
}


function render(){
  const total = view.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, pages);
try {
  sessionStorage.setItem("lastPage", String(page));
} catch(e) {}

  const start = (page - 1) * pageSize;
  const end = Math.min(total, start + pageSize);
  let slice = view.slice(start, end);
  pagePromo = buildPagePromo(slice, page);
// ✅ تقليب (تغيير ترتيب) الصفحة الأولى فقط في الوضع الافتراضي
const isDefaultMode =
  !(elQ.value || "").trim() &&
  elBand.value === "all" &&
  elSort.value === "newest";

const shouldShuffleFirstPage =
  firstOpenRenderDone &&
  page === 1 &&
  isDefaultMode;

if (shouldShuffleFirstPage) {
  slice = [...slice];
  shuffleArray(slice); // خلط الصفحة الأولى فقط بعد أول فتح
}

  elGrid.innerHTML = "";
  if (!total) {
    elGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon"><i class="fas fa-search"></i></div>
        <h3>لا توجد نتائج مطابقة</h3>
        <p>جرّبي كود المنتج أو خففي الفلاتر واعملي بحث مرة ثانية.</p>
        <button class="btn btn--ghost" type="button" id="clearFiltersBtn"><i class="fas fa-rotate-right"></i> مسح البحث والفلاتر</button>
      </div>`;
  } else {
    slice.forEach(it => elGrid.appendChild(card(it)));
  }

  elCount.textContent = `عدد المنتجات: ${total}`;
  elPageMeta.textContent = `صفحة ${page} من ${pages}`;



  if (elPages) {
    const pageOptions = Array.from({ length: pages }, (_, i) => `
      <option value="${i + 1}"${page === i + 1 ? ' selected' : ''}>الصفحة ${i + 1} من ${pages}</option>
    `).join("");

    elPages.innerHTML = `
      <div class="page-jump-wrap">
        <select id="pageJumpSelect" class="custom-select" aria-label="اختيار الصفحة">${pageOptions}</select>
      </div>`;

    const jumpSelectEl = document.getElementById("pageJumpSelect");
    if (jumpSelectEl) {
      jumpSelectEl.addEventListener("change", () => {
        page = Math.max(1, parseInt(jumpSelectEl.value || "1", 10));
        render();
      });
    }
    if (jumpSelectEl && typeof Choices !== "undefined") {
      if (pageJumpChoices) {
        pageJumpChoices.destroy();
        pageJumpChoices = null;
      }
      pageJumpChoices = new Choices(jumpSelectEl, {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
        position: 'top'
      });
      pageJumpChoices.containerOuter.element.classList.add("page-jump-choices");
      pageJumpChoices.setChoiceByValue(String(page));
      jumpSelectEl.addEventListener("choice", () => {
        page = Math.max(1, parseInt(jumpSelectEl.value || "1", 10));
        render();
      });
    }
  }

  document.getElementById("prev").disabled = total <= 0 || page <= 1;
  document.getElementById("next").disabled = total <= 0 || page >= pages;
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      elQ.value = "";
      elSort.value = "newest";
      elBand.value = "all";
      if (sortChoices) sortChoices.setChoiceByValue('newest');
      if (bandChoices) bandChoices.setChoiceByValue('all');
      page = 1;
      applyFilters(false);
    });
  }
const url = new URL(window.location.href);
url.searchParams.set("page", String(page));
history.replaceState(null, "", url.toString());

  if (slice.length > 0) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  firstOpenRenderDone = true;
}

document.getElementById("prev").addEventListener("click", () => { 
  page = Math.max(1, page - 1); 
  render(); 
});

document.getElementById("next").addEventListener("click", () => { 
  page = page + 1; 
  render(); 
});

document.addEventListener("change", (e) => {
  const jumpSelect = e.target.closest("#pageJumpSelect");
  if (!jumpSelect) return;
  page = Math.max(1, parseInt(jumpSelect.value || "1", 10));
  render();
});

if (elQ && searchAnimatedHint) {
  elQ.addEventListener("focus", () => {
    if (elQ.value.trim() !== "") {
      searchAnimatedHint.classList.add("is-hidden");
    }
  });

  elQ.addEventListener("blur", () => {
    if (elQ.value.trim() === "") {
      searchAnimatedHint.classList.remove("is-hidden");
    }
  });

  elQ.addEventListener("input", () => {
    if (elQ.value.trim() !== "") {
      searchAnimatedHint.classList.add("is-hidden");
    } else {
      searchAnimatedHint.classList.remove("is-hidden");
    }

    applyFilters();
  });
}
// Add to cart from cards (event delegation)
document.addEventListener("click", (e) => {
  const openLink = e.target.closest?.("[data-open-product]");
  if (openLink){
    const itemId = decodeURIComponent(openLink.getAttribute("data-open-product") || "");
    const item = all.find(x => String(x.msg_id ?? x.fp ?? x.code ?? "") === String(itemId));
    if (item){
      trackEvent("select_item", {
        item_id: getItemIdValue(item),
        item_name: item.title || `#${item.code || ''}`,
        item_category: "catalog_card",
        value: Number(item.price || 0)
      });
    }
  }

  const orderBtn = e.target.closest?.("[data-order-url]");
  if (orderBtn){
    e.preventDefault();
    const url = orderBtn.getAttribute("data-order-url") || orderBtn.href;
    trackEvent("begin_checkout", {
      currency: "EGP",
      value: 0,
      item_id: orderBtn.getAttribute("data-product-code") || ""
    });
    handleOrderIntent(url);
    return;
  }

  const btn = e.target.closest?.("[data-addcart]");
  if (!btn) return;

  const id = decodeURIComponent(btn.getAttribute("data-addcart") || "");
  if (!id) return;

  const item = all.find(x => String(x.msg_id ?? x.fp ?? x.code ?? "") === String(id));
  if (!item) return;

  const r = cartAdd(item);
  if (r.ok) {
    const newQ = cartGetQty(id);
    btn.innerHTML = `<i class="fas fa-plus"></i> إضافة إلى السلة${newQ ? ` (${newQ})` : ""}`;
    showToast("تمت إضافة المنتج إلى السلة");
  }
});


function renderSkeleton(count = pageSize){
  elGrid.innerHTML = "";
  for(let i=0; i<count; i++){
    const d = document.createElement("div");
    d.className = "card sk-card";
    d.innerHTML = `
      <div class="thumb sk"></div>
      <div class="card__body">
        <div class="meta-row">
          <span class="code-badge sk-line" style="width:70px"></span>
          <span class="price sk-line" style="width:90px"></span>
        </div>
        <div class="desc sk-line" style="width:100%"></div>
        <div class="desc sk-line" style="width:75%"></div>
        <div class="card__actions">
          <div class="btn sk-btn"></div>
          <div class="btn sk-btn"></div>
        </div>
      </div>
    `;
    elGrid.appendChild(d);
  }
}

function showNetToast(msg){
  let t = document.getElementById("netToast");
  if (!t){
    t = document.createElement("div");
    t.id = "netToast";
    t.style.cssText = `
      position: fixed; left: 12px; right: 12px; bottom: 12px;
      max-width: 700px; margin: 0 auto;
      background: rgba(17,24,39,.95); color: #fff;
      padding: 12px 14px; border-radius: 14px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; z-index: 9999; box-shadow: 0 10px 25px rgba(0,0,0,.25);
      font-family: inherit;
    `;
    t.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:10px;height:10px;border-radius:999px;background:#ef4444;display:inline-block"></span>
        <span id="netToastMsg" style="font-size:14px"></span>
      </div>
      <button id="netToastRetry" type="button"
        style="border:0;background:#fff;color:#111827;padding:8px 10px;border-radius:10px;cursor:pointer;font-weight:600">
        إعادة المحاولة
      </button>
    `;
    document.body.appendChild(t);

    document.getElementById("netToastRetry").addEventListener("click", () => {
      hideNetToast();
      boot(); // يعيد التحميل
    });
  }

  const m = document.getElementById("netToastMsg");
  if (m) m.textContent = msg || "في مشكلة في الاتصال بالإنترنت.";
  t.style.display = "flex";
}

function hideNetToast(){
  const t = document.getElementById("netToast");
  if (t) t.style.display = "none";
}


function showToast(message){
  let t = document.getElementById("brandToast");
  if (!t){
    t = document.createElement("div");
    t.id = "brandToast";
    t.className = "brand-toast";
    document.body.appendChild(t);
  }
  t.innerHTML = `<i class="fas fa-check-circle"></i><span>${message}</span>`;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 1800);
}


function trackEvent(name, params = {}){
  try {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  } catch (e) {}
}

function buildPromoMeta(items = []){
  const priced = (items || []).filter(it => typeof it.price === "number" && !Number.isNaN(it.price));
  const sorted = [...priced].sort((a,b) => (a.price || 0) - (b.price || 0));

  const featuredIds = new Set();
  const orderedMap = new Map();
  const stockMap = new Map();

  const featuredPool = [...sorted.slice(0, 3), ...sorted.slice(-3)];
  featuredPool.forEach((it, idx) => {
    const id = getItemIdValue(it);
    if (!id || featuredIds.has(id)) return;
    featuredIds.add(id);
    orderedMap.set(id, idx % 2 === 0 ? 5 : 2);
  });

  const stockPool = [...sorted.slice(3, 7), ...sorted.slice(-7, -3)];
  const stockCycle = [4, 3, 5, 2];
  stockPool.forEach((it, idx) => {
    const id = getItemIdValue(it);
    if (!id || stockMap.has(id)) return;
    stockMap.set(id, stockCycle[idx % stockCycle.length]);
  });

  return { featuredIds, orderedMap, stockMap };
}

function getCardPromo(item){
  const id = getItemIdValue(item);
  const promo = window.__promoMeta || { featuredIds:new Set(), orderedMap:new Map(), stockMap:new Map() };
  return {
    featured: promo.featuredIds.has(id),
    ordered: promo.orderedMap.get(id) || 0,
    stock: promo.stockMap.get(id) || 0
  };
}

function getItemIdValue(item){
  return String(item.msg_id ?? item.fp ?? item.code ?? "");
}



async function boot(){
  try {
        renderSkeleton();
    const res = await fetch("catalog.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Failed");
    all = await res.json();
all = all.map(it => ({
  ...it,
  price: typeof it.price === "string" ? parseFloat(it.price) : it.price,
  ts: it.ts || (it.created_at ? Date.parse(it.created_at) : 0)
}));

all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    window.__promoMeta = buildPromoMeta(all);
    const url = new URL(window.location.href);
const p = parseInt(url.searchParams.get("page") || "1", 10);
if (!isNaN(p) && p > 0) page = p;
try {
  const saved = parseInt(sessionStorage.getItem("lastPage") || "1", 10);
  if (!isNaN(saved) && saved > 0) page = saved;
} catch(e) {}
    applyFilters(false);
} catch(e) {
  // خليك على الـ skeleton الرمادي
  renderSkeleton();

  // لو المشكلة نت فعلاً
  if (!navigator.onLine) {
    showNetToast("مفيش إنترنت دلوقتي. شغّل النت وجرب تاني.");
  } else {
    // لو نت شغال بس الملف/السيرفر فيه مشكلة
    showNetToast("في مشكلة في تحميل المنتجات. جرّب تاني بعد شوية.");
  }
}
}

boot();

window.addEventListener("online", () => {
  hideNetToast();
  boot();
});

// --- Dropdown (مراسلة) Toggle داخل الصفحة ---
const msgBtn = document.getElementById("msgBtn");
const msgMenu = document.getElementById("msgMenu");

function closeMsgMenu(){
  if (!msgMenu) return;
  msgMenu.classList.remove("open");
  if (msgBtn) msgBtn.setAttribute("aria-expanded", "false");
}

function toggleMsgMenu(){
  if (!msgMenu) return;
  const isOpen = msgMenu.classList.toggle("open");
  if (msgBtn) msgBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

// فتح/قفل بالضغط
if (msgBtn && msgMenu) {
  msgBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMsgMenu();
  });

  // منع القفل عند الضغط داخل القائمة
  msgMenu.addEventListener("click", (e) => e.stopPropagation());

  // قفل عند الضغط خارجها
  document.addEventListener("click", () => closeMsgMenu());

  // قفل عند الضغط ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMsgMenu();
  });
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const logo = document.getElementById("logoHome");
  if (!logo) return;

  logo.addEventListener("click", (e) => {
    e.preventDefault();

    // رجّع للهوم
    page = 1;

    // امسح حفظ الصفحة عشان الريفريش بعد كده يبقى 1
    try { sessionStorage.removeItem("lastPage"); } catch(e) {}

    // حدّث الرابط
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", "1");
      history.replaceState(null, "", url.toString());
    } catch(e) {}

    // اعرض
    render();
  });
});
const tourSteps = [
  {
    element: "#q",
    title: "البحث السريع 🔍",
    text: "تقدري تبحثي هنا بالكود أو بنوع الموديل اللي بتدوري عليه."
  },
  {
    element: ".card [data-addcart]", // هيختار أول زرار إضافة للسلة يلاقيه
    title: "أضيفي لسلّتك 🛍️",
    text: "اضغطي هنا لإضافة الموديل للسلة وتجميع طلباتك."
  },
  {
    element: "#cartBtn",
    title: "راجعي طلباتك 🛒",
    text: "من هنا تقدري تشوفي كل اللي اخترتيه وتعدلي الكميات."
  }
];

let currentStep = 0;

function startTour() {
  if (localStorage.getItem("tour_completed")) return;
  
  // إنشاء طبقة التعتيم
  const overlay = document.createElement("div");
  overlay.id = "tourOverlay";
  overlay.className = "onboarding-overlay";
  overlay.style.display = "block";
  document.body.appendChild(overlay);

  showStep();
}

function showStep() {
  const step = tourSteps[currentStep];
  const target = document.querySelector(step.element);

  if (!target) { finishTour(); return; }

  // تميز العنصر
  document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
  target.classList.add("tour-highlight");
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  let tooltip = document.getElementById("tourTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "tourTooltip";
    tooltip.className = "onboarding-tooltip";
    document.body.appendChild(tooltip);
  }

  // حسابات الموقع بدقة
  const rect = target.getBoundingClientRect();
  const tooltipWidth = 260;
  const screenWidth = window.innerWidth;

  // 1. حساب الموقع الأفقي (Left) لضمان عدم الخروج من الشاشة
  let leftPos = rect.left + (rect.width / 2) - (tooltipWidth / 2);
  leftPos = Math.max(10, Math.min(leftPos, screenWidth - tooltipWidth - 10)); // يضمن مسافة 10px من الجوانب

  // 2. حساب الموقع الرأي (Top/Bottom) بناءً على مكان العنصر
  let topPos;
  if (rect.top > 250) {
    // لو العنصر تحت، اظهر المربع فوقه
    topPos = rect.top - 160; 
  } else {
    // لو العنصر فوق (زي السلة)، اظهر المربع تحته
    topPos = rect.bottom + 15;
  }

  tooltip.style.left = `${leftPos}px`;
  tooltip.style.top = `${topPos}px`;

  tooltip.innerHTML = `
    <h4>${step.title}</h4>
    <p>${step.text}</p>
    <button class="onboarding-btn">${currentStep === tourSteps.length - 1 ? "ابدئي التسوق ✨" : "التالي"}</button>
  `;

  tooltip.querySelector("button").onclick = () => {
    currentStep++;
    if (currentStep < tourSteps.length) showStep(); else finishTour();
  };
}

function finishTour() {
  document.getElementById("tourOverlay")?.remove();
  document.getElementById("tourTooltip")?.remove();
  document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
  localStorage.setItem("tour_completed", "true");
}

// تشغيل الجولة بعد تحميل المنتجات
window.addEventListener("load", () => {
  setTimeout(startTour, 2000); // تأخير بسيط لضمان تحميل المنتجات
});
runSearchTypingEffect();