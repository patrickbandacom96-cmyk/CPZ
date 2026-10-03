// Creative Plug Zambia - shared data layer (db.js)
// VERSION 1 LOCAL DEMO: everything is stored in this device's localStorage.
// To go online later, replace the functions inside CPZ.DB with Supabase/Firebase calls.
(function (w) {
  "use strict";
  var KEY = "cpz_db_v2", MINE = "cpz_mine_v2", cache = null;
  var STATUSES = ["PENDING", "CONFIRMED", "IN PROGRESS", "READY", "COMPLETED", "CANCELLED"];
  var SERVICE_SEED = [
    ["Poster", 70, "Event, promo and announcement posters.", "Print"],
    ["Flyer", 70, "Flyers for events, offers and promotions.", "Print"],
    ["Banner", 100, "Banner designs ready for printing.", "Print"],
    ["Event Design", 150, "Complete designs for events.", "Event"],
    ["Email Design", 150, "Branded email layouts and graphics.", "Digital"],
    ["Business Card", 100, "Professional business card designs.", "Branding"],
    ["Church Poster", 100, "Posters for church programmes and events.", "Print"],
    ["Menu Card", 60, "Menu designs for restaurants and cafes.", "Print"],
    ["Birthday Design", 50, "Birthday invitations and graphics.", "Event"],
    ["Logo Design", 100, "Logo design for your business or brand.", "Branding"]
  ];

  function defaults() {
    return {
      services: SERVICE_SEED.map(function (s, i) {
        return { id: "svc" + (i + 1), name: s[0], price: s[1], description: s[2], category: s[3], active: true };
      }),
      orders: [], customers: [], invoices: [], receipts: [], payments: [], notifications: [],
      settings: {
        businessName: "Creative Plug Zambia", tagline: "Plug into Creativity.",
        whatsapp: "0977934234", phone: "0977934234", email: "patrickbandacom96@gmail.com",
        currency: "K", orderPrefix: "CPZ-", invoicePrefix: "INV-", receiptPrefix: "REC-"
      },
      counters: { order: 0, invoice: 0, receipt: 0, customer: 0, service: 10 }
    };
  }
  function data() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(KEY)); } catch (e) { cache = null; }
    if (!cache || !cache.services) cache = defaults();
    return cache;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(data())); }
  function pad(n) { return String(n).padStart(4, "0"); }
  function nextNo(type) {
    var d = data(), p = { order: "orderPrefix", invoice: "invoicePrefix", receipt: "receiptPrefix" }[type];
    d.counters[type] += 1;
    return d.settings[p] + pad(d.counters[type]);
  }
  function digits(s) { return String(s || "").replace(/\D/g, "").slice(-9); }
  function payStatus(o) { return o.paid <= 0 ? "UNPAID" : (o.paid >= o.total ? "PAID" : "PARTIALLY PAID"); }
  function orderBy(no) { return data().orders.filter(function (o) { return o.orderNumber === no; })[0]; }
  function now() { return new Date().toISOString(); }

  var DB = {
    data: data, save: save, payStatus: payStatus, orderBy: orderBy,
    settings: function () { return data().settings; },
    activeServices: function () { return data().services.filter(function (s) { return s.active; }); },
    mine: function () { try { return JSON.parse(localStorage.getItem(MINE)) || []; } catch (e) { return []; } },
    createOrder: function (f, demo) {
      var d = data(), svc = d.services.filter(function (s) { return s.id === f.serviceId; })[0];
      if (!svc || !svc.active) throw new Error("This service is not available.");
      var q = parseInt(f.qty, 10);
      if (!(q >= 1)) throw new Error("Quantity must be at least 1.");
      var c = d.customers.filter(function (x) { return digits(x.phone) === digits(f.phone); })[0];
      if (!c) {
        d.counters.customer += 1;
        c = { id: "C" + pad(d.counters.customer), createdAt: now() };
        d.customers.push(c);
      }
      c.name = f.name; c.phone = f.phone; c.whatsapp = f.whatsapp || f.phone; c.email = f.email || c.email || "";
      if (demo) c.demo = true;
      var o = {
        orderNumber: nextNo("order"), customerId: c.id, customerName: f.name, phone: f.phone,
        whatsapp: f.whatsapp || f.phone, email: f.email || "", serviceId: svc.id, service: svc.name,
        qty: q, unit: svc.price, total: svc.price * q, notes: f.notes || "", prefDate: f.prefDate || "",
        status: "PENDING", payStatus: "UNPAID", paid: 0, internalNotes: "", date: now(),
        history: [{ from: "", to: "PENDING", at: now() }]
      };
      if (demo) o.demo = true;
      d.orders.unshift(o);
      d.notifications.unshift({ id: "N" + Date.now() + Math.random().toString(36).slice(2, 5), orderNumber: o.orderNumber,
        text: o.customerName + " ordered " + q + " \u00d7 " + o.service + " (Total " + o.total + ")", at: now(), read: false, demo: !!demo });
      save();
      if (!demo) { var m = DB.mine(); m.unshift(o.orderNumber); localStorage.setItem(MINE, JSON.stringify(m)); }
      return o;
    },
    setStatus: function (no, st) {
      var o = orderBy(no); if (!o || o.status === st) return;
      o.history.push({ from: o.status, to: st, at: now() }); o.status = st; save();
    },
    updateOrder: function (no, p) {
      var o = orderBy(no), q = parseInt(p.qty, 10);
      if (!(q >= 1)) throw new Error("Quantity must be at least 1.");
      if (o.unit * q < o.paid) throw new Error("Total cannot be lower than the amount already paid.");
      o.qty = q; o.total = o.unit * q; o.notes = p.notes; o.internalNotes = p.internalNotes; o.prefDate = p.prefDate;
      o.payStatus = payStatus(o); save();
    },
    createInvoice: function (no) {
      var d = data(), o = orderBy(no);
      var inv = d.invoices.filter(function (i) { return i.orderNumber === no; })[0];
      if (inv) return inv;
      inv = { invoiceNumber: nextNo("invoice"), orderNumber: no, customerId: o.customerId, date: now(),
        items: [{ desc: o.service, qty: o.qty, unit: o.unit, total: o.total }], demo: !!o.demo };
      d.invoices.unshift(inv); save(); return inv;
    },
    recordPayment: function (no, amt) {
      var d = data(), o = orderBy(no), a = Number(amt);
      if (!(a > 0)) throw new Error("Enter an amount greater than 0.");
      if (a > o.total - o.paid) throw new Error("Amount is more than the balance due.");
      o.paid += a; o.payStatus = payStatus(o);
      var inv = d.invoices.filter(function (i) { return i.orderNumber === no; })[0];
      d.payments.unshift({ id: "P" + Date.now(), orderNumber: no, amount: a, at: now(), demo: !!o.demo });
      var r = { receiptNumber: nextNo("receipt"), invoiceNumber: inv ? inv.invoiceNumber : "", orderNumber: no,
        customerName: o.customerName, phone: o.phone, desc: o.qty + " \u00d7 " + o.service, amount: a,
        totalPaid: o.paid, orderTotal: o.total, status: o.payStatus, date: now(), demo: !!o.demo };
      d.receipts.unshift(r); save(); return r;
    },
    customerStats: function (c) {
      var l = data().orders.filter(function (o) { return o.customerId === c.id; });
      var live = l.filter(function (o) { return o.status !== "CANCELLED"; });
      return { orders: l, count: l.length,
        spent: live.reduce(function (t, o) { return t + o.paid; }, 0),
        outstanding: live.reduce(function (t, o) { return t + (o.total - o.paid); }, 0),
        last: l.length ? l[0].date : "" };
    },
    loadDemo: function () {
      var d = data();
      if (d.orders.some(function (o) { return o.demo; })) return;
      var a = DB.createOrder({ name: "John Banda (DEMO)", phone: "0971000001", whatsapp: "0971000001", serviceId: "svc1", qty: 3, notes: "Birthday poster, black and gold." }, true);
      var b = DB.createOrder({ name: "Mary Phiri (DEMO)", phone: "0971000002", serviceId: "svc10", qty: 1, notes: "Logo for a bakery." }, true);
      DB.setStatus(b.orderNumber, "IN PROGRESS"); DB.createInvoice(b.orderNumber); DB.recordPayment(b.orderNumber, 50);
    },
    clearDemo: function () {
      var d = data();
      ["orders", "customers", "invoices", "receipts", "payments", "notifications"].forEach(function (k) {
        d[k] = d[k].filter(function (x) { return !x.demo; });
      });
      save();
    }
  };

  // ---------- shared helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return DB.settings().currency + Number(n).toLocaleString("en-US"); }
  function intl(num) { var d = String(num).replace(/\D/g, ""); return d.indexOf("260") === 0 ? d : "260" + d.replace(/^0/, ""); }
  function wa(msg, num) { return "https://wa.me/" + intl(num || DB.settings().whatsapp) + "?text=" + encodeURIComponent(msg); }
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  function inRange(iso, r, from, to) {
    if (!r || r === "all") return true;
    var d = new Date(iso), n = new Date(), s;
    if (r === "custom") {
      if (from && d < new Date(from + "T00:00:00")) return false;
      if (to && d > new Date(to + "T23:59:59")) return false;
      return true;
    }
    if (r === "today") s = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    else if (r === "week") s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7));
    else if (r === "month") s = new Date(n.getFullYear(), n.getMonth(), 1);
    else s = new Date(n.getFullYear(), 0, 1);
    return d >= s;
  }
  function badge(s) { return '<span class="badge s-' + String(s).replace(/ /g, "") + '">' + esc(s) + "</span>"; }
  w.CPZ = { DB: DB, STATUSES: STATUSES, esc: esc, money: money, wa: wa, fmtDate: fmtDate, inRange: inRange, badge: badge,
    $: function (id) { return document.getElementById(id); } };
})(window);
