// Creative Plug Zambia - customer side (customer.js)
(function () {
  "use strict";
  var C = window.CPZ, D = C.DB, $ = C.$, esc = C.esc, money = C.money;
  var VIEWS = ["home", "services", "order", "confirm", "orders", "contact"];
  var STEPS = ["PENDING", "CONFIRMED", "IN PROGRESS", "READY", "COMPLETED"];
  var timer, deferredPrompt = null, busy = false;

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(timer); timer = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }
  function route() {
    var h = (location.hash || "#home").slice(1);
    if (VIEWS.indexOf(h) === -1) h = "home";
    VIEWS.forEach(function (v) { $("view-" + v).classList.toggle("active", v === h); });
    document.querySelectorAll("#tabs a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-tab") === h); });
    if (h === "orders") renderMine();
    if (h === "services") buildServices();
    if (h === "order") { buildSelect(); updateTotals(); showForm(); }
    window.scrollTo(0, 0);
  }
  function buildServices() {
    $("serviceList").innerHTML = D.data().services.map(function (s) {
      return '<li><div class="nm">' + esc(s.name) + '<small>' + esc(s.description) + '</small></div><span class="pr">' + money(s.price) + "</span>" +
        (s.active ? '<a class="btn" href="#order" data-pick="' + s.id + '">Order now</a>' : '<span class="badge">Unavailable</span>') + "</li>";
    }).join("");
  }
  function buildSelect() {
    var sel = $("fService"), keep = sel.value;
    sel.innerHTML = '<option value="">Select a service</option>' + D.activeServices().map(function (s) {
      return '<option value="' + s.id + '">' + esc(s.name) + " - " + money(s.price) + "</option>";
    }).join("");
    sel.value = keep;
  }
  function svc() { return D.data().services.filter(function (s) { return s.id === $("fService").value; })[0]; }
  function qty() { var q = parseInt($("fQty").value, 10); return isNaN(q) ? 0 : q; }
  function updateTotals() {
    var s = svc(), p = s ? s.price : 0;
    $("tPrice").textContent = money(p); $("tTotal").textContent = money(p * Math.max(qty(), 0));
  }
  function setErr(id, input, msg) { $(id).textContent = msg || ""; $(input).classList.toggle("bad", !!msg); return !msg; }
  function validate() {
    var ok = true;
    ok = setErr("eName", "fName", $("fName").value.trim() ? "" : "Please enter your name.") && ok;
    ok = setErr("ePhone", "fPhone", /^\+?\d{9,13}$/.test($("fPhone").value.replace(/[\s-]/g, "")) ? "" : "Please enter a valid phone number.") && ok;
    var em = $("fEmail").value.trim();
    ok = setErr("eEmail", "fEmail", !em || /^\S+@\S+\.\S+$/.test(em) ? "" : "Please enter a valid email or leave it empty.") && ok;
    ok = setErr("eService", "fService", svc() ? "" : "Please select a service.") && ok;
    ok = setErr("eQty", "fQty", qty() >= 1 && qty() <= 99 ? "" : "Quantity must be at least 1.") && ok;
    return ok;
  }
  function showForm() { $("orderForm").hidden = false; $("review").hidden = true; }
  function showReview(e) {
    e.preventDefault();
    if (!validate()) { toast("Please fix the highlighted fields."); return; }
    var s = svc(), q = qty();
    $("reviewFacts").innerHTML =
      "<dt>Customer</dt><dd>" + esc($("fName").value.trim()) + " (" + esc($("fPhone").value.trim()) + ")</dd>" +
      "<dt>Service</dt><dd>" + esc(s.name) + "</dd><dt>Unit price</dt><dd>" + money(s.price) + "</dd>" +
      "<dt>Quantity</dt><dd>" + q + "</dd><dt>Total</dt><dd>" + money(s.price * q) + "</dd>" +
      "<dt>Instructions</dt><dd>" + esc($("fNotes").value.trim() || "-") + "</dd>";
    $("eSubmit").textContent = "";
    $("orderForm").hidden = true; $("review").hidden = false; window.scrollTo(0, 0);
  }
  function submit() {
    if (busy) return;
    busy = true; $("submitBtn").disabled = true; $("submitBtn").textContent = "Submitting...";
    setTimeout(function () {
      try {
        var o = D.createOrder({
          name: $("fName").value.trim(), phone: $("fPhone").value.trim(), whatsapp: $("fWhats").value.trim(),
          email: $("fEmail").value.trim(), serviceId: $("fService").value, qty: qty(),
          prefDate: $("fDate").value, notes: $("fNotes").value.trim()
        });
        $("cNo").textContent = o.orderNumber; $("cService").textContent = o.service;
        $("cQty").textContent = o.qty; $("cTotal").textContent = money(o.total);
        $("cWhats").href = C.wa("Hello Creative Plug Zambia,\n\nI have submitted an order.\n\nOrder Number: " + o.orderNumber +
          "\nService: " + o.service + "\nQuantity: " + o.qty + "\nTotal: " + money(o.total) + "\n\nThank you.");
        $("orderForm").reset(); $("fQty").value = 1; updateTotals();
        location.hash = "#confirm";
      } catch (err) {
        $("eSubmit").textContent = "Something went wrong while submitting your order. Please try again. (" + err.message + ")";
      }
      busy = false; $("submitBtn").disabled = false; $("submitBtn").textContent = "Submit order";
    }, 400);
  }
  function renderMine() {
    var mine = D.mine(), list = mine.map(D.orderBy).filter(Boolean);
    if (!list.length) { $("myOrders").innerHTML = '<p class="empty">No orders found.</p>'; return; }
    $("myOrders").innerHTML = list.map(function (o) {
      var idx = STEPS.indexOf(o.status);
      var track = o.status === "CANCELLED" ? "" : '<ol class="steps">' + STEPS.map(function (s, i) {
        return '<li class="' + (i < idx ? "done" : i === idx ? "now" : "") + '">' + esc(s) + "</li>";
      }).join("") + "</ol>";
      return '<div class="card"><div class="top"><span class="no">' + esc(o.orderNumber) + "</span>" + C.badge(o.status) + "</div>" +
        "<p><span class=\"k\">Service:</span> " + esc(o.service) + "</p>" +
        "<p><span class=\"k\">Quantity:</span> " + o.qty + " &nbsp; <span class=\"k\">Total:</span> <strong>" + money(o.total) + "</strong></p>" +
        "<p><span class=\"k\">Date:</span> " + esc(C.fmtDate(o.date)) + "</p>" + track + "</div>";
    }).join("");
  }
  function setupInstall() {
    var btn = $("installBtn"), help = $("installHelp");
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) { btn.hidden = true; return; }
    window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; });
    window.addEventListener("appinstalled", function () { btn.hidden = true; help.hidden = true; toast("Creative Plug Zambia installed."); });
    btn.addEventListener("click", function () {
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(function () { deferredPrompt = null; }); }
      else {
        help.hidden = false;
        help.textContent = "To install Creative Plug Zambia, open your browser menu and select 'Install App' or 'Add to Home Screen'. On iPhone, tap Share, then 'Add to Home Screen'.";
      }
    });
  }
  function init() {
    var s = D.settings();
    $("cPhone").textContent = s.phone; $("cEmail").textContent = s.email;
    $("waGeneral").href = C.wa("Hello Creative Plug Zambia, I would like to make an enquiry about your design services.");
    $("callBtn").href = "tel:" + s.phone.replace(/\s/g, ""); $("mailBtn").href = "mailto:" + s.email;
    $("serviceList").addEventListener("click", function (e) {
      var a = e.target.closest("[data-pick]");
      if (a) { buildSelect(); $("fService").value = a.getAttribute("data-pick"); }
    });
    $("fService").addEventListener("change", updateTotals);
    $("fQty").addEventListener("input", updateTotals);
    $("qMinus").addEventListener("click", function () { $("fQty").value = Math.max(1, qty() - 1); updateTotals(); });
    $("qPlus").addEventListener("click", function () { $("fQty").value = Math.min(99, Math.max(1, qty() + 1)); updateTotals(); });
    $("orderForm").addEventListener("submit", showReview);
    $("editBtn").addEventListener("click", showForm);
    $("submitBtn").addEventListener("click", submit);
    window.addEventListener("hashchange", route);
    setupInstall(); route();
    setTimeout(function () { $("splash").classList.add("gone"); }, 600);
    if ("serviceWorker" in navigator) window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
  init();
})();
