import { Channel } from "../../models/Channel.js";

export async function seedChannels(): Promise<void> {
  const existing = await Channel.countDocuments();
  if (existing > 0) {
    console.log("[seed] Canales ya sembrados, se omite el seed.");
    return;
  }

  await Channel.insertMany([
    {
      name: "StarProfesional",
      slug: "star-profesional",
      bodegas: ["01", "06"],
    },
    {
      name: "StarBoutique",
      slug: "star-boutique",
      bodegas: ["03"],
    },
  ]);

  console.log("[seed] Canales sembrados correctamente.");
}
