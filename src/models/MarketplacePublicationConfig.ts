import mongoose, { Schema, Document } from "mongoose";

// Configuración de publicación a marketplaces (Mercado Libre / Rappi).
// El usuario la crea subiendo un Excel de referencias y eligiendo:
//   - el precio a usar (priceField de product.Precios, o una PriceList)
//   - las bodegas cuyo stock se suma para el marketplace
//   - los destinos (meli / rappi)
// Luego se editan las referencias (agregar / quitar) sobre la misma config.
export type MarketplaceTarget = "meli" | "rappi";

export interface IMarketplacePublicationConfig extends Document {
  name: string;
  slug: string;
  description?: string;
  targets: MarketplaceTarget[];
  priceField?: string | null; // nombre en product.Precios, ej. "MARKETPLACE"
  priceListId?: string | null; // alternativa: ref a PriceList._id
  bodegaIds: string[]; // bodegas que suman el stock publicado, ej. ["01","06"]
  productCodes: string[]; // referencias (Codigo) incluidas
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const MarketplacePublicationConfigSchema =
  new Schema<IMarketplacePublicationConfig>(
    {
      name: { type: String, required: true, trim: true },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      description: { type: String, default: "" },
      targets: {
        type: [String],
        enum: ["meli", "rappi"],
        default: [],
      },
      priceField: { type: String, default: null },
      priceListId: { type: String, default: null },
      bodegaIds: { type: [String], default: [] },
      productCodes: { type: [String], default: [] },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  );

export const MarketplacePublicationConfig =
  mongoose.models.MarketplacePublicationConfig ||
  mongoose.model<IMarketplacePublicationConfig>(
    "MarketplacePublicationConfig",
    MarketplacePublicationConfigSchema
  );
