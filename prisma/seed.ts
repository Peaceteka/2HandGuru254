/**
 * Development seed: wipes the database and creates demo users, categories, listings and
 * orders in every escrow state. Orders are driven through the real escrow service in
 * M-Pesa mock mode, so the ledger is consistent. Run with: npm run db:seed
 */
import path from "path";
import sharp from "sharp";
import bcrypt from "bcryptjs";

process.env.MPESA_MODE = "mock";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function wrap(text: string, max = 22) {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
/** Labelled placeholder photo (title + category + logo) so seeded listings are recognisable. */
async function placeholderImage(title: string, label: string, color: string, variant = 0) {
  const w = 800, h = 600;
  const lines = wrap(title);
  const y0 = h / 2 - (lines.length - 1) * 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="${variant % 2}" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="60" y="70" width="${w - 120}" height="${h - 140}" rx="28" fill="#ffffff" fill-opacity="0.75" stroke="#111111" stroke-opacity="0.08"/>
    <text x="50%" y="125" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="700" fill="#1e6fd9">${esc(label.toUpperCase())}</text>
    ${lines.map((l, i) => `<text x="50%" y="${y0 + i * 56}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" font-weight="800" fill="#111111">${esc(l)}</text>`).join("")}
    <text x="50%" y="${h - 100}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#555555">${variant ? `Photo ${variant + 1}` : "Demo photo"} · 2ndHandGuru</text>
  </svg>`;
  const logo = await sharp(path.join(process.cwd(), "public", "logo.webp")).resize(110, 110).toBuffer();
  return sharp(Buffer.from(svg)).composite([{ input: logo, top: h - 140, left: w - 150 }]).jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { storage } = await import("../src/lib/storage");
  const escrow = await import("../src/lib/escrow");
  const { mockStkCallback } = await import("../src/lib/mpesa");

  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to wipe a production database. Set SEED_FORCE=1 to override.");
  }

  console.log("Clearing tables…");
  await db.$transaction([
    db.ledgerEntry.deleteMany(), db.ledgerTransaction.deleteMany(), db.disputeEvidence.deleteMany(), db.dispute.deleteMany(),
    db.payout.deleteMany(), db.payment.deleteMany(), db.orderEvent.deleteMany(), db.order.deleteMany(), db.mpesaCallbackLog.deleteMany(),
    db.savedItem.deleteMany(), db.listingImage.deleteMany(), db.listing.deleteMany(), db.category.deleteMany(),
    db.notification.deleteMany(), db.auditLog.deleteMany(), db.passwordResetToken.deleteMany(), db.sellerProfile.deleteMany(),
    db.user.deleteMany(), db.setting.deleteMany(), db.rateLimit.deleteMany(),
  ]);

  const pw = await bcrypt.hash("Password123", 12);
  const adminPw = await bcrypt.hash("Admin@12345", 12);
  const store = storage();
  const putImage = async (key: string, color: string, title = "Photo", label = "2ndHandGuru", variant = 0) => {
    await store.put(key, await placeholderImage(title, label, color, variant), "image/jpeg");
    return key;
  };

  // --- Users -----------------------------------------------------------------------------
  const admin = await db.user.create({ data: { name: "Grace Admin", email: "admin@2ndhandguru.co.ke", phone: "254700000001", passwordHash: adminPw, role: "ADMIN", county: "Nairobi" } });

  const platform = await db.user.create({
    data: {
      name: "2ndHandGuru Official", email: "store@2ndhandguru.co.ke", phone: "254700000002",
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 12), role: "SELLER", county: "Nairobi", mpesaPayoutPhone: "254700000002",
    },
  });
  await db.sellerProfile.create({
    data: {
      userId: platform.id, fullName: "2ndHandGuru Ltd", phone: "254700000002", idNumber: "PLATFORM", businessName: "2ndHandGuru Official",
      county: "Nairobi", town: "Westlands", description: "Certified pre-owned items inspected and sold directly by 2ndHandGuru.",
      idPhotoKey: await putImage(`private/ids/${platform.id}/id.jpg`, "#dddddd", "Company registration", "Document"), status: "APPROVED", isPlatform: true, reviewedById: admin.id, reviewedAt: new Date(),
    },
  });

  const sellerDefs = [
    { name: "Brian Otieno", email: "brian@example.com", phone: "254711000001", business: "Otieno Gadgets", county: "Nairobi", town: "CBD", desc: "Quality used phones and laptops, all tested before sale. Based in Nairobi CBD." },
    { name: "Wanjiku Kamau", email: "wanjiku@example.com", phone: "254711000002", business: "Shiku Home & Living", county: "Kiambu", town: "Ruiru", desc: "Pre-loved furniture and home items in great condition. Delivery within Nairobi metro." },
    { name: "Hassan Ali", email: "hassan@example.com", phone: "254711000003", business: null, county: "Mombasa", town: "Nyali", desc: "Selling my family's gently used items — electronics, baby gear and sports equipment." },
  ];
  const sellers: Awaited<ReturnType<typeof db.user.create>>[] = [];
  for (const s of sellerDefs) {
    const u = await db.user.create({ data: { name: s.name, email: s.email, phone: s.phone, passwordHash: pw, role: "SELLER", county: s.county, mpesaPayoutPhone: s.phone } });
    await db.sellerProfile.create({
      data: {
        userId: u.id, fullName: s.name, phone: s.phone, idNumber: String(20000000 + sellers.length * 1111111), businessName: s.business,
        county: s.county, town: s.town, description: s.desc, idPhotoKey: await putImage(`private/ids/${u.id}/id.jpg`, "#c9d6e8", `National ID — ${s.name}`, "ID document"),
        status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date(),
      },
    });
    sellers.push(u);
  }

  const pending = await db.user.create({ data: { name: "Peter Mwangi", email: "peter@example.com", phone: "254711000004", passwordHash: pw, role: "BUYER", county: "Nakuru" } });
  await db.sellerProfile.create({
    data: {
      userId: pending.id, fullName: "Peter Mwangi Njoroge", phone: "254711000004", idNumber: "31234567", businessName: "Mwangi Motors Spares",
      county: "Nakuru", town: "Nakuru Town", description: "Used car parts and accessories sourced from trusted garages in Nakuru.",
      idPhotoKey: await putImage(`private/ids/${pending.id}/id.jpg`, "#e8d9c9", "National ID — Peter Mwangi", "ID document"), status: "PENDING",
    },
  });

  const buyers: Awaited<ReturnType<typeof db.user.create>>[] = [];
  for (const [i, b] of [["Amina Yusuf", "amina@example.com"], ["Kevin Kiprop", "kevin@example.com"]].entries()) {
    // 254708374149 is the Daraja sandbox test MSISDN
    buyers.push(await db.user.create({ data: { name: b[0], email: b[1], phone: i === 0 ? "254708374149" : "254722000002", passwordHash: pw, role: "BUYER", county: i === 0 ? "Nairobi" : "Uasin Gishu" } }));
  }

  // --- Categories ------------------------------------------------------------------------
  const catDefs = [
    ["Phones & Tablets", "phones-tablets", "smartphone", "#cfe0f7"], ["Computers & Laptops", "computers", "laptop", "#d9d4f2"],
    ["TV, Audio & Electronics", "electronics", "tv", "#d2ecf0"], ["Furniture & Home", "furniture-home", "armchair", "#f2e3cf"],
    ["Fashion", "fashion", "shirt", "#f5d6dc"], ["Vehicles & Parts", "vehicles", "car", "#dcdcdc"],
    ["Baby & Kids", "baby-kids", "baby", "#fdf0c4"], ["Sports & Outdoors", "sports", "dumbbell", "#d4eed9"],
  ] as const;
  const cats: Record<string, { id: string; color: string }> = {};
  const catNames: Record<string, string> = Object.fromEntries(catDefs.map(([n, slug]) => [slug, n]));
  for (const [i, [name, slug, icon, color]] of catDefs.entries()) {
    const c = await db.category.create({ data: { name, slug, icon, sortOrder: i, description: `Second-hand ${name.toLowerCase()} from verified sellers.` } });
    cats[slug] = { id: c.id, color };
  }

  // --- Listings (25) ---------------------------------------------------------------------
  type L = [title: string, cat: string, price: number, cond: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "FOR_PARTS", sellerIdx: number, featured?: boolean];
  const listingDefs: L[] = [
    ["iPhone 12, 128GB, Blue — battery 87%", "phones-tablets", 42000, "GOOD", 0, true],
    ["Samsung Galaxy A52, 6GB/128GB", "phones-tablets", 21500, "GOOD", 0],
    ["iPad 9th Gen 64GB Wi-Fi with case", "phones-tablets", 33000, "LIKE_NEW", 0, true],
    ["Tecno Camon 19 Pro, boxed", "phones-tablets", 17500, "LIKE_NEW", 0],
    ["HP EliteBook 840 G5, i5, 16GB RAM, 256GB SSD", "computers", 38500, "GOOD", 0, true],
    ["MacBook Air M1 2020, 8GB/256GB", "computers", 85000, "LIKE_NEW", 0],
    ["Dell 24\" monitor P2419H", "computers", 14000, "GOOD", 0],
    ["Lenovo ThinkPad T470 for parts (no display)", "computers", 6500, "FOR_PARTS", 0],
    ["Hisense 43\" Smart TV, with remote", "electronics", 24000, "GOOD", 2],
    ["Sony soundbar HT-S100F", "electronics", 9500, "LIKE_NEW", 2],
    ["PlayStation 4 Slim 500GB + 2 pads", "electronics", 28000, "GOOD", 2, true],
    ["5-seater L-shaped sofa, grey fabric", "furniture-home", 45000, "GOOD", 1, true],
    ["Mahogany dining table with 6 chairs", "furniture-home", 52000, "FAIR", 1],
    ["Ramtons fridge 138L, works perfectly", "furniture-home", 17000, "GOOD", 1],
    ["Queen bed frame with orthopaedic mattress", "furniture-home", 26000, "GOOD", 1],
    ["Office swivel chair, ergonomic", "furniture-home", 7500, "LIKE_NEW", 1],
    ["Men's leather jacket, size L", "fashion", 4500, "LIKE_NEW", 1],
    ["Nike Air Force 1, size 42", "fashion", 5500, "GOOD", 2],
    ["Toyota Fielder side mirror (left), genuine", "vehicles", 3800, "GOOD", 2],
    ["Set of 4 alloy rims 15\"", "vehicles", 30000, "FAIR", 2],
    ["Chicco baby stroller, foldable", "baby-kids", 9000, "GOOD", 2],
    ["Baby cot with mattress", "baby-kids", 8500, "GOOD", 1],
    ["Mountain bike 26\", 21 speed", "sports", 16000, "GOOD", 2, true],
    ["Adjustable dumbbell set 20kg", "sports", 6000, "LIKE_NEW", 2],
    ["Certified refurbished Samsung Galaxy S21 (inspected by 2ndHandGuru)", "phones-tablets", 48000, "LIKE_NEW", -1, true],
  ];
  const listings: Awaited<ReturnType<typeof db.listing.create>>[] = [];
  for (const [i, [title, cat, price, condition, sIdx, featured]] of listingDefs.entries()) {
    const seller = sIdx === -1 ? platform : sellers[sIdx];
    const seller_county = sIdx === -1 ? "Nairobi" : sellerDefs[sIdx].county;
    const l = await db.listing.create({
      data: {
        title, price, condition, featured: !!featured, categoryId: cats[cat].id, sellerId: seller.id, county: seller_county,
        town: sIdx === -1 ? "Westlands" : sellerDefs[sIdx].town, status: "ACTIVE",
        description: `${title}. Well maintained and ready to use. Viewing possible before dispatch for Nairobi buyers; otherwise shipped via courier after payment is held in escrow. Message via order page after purchase.`,
        createdAt: new Date(Date.now() - i * 3_600_000 * 7),
      },
    });
    const n = 1 + (i % 3);
    for (let p = 0; p < n; p++) {
      await db.listingImage.create({ data: { listingId: l.id, position: p, key: await putImage(`listings/${seller.id}/seed-${l.id}-${p}.jpg`, cats[cat].color, title, catNames[cat], p) } });
    }
    listings.push(l);
  }
  await db.listing.update({ where: { id: listings[7].id }, data: { status: "DRAFT" } });
  await db.listing.update({ where: { id: listings[16].id }, data: { status: "HIDDEN" } });

  // --- Orders in every escrow state ------------------------------------------------------
  const delivery = { deliveryCounty: "Nairobi", deliveryTown: "Kilimani", deliveryAddress: "Argwings Kodhek Rd, Kilimani Court Apt 4B", deliveryNotes: "Call on arrival" };
  const sellerOf = (l: (typeof listings)[number]) => l.sellerId;
  async function paid(listingIdx: number, buyer = buyers[0]) {
    const order = await escrow.createOrder({ buyerId: buyer.id, listingId: listings[listingIdx].id, buyerPhone: buyer.phone, ...delivery });
    await escrow.initiatePayment(order.id, buyer.id, buyer.phone);
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
    await escrow.handleStkCallback(mockStkCallback(payment.checkoutRequestId!, payment.amount, payment.phone, true), "seed");
    return order;
  }
  const dispatch = (o: { id: string }, l: number) => escrow.markDispatched(o.id, sellerOf(listings[l]), "G4S Courier", "Waybill G4S-NRB-" + (10000 + l));
  const hours = (h: number) => new Date(Date.now() - h * 3_600_000);

  // PENDING_PAYMENT
  const pendingOrder = await escrow.createOrder({ buyerId: buyers[1].id, listingId: listings[1].id, buyerPhone: buyers[1].phone, ...delivery });
  await escrow.initiatePayment(pendingOrder.id, buyers[1].id, buyers[1].phone);
  // PAID_HELD (within window) and PAID_HELD (dispatch deadline passed → buyer may cancel)
  await paid(3);
  const overdue = await paid(13, buyers[1]);
  await db.order.update({ where: { id: overdue.id }, data: { paidAt: hours(80), dispatchDeadline: hours(8) } });
  // DISPATCHED (normal) and DISPATCHED past auto-release (picked up by the scheduler)
  const d1 = await paid(9); await dispatch(d1, 9);
  const d2 = await paid(20, buyers[1]); await dispatch(d2, 20);
  await db.order.update({ where: { id: d2.id }, data: { dispatchedAt: hours(24 * 6), autoReleaseAt: hours(24) } });
  // DELIVERED_CONFIRMED (confirmed, payout awaiting manual release)
  const dc = await paid(15); await dispatch(dc, 15);
  await db.$transaction([
    db.order.update({ where: { id: dc.id }, data: { status: "DELIVERED_CONFIRMED", deliveredAt: new Date() } }),
    db.orderEvent.create({ data: { orderId: dc.id, fromStatus: "DISPATCHED", toStatus: "DELIVERED_CONFIRMED", actorId: buyers[0].id, note: "Buyer confirmed receipt (seeded; release pending)" } }),
  ]);
  // RELEASED (buyer confirmed → B2C payout)
  const r1 = await paid(4, buyers[1]); await dispatch(r1, 4); await escrow.confirmReceipt(r1.id, buyers[1].id);
  const r2 = await paid(17); await dispatch(r2, 17); await escrow.confirmReceipt(r2.id, buyers[0].id);
  // DISPUTED (open)
  const disp = await paid(6); await dispatch(disp, 6);
  await escrow.openDispute({ orderId: disp.id, buyerId: buyers[0].id, reason: "NOT_AS_DESCRIBED", note: "The monitor has a dead-pixel line across the top which wasn't mentioned in the listing.", imageKeys: [await putImage(`private/disputes/${disp.id}/e1.jpg`, "#f0c8c8", "Dead-pixel line on screen", "Buyer evidence")] });
  const dispute = await db.dispute.findUniqueOrThrow({ where: { orderId: disp.id } });
  await escrow.addDisputeEvidence(dispute.id, sellerOf(listings[6]), "The monitor was tested before dispatch, see photo of it working at my shop.", []);
  // REFUNDED (dispute resolved for buyer)
  const ref = await paid(19, buyers[1]); await dispatch(ref, 19);
  await escrow.openDispute({ orderId: ref.id, buyerId: buyers[1].id, reason: "NOT_RECEIVED", note: "Courier says the parcel was never handed over to them by the seller.", imageKeys: [] });
  const refDispute = await db.dispute.findUniqueOrThrow({ where: { orderId: ref.id } });
  await escrow.resolveDispute(refDispute.id, admin.id, "REFUND", "Courier confirmed no parcel was received; refunding buyer in full.");
  // CANCELLED (buyer cancelled before paying)
  const cancelled = await escrow.createOrder({ buyerId: buyers[0].id, listingId: listings[10].id, buyerPhone: buyers[0].phone, ...delivery });
  await escrow.cancelOrder(cancelled.id, buyers[0].id, "Changed my mind before paying");

  await db.savedItem.createMany({ data: [listings[0], listings[5], listings[11]].map((l) => ({ userId: buyers[0].id, listingId: l.id })) });
  await db.auditLog.create({ data: { actorId: admin.id, action: "seed.run", entityType: "System", entityId: "seed", details: { note: "Demo data created" } } });

  const counts = await db.order.groupBy({ by: ["status"], _count: true });
  console.log("Orders:", Object.fromEntries(counts.map((c) => [c.status, c._count])));
  console.log(`Seeded ${await db.user.count()} users, ${await db.category.count()} categories, ${await db.listing.count()} listings.`);
  console.log("\nLogins (password Password123 unless noted):\n  admin@2ndhandguru.co.ke / Admin@12345\n  brian@example.com, wanjiku@example.com, hassan@example.com  (approved sellers)\n  peter@example.com  (pending seller)\n  amina@example.com, kevin@example.com  (buyers)");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
