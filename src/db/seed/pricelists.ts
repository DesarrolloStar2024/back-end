import "dotenv/config";
import { connectDB } from "../../config/index.js";
import { PriceList } from "../../models/PriceList.js";
import { Channel } from "../../models/Channel.js";

const LISTS = [
  {
    slug: "6",
    name: "PVP",
    description: "Lista de precio al público — visible sin login",
    tiers: [{ priceField: "PVP" }],
    isActive: true,
    isDefault: true,
    order: 0,
    beforePriceField: null,
  },
  {
    slug: "1",
    name: "UNIDAD",
    description: "Lista de precio por unidad",
    tiers: [{ priceField: "PVP" }, { priceField: "UNIDAD" }],
    isActive: true,
    isDefault: false,
    order: 1,
    beforePriceField: null,
  },
  {
    slug: "2",
    name: "EMPRENDEDOR",
    description: "Lista de precio emprendedor",
    tiers: [{ priceField: "PVP" }, { priceField: "UNIDAD" }, { priceField: "EMPRENDEDOR" }],
    isActive: true,
    isDefault: false,
    order: 2,
    beforePriceField: null,
  },
  {
    slug: "3",
    name: "DISTRIBUIDOR",
    description: "Lista de precio distribuidor",
    tiers: [{ priceField: "PVP" }, { priceField: "UNIDAD" }, { priceField: "EMPRENDEDOR" }, { priceField: "DISTRIBUIDOR" }],
    isActive: true,
    isDefault: false,
    order: 3,
    beforePriceField: null,
  },
];

const KEEP_SLUGS = LISTS.map((l) => l.slug);

export async function seedPriceLists() {
  // Todas estas listas son compartidas en todos los canales:
  // se asignan explícitamente los IDs de todos los canales existentes.
  const channels = await Channel.find({}, { _id: 1 }).lean();
  const channelIds = channels.map((ch) => String(ch._id));

  for (const list of LISTS) {
    await PriceList.updateOne(
      { slug: list.slug },
      { $set: { ...list, channelIds } },
      { upsert: true }
    );
  }

  // Elimina listas que ya no están en el seed
  const deleted = await PriceList.deleteMany({ slug: { $nin: KEEP_SLUGS } });
  if (deleted.deletedCount > 0) {
    console.log(`[seed] PriceLists: ${deleted.deletedCount} lista(s) obsoleta(s) eliminada(s)`);
  }

  console.log(`[seed] PriceLists: ${LISTS.length} listas verificadas/actualizadas`);
}

// Script standalone: npx tsx src/db/seed/pricelists.ts
if (process.argv[1]?.includes("pricelists")) {
  (async () => {
    await connectDB();
    await seedPriceLists();
    process.exit(0);
  })();
}
