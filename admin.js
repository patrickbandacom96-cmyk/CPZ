// Creative Plug Zambia - admin side (admin.js)
// TEST LOGIN ONLY. A password inside frontend JavaScript is NOT secure.
(function () {
  "use strict";
  var C = window.CPZ, D = C.DB, $ = C.$, esc = C.esc, m = C.money, badge = C.badge;
  var TEST_USER = "admin", TEST_PASS = "cpz-demo-1234";
  var PS = ["UNPAID", "PARTIALLY PAID", "PAID"];
  var F = { q: "", st: "ALL", ps: "ALL", r: "all", from: "", to: "" };
  var timer;

  function toast(t) {
    var e = $("toast"); e.textContent = t; e.classList.add("show");
    clearTimeout(timer); timer = setTimeout(function () { e.classList.remove("show"); }, 2800);
  }
  function opts(list, cur) { return list.map(function (s) { return "<option" + (s === cur ? " selected" : "") + ">" + s + "</option>"; }).join(""); }
  function val(id) { return $(id).value.trim(); }
  function sumOf(list) {
    var l = list.filter(function (o) { return o.status !== "CANCELLED"; });
    var sales = l.reduce(function (t, o) { return t + o.total; }, 0), paid = l.reduce(function (t, o) { return t + o.paid; }, 0);
    return { sales: sales, paid: paid, out: sales - paid };
  }
  function card(label, v) { return "<div><span>" + label + "</span><strong>" + v + "</strong></div>"; }
  function rangeCtl() {
    return '<div class="filters"><select id="fr"><option value="all">All dates</option>' +
      [["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"], ["custom", "Custom range"]].map(function (r) {
        return '<option value="' + r[0] + '"' + (F.r === r[0] ? " selected" : "") + ">" + r[1] + "</option>";
      }).join("") + "</select>" +
      (F.r === "custom" ? '<input type="date" id="ffrom" value="' + F.from + '"><input type="date" id="fto" value="' + F.to + '">' : "") + "</div>";
  }
  function csv(name, rows) {
    var t = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = name; a.click();
  }

  // ---------- views ----------
  function orderRow(o) {
    return '<a class="card lk" href="#order/' + esc(o.orderNumber) + '"><div class="top"><b>' + esc(o.orderNumber) + "</b>" + badge(o.status) + "</div>" +
      "<p>" + esc(o.customerName) + " &middot; " + o.qty + " &times; " + esc(o.service) + "</p>" +
      "<p><strong>" + m(o.total) + "</strong> " + badge(o.payStatus) + " <span class=\"k\">" + esc(C.fmtDate(o.date)) + "</span></p></a>";
  }
  function filtered() {
    var q = F.q.toLowerCase();
    return D.data().orders.filter(function (o) {
      if (F.st !== "ALL" && o.status !== F.st) return false;
      if (F.ps !== "ALL" && o.payStatus !== F.ps) return false;
      if (!C.inRange(o.date, F.r, F.from, F.to)) return false;
      return !q || [o.customerName, o.phone, o.orderNumber, o.service].join(" ").toLowerCase().indexOf(q) > -1;
    });
  }
  function ordersList() { var l = filtered(); return l.length ? l.map(orderRow).join("") : '<p class="empty">No orders yet.</p>'; }

  function vDashboard() {
    var d = D.data(), o = d.orders, s = sumOf(o);
    var c = function (st) { return o.filter(function (x) { return x.status === st; }).length; };
    return "<h2>Dashboard</h2>" + (d.orders.length === 0 ? '<p class="note">Nothing here yet. Load demo data in Settings to test.</p>' : "") +
      '<div class="summary">' + card("Total orders", o.length) + card("Pending", c("PENDING")) + card("Confirmed", c("CONFIRMED")) +
      card("In progress", c("IN PROGRESS")) + card("Ready", c("READY")) + card("Completed", c("COMPLETED")) +
      card("Total sales", m(s.sales)) + card("Paid", m(s.paid)) + card("Unpaid / outstanding", m(s.out)) + "</div>" +
      '<p class="note">Sales, paid and outstanding exclude cancelled orders.</p><h3>Recent orders</h3>' +
      (o.length ? o.slice(0, 5).map(orderRow).join("") : '<p class="empty">No orders yet.</p>');
  }
  function vOrders() {
    return "<h2>Orders</h2>" + '<input id="oq" type="search" placeholder="Search name, phone, order no. or service" value="' + esc(F.q) + '">' +
      '<div class="filters"><select id="fst"><option>ALL</option>' + opts(C.STATUSES, F.st) + '</select><select id="fps"><option>ALL</option>' + opts(PS, F.ps) + "</select></div>" +
      rangeCtl() + '<button class="btn" data-act="csvOrders" type="button">Export orders CSV</button><div id="olist">' + ordersList() + "</div>";
  }
  function vOrder(no) {
    var o = D.orderBy(no); if (!o) return '<p class="empty">Order not found.</p><a class="btn" href="#orders">Back</a>';
    var inv = D.data().invoices.filter(function (i) { return i.orderNumber === no; })[0];
    var recs = D.data().receipts.filter(function (r) { return r.orderNumber === no; });
    return '<a class="back" href="#orders">&larr; Orders</a><h2>' + esc(o.orderNumber) + "</h2><p>" + badge(o.status) + " " + badge(o.payStatus) + "</p>" +
      '<dl class="facts"><dt>Date</dt><dd>' + esc(C.fmtDate(o.date)) + "</dd><dt>Customer</dt><dd>" + esc(o.customerName) + "</dd>" +
      "<dt>Phone</dt><dd>" + esc(o.phone) + "</dd><dt>WhatsApp</dt><dd>" + esc(o.whatsapp) + "</dd><dt>Email</dt><dd>" + esc(o.email || "-") + "</dd>" +
      "<dt>Service</dt><dd>" + esc(o.service) + "</dd><dt>Unit price</dt><dd>" + m(o.unit) + "</dd><dt>Total</dt><dd>" + m(o.total) + "</dd>" +
      "<dt>Amount paid</dt><dd>" + m(o.paid) + "</dd><dt>Balance due</dt><dd>" + m(o.total - o.paid) + "</dd></dl>" +
      '<label for="st">Order status</label><select id="st" data-no="' + esc(no) + '">' + opts(C.STATUSES, o.status) + "</select>" +
      "<h3>Edit order</h3><label for=\"eq\">Quantity</label><input id=\"eq\" type=\"number\" min=\"1\" value=\"" + o.qty + "\">" +
      '<label for="ed">Preferred date</label><input id="ed" type="date" value="' + esc(o.prefDate) + '">' +
      '<label for="en">Customer instructions</label><textarea id="en" rows="3">' + esc(o.notes) + "</textarea>" +
      '<label for="ei">Internal notes</label><textarea id="ei" rows="3">' + esc(o.internalNotes) + "</textarea>" +
      '<button class="btn" data-act="saveOrder" data-no="' + esc(no) + '" type="button">Save changes</button>' +
      "<h3>Payment</h3><label for=\"pay\">Record payment (" + D.settings().currency + ")</label><input id=\"pay\" type=\"number\" inputmode=\"decimal\" min=\"1\" placeholder=\"Amount received\">" +
      '<button class="btn primary" data-act="pay" data-no="' + esc(no) + '" type="button">Record payment &amp; create receipt</button>' +
      "<h3>Documents</h3><div class=\"stack\"><button class=\"btn\" data-act=\"invoice\" data-no=\"" + esc(no) + "\" type=\"button\">" + (inv ? "View invoice " + esc(inv.invoiceNumber) : "Create invoice") + "</button>" +
      recs.map(function (r) { return '<button class="btn" data-act="viewRec" data-id="' + esc(r.receiptNumber) + '" type="button">Receipt ' + esc(r.receiptNumber) + " (" + m(r.amount) + ")</button>"; }).join("") + "</div>" +
      "<h3>Status history</h3>" + o.history.map(function (h) {
        return '<p class="note">' + esc(C.fmtDate(h.at)) + ": " + (h.from ? esc(h.from) + " &rarr; " : "") + esc(h.to) + "</p>";
      }).join("") +
      '<a class="btn" target="_blank" rel="noopener" href="' + C.wa("Hello " + o.customerName + ", this is Creative Plug Zambia about order " + o.orderNumber + " (" + o.service + ").", o.whatsapp) + '">WhatsApp customer</a>';
  }
  function custRow(c) {
    var s = D.customerStats(c);
    return '<a class="card lk" href="#customer/' + c.id + '"><div class="top"><b>' + esc(c.name) + "</b><span class=\"k\">" + s.count + " orders</span></div>" +
      "<p>" + esc(c.phone) + "</p><p>Spent " + m(s.spent) + " &middot; Outstanding " + m(s.outstanding) + "</p></a>";
  }
  function custList(q) {
    q = (q || "").toLowerCase();
    var l = D.data().customers.filter(function (c) { return !q || (c.name + c.phone + c.email).toLowerCase().indexOf(q) > -1; });
    return l.length ? l.map(custRow).join("") : '<p class="empty">No customers yet.</p>';
  }
  function vCustomers() { return "<h2>Customers</h2><input id=\"cq\" type=\"search\" placeholder=\"Search customers\"><button class=\"btn\" data-act=\"csvCust\" type=\"button\">Export customers CSV</button><div id=\"clist\">" + custList("") + "</div>"; }
  function vCustomer(id) {
    var c = D.data().customers.filter(function (x) { return x.id === id; })[0];
    if (!c) return '<p class="empty">Customer not found.</p>';
    var s = D.customerStats(c);
    return '<a class="back" href="#customers">&larr; Customers</a><h2>' + esc(c.name) + "</h2><dl class=\"facts\"><dt>Customer ID</dt><dd>" + c.id + "</dd><dt>Phone</dt><dd>" + esc(c.phone) +
      "</dd><dt>WhatsApp</dt><dd>" + esc(c.whatsapp) + "</dd><dt>Email</dt><dd>" + esc(c.email || "-") + "</dd><dt>Total orders</dt><dd>" + s.count +
      "</dd><dt>Total spent (paid)</dt><dd>" + m(s.spent) + "</dd><dt>Outstanding</dt><dd>" + m(s.outstanding) + "</dd><dt>Last order</dt><dd>" +
      esc(s.last ? C.fmtDate(s.last) : "-") + "</dd><dt>Created</dt><dd>" + esc(C.fmtDate(c.createdAt)) + "</dd></dl><h3>Order history</h3>" + s.orders.map(orderRow).join("");
  }
  function vSales() {
    var l = D.data().orders.filter(function (o) { return C.inRange(o.date, F.r, F.from, F.to); }), s = sumOf(l), by = {};
    l.filter(function (o) { return o.status !== "CANCELLED"; }).forEach(function (o) {
      by[o.service] = by[o.service] || { n: 0, t: 0 }; by[o.service].n += 1; by[o.service].t += o.total;
    });
    var keys = Object.keys(by);
    return "<h2>Sales</h2>" + rangeCtl() + '<div class="summary">' + card("Total sales", m(s.sales)) + card("Paid", m(s.paid)) + card("Unpaid", m(s.out)) + card("Orders", l.length) + "</div>" +
      "<h3>Sales by service</h3>" + (keys.length ? keys.map(function (k) { return '<div class="card"><div class="top"><b>' + esc(k) + "</b><span>" + m(by[k].t) + "</span></div><p class=\"k\">" + by[k].n + " orders</p></div>"; }).join("") : '<p class="empty">No sales in this period.</p>') +
      '<button class="btn" data-act="csvSales" type="button">Export sales CSV</button>';
  }
  function docRow(x, kind) {
    var n = kind === "inv" ? x.invoiceNumber : x.receiptNumber;
    return '<button class="card lk" data-act="' + (kind === "inv" ? "viewInv" : "viewRec") + '" data-id="' + esc(n) + '" type="button"><div class="top"><b>' + esc(n) + "</b><span class=\"k\">" + esc(C.fmtDate(x.date)) + "</span></div><p>Order " + esc(x.orderNumber) + (kind === "rec" ? " &middot; " + m(x.amount) : "") + "</p></button>";
  }
  function docList(kind, q) {
    q = (q || "").toLowerCase();
    var src = D.data()[kind === "inv" ? "invoices" : "receipts"].filter(function (x) {
      var cust = kind === "rec" ? x.customerName : (D.data().customers.filter(function (c) { return c.id === x.customerId; })[0] || {}).name;
      return !q || (JSON.stringify(x) + (cust || "")).toLowerCase().indexOf(q) > -1;
    });
    return src.length ? src.map(function (x) { return docRow(x, kind); }).join("") : '<p class="empty">' + (kind === "inv" ? "No invoices yet." : "No receipts yet.") + "</p>";
  }
  function vInvoices() { return "<h2>Invoices</h2><input id=\"iq\" type=\"search\" placeholder=\"Search invoices\"><div id=\"ilist\">" + docList("inv", "") + "</div><p class=\"note\">Create an invoice from an order's page.</p>"; }
  function vReceipts() { return "<h2>Receipts</h2><input id=\"rq\" type=\"search\" placeholder=\"Search receipts\"><div id=\"rlist\">" + docList("rec", "") + "</div><p class=\"note\">Receipts are created when you record a payment.</p>"; }
  function vServices() {
    return "<h2>Services</h2><div class=\"card\"><input type=\"hidden\" id=\"sv_id\"><label for=\"sv_name\">Name</label><input id=\"sv_name\"><label for=\"sv_price\">Price</label><input id=\"sv_price\" type=\"number\" min=\"0\">" +
      '<label for="sv_cat">Category</label><input id="sv_cat"><label for="sv_desc">Description</label><textarea id="sv_desc" rows="2"></textarea>' +
      '<label for="sv_active">Status</label><select id="sv_active"><option value="1">Active</option><option value="0">Inactive</option></select><button class="btn primary" data-act="saveSvc" type="button">Save service</button></div>' +
      D.data().services.map(function (s) {
        return '<div class="card"><div class="top"><b>' + esc(s.name) + "</b><span>" + m(s.price) + "</span></div><p class=\"k\">" + esc(s.category) + " &middot; " + (s.active ? "Active" : "Inactive") + "</p>" +
          '<div class="row3"><button class="btn" data-act="editSvc" data-id="' + s.id + '" type="button">Edit</button><button class="btn" data-act="togSvc" data-id="' + s.id + '" type="button">' + (s.active ? "Deactivate" : "Activate") +
          '</button><button class="btn" data-act="delSvc" data-id="' + s.id + '" type="button">Delete</button></div></div>';
      }).join("");
  }
  function vNotifications() {
    var l = D.data().notifications;
    return "<h2>Notifications</h2><p class=\"note\">In-app only. Push, email and WhatsApp alerts need the online backend.</p><button class=\"btn\" data-act=\"readAll\" type=\"button\">Mark all as read</button>" +
      (l.length ? l.map(function (n) {
        return '<div class="card' + (n.read ? "" : " unread") + '"><div class="top"><b>NEW ORDER ' + esc(n.orderNumber) + '</b><span class="k">' + esc(C.fmtDate(n.at)) + "</span></div><p>" + esc(n.text) + "</p>" +
          (n.read ? "" : '<button class="btn" data-act="readOne" data-id="' + esc(n.id) + '" type="button">Mark as read</button>') + "</div>";
      }).join("") : '<p class="empty">No notifications yet.</p>');
  }
  function vSettings() {
    var s = D.settings(), f = function (id, label, v) { return '<label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(v) + '">'; };
    return "<h2>Settings</h2>" + f("s_businessName", "Business name", s.businessName) + f("s_tagline", "Tagline", s.tagline) + f("s_whatsapp", "WhatsApp number", s.whatsapp) +
      f("s_phone", "Business phone", s.phone) + f("s_email", "Email", s.email) + f("s_currency", "Currency symbol", s.currency) + f("s_orderPrefix", "Order prefix", s.orderPrefix) +
      f("s_invoicePrefix", "Invoice prefix", s.invoicePrefix) + f("s_receiptPrefix", "Receipt prefix", s.receiptPrefix) +
      '<p class="note">The CPZ logo is fixed to the official file in the icons folder.</p><button class="btn primary" data-act="saveSettings" type="button">Save settings</button>' +
      '<h3>Demo data</h3><p class="note">Demo records are labelled (DEMO) and can be removed.</p><div class="stack"><button class="btn" data-act="loadDemo" type="button">Load demo data</button><button class="btn" data-act="clearDemo" type="button">Delete demo data</button></div>' +
      '<p class="warn">All data in this version lives only in this browser on this device. Customer orders from other phones will not appear here until the app is connected to an online backend.</p>';
  }

  // ---------- documents (invoice / receipt) ----------
  function docHead(title, no, date) {
    var s = D.settings();
    return '<div class="doc"><div class="doc-top"><img src="icons/logo.png" alt="CPZ logo" width="90" height="90"><div><h1>' + esc(s.businessName.toUpperCase()) + "</h1><p>" + esc(s.tagline) + "</p><p>" + esc(s.phone) + " &middot; " + esc(s.email) + "</p></div></div><h2>" + title + "</h2><p><b>" + esc(no) + "</b> &middot; " + esc(C.fmtDate(date)) + "</p>";
  }
  function showDoc(html, shareText, shareTo) {
    var d = $("doc");
    d.innerHTML = '<div class="noprint bar"><button class="btn" data-act="closeDoc" type="button">Close</button><button class="btn" data-act="print" type="button">Print / Save as PDF</button><button class="btn" data-act="share" type="button">Share</button></div>' + html;
    d.hidden = false; d._t = shareText; d._to = shareTo;
  }
  function viewInvoice(no) {
    var inv = D.data().invoices.filter(function (i) { return i.invoiceNumber === no; })[0], o = D.orderBy(inv.orderNumber);
    showDoc(docHead("INVOICE", inv.invoiceNumber, inv.date) + "<p>Order: " + esc(o.orderNumber) + "</p><h4>Customer</h4><p>" + esc(o.customerName) + "<br>" + esc(o.phone) + "<br>" + esc(o.email) + "</p>" +
      '<table><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr>' + inv.items.map(function (i) { return "<tr><td>" + esc(i.desc) + "</td><td>" + i.qty + "</td><td>" + m(i.unit) + "</td><td>" + m(i.total) + "</td></tr>"; }).join("") + "</table>" +
      "<p>Subtotal: <b>" + m(o.total) + "</b></p><p>Amount paid: <b>" + m(o.paid) + "</b></p><p>Balance due: <b>" + m(o.total - o.paid) + "</b></p><p>Payment status: <b>" + esc(o.payStatus) + "</b></p></div>",
      "Invoice " + inv.invoiceNumber + " (" + o.orderNumber + ") from Creative Plug Zambia\n" + o.qty + " x " + o.service + "\nTotal: " + m(o.total) + "\nPaid: " + m(o.paid) + "\nBalance: " + m(o.total - o.paid), o.whatsapp);
  }
  function viewReceipt(no) {
    var r = D.data().receipts.filter(function (x) { return x.receiptNumber === no; })[0];
    showDoc(docHead("RECEIPT", r.receiptNumber, r.date) + "<p>Invoice: " + esc(r.invoiceNumber || "-") + " &middot; Order: " + esc(r.orderNumber) + "</p><p>Customer: <b>" + esc(r.customerName) + "</b></p><p>Description: " + esc(r.desc) +
      "</p><p>Amount paid: <b>" + m(r.amount) + "</b></p><p>Total paid so far: " + m(r.totalPaid) + " of " + m(r.orderTotal) + "</p><p class=\"stamp\">" + esc(r.status) + "</p></div>",
      "Receipt " + r.receiptNumber + " from Creative Plug Zambia\nAmount paid: " + m(r.amount) + "\nOrder: " + r.orderNumber + "\nStatus: " + r.status, r.phone);
  }

  // ---------- router ----------
  function bell() {
    var n = D.data().notifications.filter(function (x) { return !x.read; }).length;
    $("bellN").textContent = n; $("bellN").hidden = !n;
  }
  function go() {
    var on = sessionStorage.getItem("cpz_admin") === "1";
    $("login").hidden = on; $("shell").hidden = !on;
    if (!on) return;
    var p = (location.hash || "#dashboard").slice(1).split("/"), name = p[0] || "dashboard", arg = decodeURIComponent(p[1] || "");
    var V = { dashboard: vDashboard, orders: vOrders, order: vOrder, customers: vCustomers, customer: vCustomer, sales: vSales, invoices: vInvoices, receipts: vReceipts, services: vServices, notifications: vNotifications, settings: vSettings };
    $("main").innerHTML = (V[name] || vDashboard)(arg);
    $("drawer").classList.remove("open"); bell(); window.scrollTo(0, 0);
  }
  function refresh() { var y = window.scrollY; go(); window.scrollTo(0, y); }
  function attempt(fn, okMsg) {
    try { fn(); if (okMsg) toast(okMsg); refresh(); } catch (e) { toast(e.message || "Something went wrong."); }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act"), no = b.getAttribute("data-no"), id = b.getAttribute("data-id"), d = D.data();
    if (a === "csvOrders") csv("cpz-orders.csv", [["Order", "Date", "Customer", "Phone", "Service", "Qty", "Unit", "Total", "Paid", "Status", "Payment"]].concat(filtered().map(function (o) { return [o.orderNumber, o.date, o.customerName, o.phone, o.service, o.qty, o.unit, o.total, o.paid, o.status, o.payStatus]; })));
    else if (a === "csvCust") csv("cpz-customers.csv", [["ID", "Name", "Phone", "WhatsApp", "Email", "Orders", "Paid", "Outstanding"]].concat(d.customers.map(function (c) { var s = D.customerStats(c); return [c.id, c.name, c.phone, c.whatsapp, c.email, s.count, s.spent, s.outstanding]; })));
    else if (a === "csvSales") csv("cpz-sales.csv", [["Order", "Date", "Service", "Total", "Paid", "Status"]].concat(d.orders.filter(function (o) { return C.inRange(o.date, F.r, F.from, F.to); }).map(function (o) { return [o.orderNumber, o.date, o.service, o.total, o.paid, o.status]; })));
    else if (a === "saveOrder") attempt(function () { D.updateOrder(no, { qty: val("eq"), notes: val("en"), internalNotes: val("ei"), prefDate: val("ed") }); }, "Order saved.");
    else if (a === "pay") attempt(function () { var r = D.recordPayment(no, val("pay")); viewReceipt(r.receiptNumber); }, "Payment recorded.");
    else if (a === "invoice") attempt(function () { var i = D.createInvoice(no); viewInvoice(i.invoiceNumber); });
    else if (a === "viewInv") viewInvoice(id);
    else if (a === "viewRec") viewReceipt(id);
    else if (a === "closeDoc") $("doc").hidden = true;
    else if (a === "print") window.print();
    else if (a === "share") {
      var t = $("doc")._t, to = $("doc")._to;
      if (navigator.share) navigator.share({ title: "Creative Plug Zambia", text: t }).catch(function () {}); else window.open(C.wa(t, to), "_blank");
    }
    else if (a === "saveSvc") attempt(function () {
      var name = val("sv_name"), price = Number(val("sv_price")); if (!name) throw new Error("Enter a service name."); if (!(price >= 0) || val("sv_price") === "") throw new Error("Enter a valid price.");
      var s = d.services.filter(function (x) { return x.id === val("sv_id"); })[0];
      if (!s) { d.counters.service += 1; s = { id: "svc" + d.counters.service }; d.services.push(s); }
      s.name = name; s.price = price; s.category = val("sv_cat"); s.description = val("sv_desc"); s.active = $("sv_active").value === "1"; D.save();
    }, "Service saved.");
    else if (a === "editSvc") { var s = d.services.filter(function (x) { return x.id === id; })[0]; $("sv_id").value = s.id; $("sv_name").value = s.name; $("sv_price").value = s.price; $("sv_cat").value = s.category; $("sv_desc").value = s.description; $("sv_active").value = s.active ? "1" : "0"; window.scrollTo(0, 0); }
    else if (a === "togSvc") attempt(function () { var s = d.services.filter(function (x) { return x.id === id; })[0]; s.active = !s.active; D.save(); });
    else if (a === "delSvc") { if (confirm("Delete this service? Existing orders keep their details.")) attempt(function () { d.services = d.services.filter(function (x) { return x.id !== id; }); D.save(); }, "Service deleted."); }
    else if (a === "readAll") attempt(function () { d.notifications.forEach(function (n) { n.read = true; }); D.save(); });
    else if (a === "readOne") attempt(function () { d.notifications.forEach(function (n) { if (n.id === id) n.read = true; }); D.save(); });
    else if (a === "saveSettings") attempt(function () {
      ["businessName", "tagline", "whatsapp", "phone", "email", "currency", "orderPrefix", "invoicePrefix", "receiptPrefix"].forEach(function (k) { d.settings[k] = val("s_" + k) || d.settings[k]; }); D.save();
    }, "Settings saved.");
    else if (a === "loadDemo") attempt(function () { D.loadDemo(); }, "Demo data loaded.");
    else if (a === "clearDemo") { if (confirm("Delete all demo data?")) attempt(function () { D.clearDemo(); }, "Demo data deleted."); }
  });
  document.addEventListener("input", function (e) {
    var id = e.target.id, v = e.target.value;
    if (id === "oq") { F.q = v; $("olist").innerHTML = ordersList(); }
    else if (id === "cq") $("clist").innerHTML = custList(v);
    else if (id === "iq") $("ilist").innerHTML = docList("inv", v);
    else if (id === "rq") $("rlist").innerHTML = docList("rec", v);
  });
  document.addEventListener("change", function (e) {
    var id = e.target.id, v = e.target.value;
    if (id === "st") attempt(function () { D.setStatus(e.target.getAttribute("data-no"), v); }, "Status updated.");
    else if (id === "fst") { F.st = v; refresh(); } else if (id === "fps") { F.ps = v; refresh(); }
    else if (id === "fr") { F.r = v; refresh(); } else if (id === "ffrom") { F.from = v; refresh(); } else if (id === "fto") { F.to = v; refresh(); }
  });
  var busy = false;
  $("lBtn").addEventListener("click", function () {
    if (busy) return; busy = true; $("lBtn").textContent = "Logging in...";
    setTimeout(function () {
      if ($("lUser").value.trim() === TEST_USER && $("lPass").value === TEST_PASS) { sessionStorage.setItem("cpz_admin", "1"); $("lErr").textContent = ""; location.hash = "#dashboard"; go(); }
      else $("lErr").textContent = "Incorrect username or password.";
      busy = false; $("lBtn").textContent = "Login";
    }, 300);
  });
  $("menuBtn").addEventListener("click", function () { $("drawer").classList.toggle("open"); });
  $("logout").addEventListener("click", function () { sessionStorage.removeItem("cpz_admin"); location.hash = ""; go(); });
  window.addEventListener("hashchange", go);
  go();
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("service-worker.js").catch(function () {}); });
})();
