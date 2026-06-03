import "dotenv/config";
import { connectDB } from "../../config/index.js";
import { Channel, type IChannelSettings } from "../../models/Channel.js";

// Ajustes de negocio por canal, identificados por slug.
const SETTINGS_BY_SLUG: Record<string, IChannelSettings> = {
  "star-profesional": {
    brandName: "Star Professional",
    whatsapp: "573123924999",
    email: "servicioalcliente@importadorastar.com",
    social: {
      facebook: "https://www.facebook.com/starprofessionaloficial/",
      instagram: "https://www.instagram.com/starprofessionaloficial/",
      tiktok: "https://www.tiktok.com/@starprofessional",
    },
    addresses: [
      {
        city: "Bogotá",
        address: "Cra. 21 #8-42",
        mapUrl:
          "https://www.google.com/maps/search/?api=1&query=Cra.+21+%238-42,+Bogotá",
      },
      {
        city: "Medellín",
        address: "CL. 53 # 42 - 25",
        mapUrl:
          "https://www.google.com/maps/search/?api=1&query=CL.+53+%23+42+-+25,+Medellin",
      },
      {
        city: "Valledupar",
        address: "CL. 16 # 8 - 37 Edificio Canaima",
        mapUrl:
          "https://www.google.com/maps/search/?api=1&query=CL.+16+%23+8+-+37+Edificio+Canaima,+Valledupar",
      },
    ],
    about: {
      quienesSomos:
        "Star Professional es una empresa consolidada desde hace 10 años (2024), encargada de importar, distribuir y comercializar a nivel nacional artículos y accesorios del sector belleza, cubriendo un alto porcentaje de distribuidores y peluquerías en todo el país. Nos caracteriza el servicio al cliente, enfocados en buscar la mejor calidad, tecnología e innovación con precios competitivos para todos nuestros clientes y aliados.",
      mision:
        "Distribuir y comercializar artículos de belleza de alta calidad generando una experiencia de marca única en todos nuestros canales de venta, logrando alcanzar la fidelización del consumidor final.",
      vision:
        "Posicionarnos como la marca preferida de los consumidores de belleza en Colombia, estableciendo procesos de experiencia de marca única servicio y atención oportuna al cliente que lleve a mantenernos como una empresa competitiva, innovadora y eficiente.",
      valores: ["Compromiso", "Innovación", "Liderazgo", "Trabajo en equipo"],
    },
  },
  "star-boutique": {
    brandName: "Star Boutique",
    whatsapp: "573163744425",
    email: "",
    social: {
      facebook: "https://www.facebook.com/share/1D4atWQoav/?mibextid=wwXIfr",
      instagram:
        "https://www.instagram.com/starboutiquecosmetics?igsh=N2dmNjg0cTVvdzJn",
      tiktok:
        "https://www.tiktok.com/@starboutiquecosmetics?_r=1&_t=ZS-96MZ4uOC5cV",
    },
    addresses: [
      {
        city: "Valledupar",
        address: "Calle 17 #12 – 74",
        mapUrl:
          "https://www.google.com/maps/search/?api=1&query=Calle+17+%2312+-+74,+Valledupar",
      },
    ],
    about: {
      quienesSomos:
        "Star Boutique nació para ser el lugar al que vuelves cuando quieres encontrar variedad, buen precio y alguien que te ayude a elegir bien. Somos un espacio multimarca de belleza pensado para quienes disfrutan explorar, comparar y descubrir productos nuevos sin tener que ir de un lado a otro. Aquí conviven distintas marcas y líneas. Lo que nos define no es solo lo que tenemos en los estantes, sino cómo te acompañamos mientras decides. Creemos que una buena compra empieza con información clara, opciones y una atención que no te abruma. Cada persona que entra tiene una necesidad distinta, y ese detalle nos importa.",
      mision:
        "Brindamos un espacio de belleza que integra variedad de marcas, precios accesibles y atención personalizada, creando una experiencia cercana que facilita cada elección y transforma cada visita en un momento especial.",
      vision:
        "Ser un centro de experiencia en belleza reconocido por integrar variedad, precios accesibles y atención personalizada, consolidándose como un espacio cercano y diferencial donde cada elección se convierta en una experiencia única.",
      valores: [
        "Cercanía",
        "Variedad",
        "Accesibilidad",
        "Honestidad",
        "Experiencia",
      ],
    },
  },
};

export async function seedChannelSettings() {
  let updated = 0;
  for (const [slug, settings] of Object.entries(SETTINGS_BY_SLUG)) {
    const res = await Channel.updateOne(
      { slug },
      { $set: { settings } }
    );
    if (res.matchedCount > 0) updated += 1;
    else console.warn(`[seed] Canal con slug "${slug}" no encontrado.`);
  }
  console.log(`[seed] ChannelSettings: ${updated} canal(es) actualizado(s).`);
}

// Script standalone: npx tsx src/db/seed/channelSettings.ts
if (process.argv[1]?.includes("channelSettings")) {
  (async () => {
    await connectDB();
    await seedChannelSettings();
    process.exit(0);
  })();
}
