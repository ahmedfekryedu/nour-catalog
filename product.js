const TG_CHANNEL_LINK = "https://t.me/+ZyR4F-gUMfthYjBk";

function fmtPrice(p){
  if (p === null || p === undefined || p === "") return "";
  return `${Number(p).toLocaleString()} ج.م`;
}

function qs(name){
  return new URL(window.location.href).searchParams.get(name);
}

function el(id){ return document.getElementById(id); }

function initSimilarJump(sectionEl){
  const btn = el('similarJumpBtn');
  if (!btn || !sectionEl) return;

  const updateVisibility = () => {
    if (sectionEl.hidden) {
      btn.hidden = true;
      return;
    }
    const rect = sectionEl.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    const isVisible = rect.top < viewportH - 80 && rect.bottom > 120;
    btn.hidden = isVisible;
  };

  if (!btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
  }

  updateVisibility();
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

function handleOrderIntent(url, message = "تم تجهيز طلبك — سيتم تحويلك إلى واتساب"){
  if (!url) return;
  showToast(message);
  setTimeout(() => {
    window.open(url, "_blank", "noopener");
  }, 320);
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

function buildSimilarItems(all, current){
  const currentText = normalizeArabic(`${current.title || ''} ${current.description || ''}`);
  const currentTokens = currentText.split(' ').filter(tok => tok.length > 2);
  return all
    .filter(it => String(it.msg_id ?? it.fp ?? it.code ?? '') !== String(current.msg_id ?? current.fp ?? current.code ?? ''))
    .map(it => {
      const text = normalizeArabic(`${it.title || ''} ${it.description || ''}`);
      let score = 0;
      if (typeof current.price === 'number' && typeof it.price === 'number') {
        const diff = Math.abs(current.price - it.price);
        score += Math.max(0, 40 - Math.min(40, diff / 20));
      }
      if (it.code && current.code && String(it.code).slice(0,2) === String(current.code).slice(0,2)) score += 10;
      score += currentTokens.filter(tok => text.includes(tok)).length * 6;
      score += it.images?.length ? 4 : 0;
      return { item: it, score };
    })
    .sort((a,b) => b.score - a.score || (b.item.ts||0) - (a.item.ts||0))
    .slice(0, 4)
    .map(x => x.item);
}

function similarCard(it){
  const id = encodeURIComponent(it.msg_id ?? it.fp ?? it.code ?? '');
  const thumb = it.thumb || (it.images && it.images[0]) || '';
  const title = (it.title || `منتج #${it.code || ''}`).trim();
  const desc = (it.description || 'قطعة مختارة من كتالوج نور العيون').replace(/\s+/g, ' ').trim();
  return `
    <article class="similar-card">
      <a class="similar-card__thumb" href="product.html?id=${id}" aria-label="${title}">
        ${thumb ? `<img src="${thumb}" alt="${title}" loading="lazy">` : `<div class="similar-card__empty"><i class="fas fa-image"></i></div>`}
      </a>
      <div class="similar-card__body">
        <div class="similar-card__meta">
          <span class="code-badge">#${it.code || '—'}</span>
          <span class="price">${fmtPrice(it.price)}</span>
        </div>
        <h3 class="similar-card__title">${title}</h3>
        <p class="similar-card__desc">${desc.slice(0, 88)}</p>
        <a class="btn btn--ghost btn--small similar-card__cta" href="product.html?id=${id}"><i class="fas fa-arrow-left"></i> عرض المنتج</a>
      </div>
    </article>`;
}


function createProductLightbox(images = []){
  if (!images.length) return null;
  let root = document.getElementById("productLightbox");
  if (root) root.remove();

  root = document.createElement("div");
  root.id = "productLightbox";
  root.className = "product-lightbox";
  root.hidden = true;
  root.innerHTML = `
    <div class="product-lightbox__dialog">
      <button class="product-lightbox__close" type="button" aria-label="إغلاق"><i class="fas fa-times"></i></button>
      <button class="product-lightbox__nav product-lightbox__nav--prev" type="button" aria-label="السابق"><i class="fas fa-chevron-right"></i></button>
      <button class="product-lightbox__nav product-lightbox__nav--next" type="button" aria-label="التالي"><i class="fas fa-chevron-left"></i></button>
      <div class="product-lightbox__viewport">
        <div class="product-lightbox__track">
          <div class="product-lightbox__slide">
            <img id="productLightboxImg" src="" alt="صورة المنتج المكبرة" loading="eager">
          </div>
        </div>
      </div>
      <div class="product-lightbox__counter"></div>
    </div>`;
  document.body.appendChild(root);

  const img = root.querySelector("#productLightboxImg");
  const counter = root.querySelector(".product-lightbox__counter");
  const prevBtn = root.querySelector(".product-lightbox__nav--prev");
  const nextBtn = root.querySelector(".product-lightbox__nav--next");

  let current = 0;
  const total = images.length;

  function render(){
    if (!img || !total) return;
    current = ((current % total) + total) % total;
    img.src = images[current];
    img.alt = `صورة المنتج ${current + 1}`;
    if (counter) counter.textContent = `${current + 1} / ${total}`;
    if (prevBtn) prevBtn.disabled = total <= 1;
    if (nextBtn) nextBtn.disabled = total <= 1;
  }

  function openAt(index = 0){
    current = index;
    render();
    root.hidden = false;
    root.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close(){
    root.classList.remove("open");
    root.hidden = true;
    document.body.style.overflow = "";
  }

  function go(step){
    if (total <= 1) return;
    current = current + step;
    render();
  }

  root.addEventListener("click", (e) => {
    if (e.target === root || e.target.closest(".product-lightbox__close")) close();
    if (e.target.closest(".product-lightbox__nav--prev")) go(-1);
    if (e.target.closest(".product-lightbox__nav--next")) go(1);
  });

  document.addEventListener("keydown", (e) => {
    if (root.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") go(1);
    if (e.key === "ArrowRight") go(-1);
  });

  let x0 = null;
  root.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 35){
      if (dx > 0) go(-1);
      else go(1);
    }
    x0 = null;
  }, { passive: true });

  return { openAt, close };
}

/* =========================
   Install Banner (Product)
   ========================= */
const installBanner = el("installBanner");
const installBtn = el("installBtn");
const installClose = el("installClose");
const installBannerHint = el("installBannerHint");

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
  if (isInStandalone()) return;
  if (localStorage.getItem("appInstalled") === "1") return;
  if (localStorage.getItem("installBannerClosed") === "1") return;

  if (mode === "ios") {
    if (installBtn) installBtn.textContent = "الخطوات";
    if (installBannerHint) installBannerHint.textContent = "على iPhone: Share ثم Add to Home Screen";
  } else {
    if (installBtn) installBtn.textContent = "تثبيت";
    if (installBannerHint) installBannerHint.textContent = "ثبّته علشان يفتح أسرع من غير متصفح ✨";
  }

  installBanner.hidden = false;
  installBanner.style.display = "flex";
}

function hideInstallBanner(){
  if (!installBanner) return;
  installBanner.hidden = true;
  installBanner.style.display = "none";
  try { localStorage.setItem("installBannerClosed", "1"); } catch(e) {}
}

// لو اتفتح كتطبيق متثبت: اقفل البانر نهائيًا
document.addEventListener("DOMContentLoaded", () => {
  if (isInStandalone()) {
    try { localStorage.setItem("appInstalled", "1"); } catch(e) {}
    hideInstallBanner();
  }
});

// Android/Chrome: beforeinstallprompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner("android");
});

// بعد التثبيت فعليًا
window.addEventListener("appinstalled", () => {
  try { localStorage.setItem("appInstalled", "1"); } catch(e) {}
  hideInstallBanner();
});

// زر التثبيت/الخطوات
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (isIos()) {
      showInstallNotice("تثبيت على iPhone", "افتحي مشاركة ثم اختاري إضافة إلى الشاشة الرئيسية.");
      hideInstallBanner();
      return;
    }

    if (!deferredPrompt) {
      showInstallNotice("التثبيت غير متاح الآن", "جربي فتح الموقع من Chrome أو Safari من المتصفح العادي، ولو كان التطبيق مثبتًا بالفعل فلن يظهر زر التثبيت داخله.");
      return;
    }

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice && choice.outcome === "accepted") {
      try { localStorage.setItem("appInstalled", "1"); } catch(e) {}
    }

    deferredPrompt = null;
    hideInstallBanner();
  });
}

if (installClose) {
  installClose.addEventListener("click", hideInstallBanner);
}

// iOS Safari: اعرض البانر فورًا (لو مش standalone)
document.addEventListener("DOMContentLoaded", () => {
  if (isIos() && !isInStandalone()) showInstallBanner("ios");
});

/* =========================
   Cart Core (localStorage) — Product Page
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

  if (i >= 0) cart[i].qty = (cart[i].qty || 1) + 1;
  else {
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
    const desc = (it.desc || "").trim();
    const shortDesc = desc ? `\n   مواصفات: ${desc.slice(0, 60)}${desc.length>60?"...":""}` : "";

    return `${idx+1}) كود: ${code}\n   سعر: ${lineTotal.toLocaleString()} ج.م\n   عدد: ${it.qty || 1}${shortDesc}`;
  });

  return `مرحباً، أريد تأكيد طلب من كتالوج نور العيون:\n\n${lines.join("\n\n")}\n\nالإجمالي: ${total.toLocaleString()} ج.م`;
}
function cartWhatsAppUrl(){
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(cartBuildWhatsAppText())}`;
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
  if (o) o.hidden = false;
  if (d){ d.classList.add("open"); d.setAttribute("aria-hidden","false"); }
  const b = cartEl("cartBtn");
  if (b) b.setAttribute("aria-expanded","true");
}
function cartClose(){
  const d = cartEl("cartDrawer");
  const o = cartEl("cartOverlay");
  if (o) o.hidden = true;
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
      itemsWrap.innerHTML = cart.map(it => {
        const code = it.code ? `#${it.code}` : "";
        const desc = (it.desc || "").trim();
        const shortDesc = desc ? `مواصفات: ${desc.slice(0, 60)}${desc.length>60?"...":""}` : "مواصفات: —";
        return `
          <div class="cart-item">
            <img src="${it.thumb || ""}" alt="${code}">
            <div class="cart-item__meta">
              <div class="cart-item__title">كود: ${code || "—"}</div>
              <div class="cart-item__sub">
                <div class="cart-item__price">سعر: ${cartFmtPrice(it.price)}</div>
                <button class="btn btn--ghost" style="height:34px;padding:0 10px" data-cart-remove="${it.id}">حذف</button>
              </div>
              <div class="cart-item__spec">${shortDesc}</div>
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

/* =========================
   Slider
   ========================= */
function buildSlider(images){
  const wrap = document.createElement("div");
  wrap.className = "pslider";

  const track = document.createElement("div");
  track.className = "pslider__track";

  (images || []).forEach((src, idx) => {
    const s = document.createElement("div");
    s.className = "pslide";
    s.innerHTML = `<img src="${src}" alt="img-${idx}" loading="lazy">`;
    track.appendChild(s);
  });

  const prev = document.createElement("button");
  prev.className = "pslider__btn pslider__btn--prev";
  prev.type = "button";
  prev.innerHTML = `<i class="fas fa-chevron-right"></i>`;

  const next = document.createElement("button");
  next.className = "pslider__btn pslider__btn--next";
  next.type = "button";
  next.innerHTML = `<i class="fas fa-chevron-left"></i>`;

  const dots = document.createElement("div");
  dots.className = "pslider__dots";
  (images || []).forEach((_, idx) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "pslider__dot";
    dot.setAttribute("aria-label", `صورة ${idx+1}`);
    dot.addEventListener("click", () => go(idx));
    dots.appendChild(dot);
  });

  wrap.appendChild(track);
  wrap.appendChild(prev);
  wrap.appendChild(next);
  wrap.appendChild(dots);

  let i = 0;
  const max = Math.max(0, (images?.length || 1) - 1);

  function go(n){
    i = Math.min(max, Math.max(0, n));
    track.style.transform = `translateX(-${i * 100}%)`;
    [...dots.children].forEach((d, idx) => d.classList.toggle("is-active", idx === i));
    prev.disabled = i <= 0;
    next.disabled = i >= max;
  }

  prev.addEventListener("click", () => go(i - 1));
  next.addEventListener("click", () => go(i + 1));

  let x0 = null;
  wrap.addEventListener("touchstart", (e)=>{ x0 = e.touches[0].clientX; }, {passive:true});
  wrap.addEventListener("touchend", (e)=>{
    if (x0 === null) return;
    const x1 = e.changedTouches[0].clientX;
    const dx = x1 - x0;
    if (Math.abs(dx) > 35){
      if (dx > 0) go(i - 1); else go(i + 1);
    }
    x0 = null;
  }, {passive:true});
// ✅ Thumbs + Gallery wrapper
const gallery = document.createElement("div");
gallery.className = "pgallery";

const thumbs = document.createElement("div");
thumbs.className = "pthumbs";

const thumbEls = [];

(images || []).forEach((src, idx) => {
  const th = document.createElement("div");
  th.className = "pthumb";
  th.innerHTML = `<img src="${src}" alt="thumb-${idx}" loading="lazy">`;
  th.addEventListener("click", () => go(idx));
  thumbs.appendChild(th);
  thumbEls.push(th);
});

function setActiveThumb(){
  thumbEls.forEach((x, k) => x.classList.toggle("is-active", k === i));
}

// ✅ لفّ go عشان كل تغيير صورة يحدّث الـ active
const oldGo = go;
go = function(n){
  oldGo(n);
  setActiveThumb();
};

gallery.appendChild(thumbs);
gallery.appendChild(wrap);

// ✅ بداية العرض
go(0);

return gallery;
}

async function boot(){
  // ✅ اللوجو يرجّع للرئيسية (صفحة 1)
  const logo = el("logoHome");
  if (logo) {
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = "./?page=1";
    });
  }

  // ✅ زر قناة تيليجرام في الهيدر
  const tgBtn = el("tgBtn");
  if (tgBtn) tgBtn.href = TG_CHANNEL_LINK;

  const id = qs("id");
  if (!id){
    location.href = "./?page=1";
    return;
  }

  let all = [];
  try {
    const res = await fetch("catalog.json", { cache: "no-store" });
    if(!res.ok) throw new Error("catalog.json not ok");
    all = await res.json();
  } catch (e) {
    location.href = "./?page=1";
    return;
  }

  const item = all.find(x => String(x.msg_id ?? x.fp ?? x.code ?? "") === String(id));
  if (!item){
    location.href = "./?page=1";
    return;
  }

const media = el("pMedia");
const codeEl = el("pCode");
const priceEl = el("pPrice");
const descEl = el("pDesc");
const orderEl = el("pOrder");
const tgEl = el("pTG");
const addCartEl = el("pAddCart"); // ✅ التعريف الأول

// ✅ إيفنت إضافة إلى السلة
if (addCartEl) {
  addCartEl.addEventListener("click", () => {
    const r = cartAdd(item);
    const q = cartGetQty(cartIdOf(item));
    addCartEl.textContent = r.ok ? "اتضافت ✅" : "موجودة";
    if (r.ok) showToast("تمت إضافة المنتج إلى السلة");
    setTimeout(() => {
      addCartEl.innerHTML = `<i class="fas fa-plus"></i> إضافة إلى السلة${q ? ` (${q})` : ""}`;
    }, 900);
  });
}

  const images = (item.images && item.images.length)
    ? item.images
    : (item.thumb ? [item.thumb] : []);

  let lightboxApi = null;
  if (media) {
    media.innerHTML = "";
    const gallery = buildSlider(images);
    media.appendChild(gallery);
    lightboxApi = createProductLightbox(images);
    if (lightboxApi) {
      gallery.addEventListener("click", (e) => {
        if (e.target.closest(".pslider__btn, .pslider__dot, .pthumb")) return;
        const slideEl = e.target.closest(".pslide");
        const slides = [...gallery.querySelectorAll(".pslide")];
        const index = Math.max(0, slides.indexOf(slideEl));
        lightboxApi.openAt(index);
      });
    }
  }

// ✅ الكود والسعر بنفس المقاس واللون الذهبي والخط العريض (بدون كلمة كود)
  if (codeEl) {
    codeEl.innerHTML = item.code ? `<span class="bold-gold">#${item.code}</span>` : "";
  }
  if (priceEl) {
    priceEl.innerHTML = `<span class="bold-gold">${fmtPrice(item.price)}</span>`;
  }

  if (descEl) {
    const specs = item.description || "لا توجد مواصفات إضافية.";
    // عرض الوصف وتنسيق الشحن بشكل ملموم جداً (كما هو مطلوب)
    descEl.innerHTML = `
      <div class="desc-content">
        <p style="color:var(--primary); font-weight:800; margin:0 0 5px 0;">✨ Nouré L’Oyon | بصمةٌ لا تُنسى 👰✨</p>
        <p style="white-space:pre-wrap; margin:0;">${specs}</p>
      </div>
      <div class="shipping-mini">
        <p><i class="fas fa-truck"></i> الاستلام: محطة الرمل او ميامي مجاناً</p>
        <p><i class="fas fa-info-circle"></i> الشحن: لجميع الإسكندرية (بعربون)</p>
        <p style="color:var(--primary); font-weight:bold; margin-top:4px;">عروض خاصة عند طلب أكثر من قطعة!</p>
      </div>
    `;
  }

  const waOrder = `https://wa.me/201151447782?text=${encodeURIComponent('مرحبا، أريد الاستفسار عن الموديل: ' + (item.code || ''))}`;
  if (orderEl) {
    orderEl.href = waOrder;
    orderEl.addEventListener("click", (e) => {
      e.preventDefault();
      handleOrderIntent(waOrder, "تم تجهيز طلبك — سيتم تحويلك إلى واتساب");
    });
  }
  if (tgEl) tgEl.href = item.tg_post_link || TG_CHANNEL_LINK;

  const similarSection = el('similarSection');
  const similarGrid = el('similarGrid');
  const similarJumpBtn = el('similarJumpBtn');
  if (similarSection && similarGrid) {
    const similarItems = buildSimilarItems(all, item).filter(it => String(it.msg_id ?? it.fp ?? it.code ?? '') !== String(item.msg_id ?? item.fp ?? item.code ?? ''));
    if (similarItems.length) {
      similarGrid.innerHTML = similarItems.map(similarCard).join('');
      similarSection.hidden = false;
      initSimilarJump(similarSection);
    } else {
      similarGrid.innerHTML = '';
      similarSection.hidden = true;
      if (similarJumpBtn) similarJumpBtn.hidden = true;
    }
  }
}

boot();