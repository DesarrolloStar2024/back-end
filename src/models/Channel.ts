import mongoose, { Schema, Document } from "mongoose";

export interface IChannelAddress {
  city: string;
  address: string;
  mapUrl?: string;
}

export interface IChannelSettings {
  brandName?: string;
  whatsapp?: string; // formato wa.me, solo dígitos (ej. 573123924999)
  email?: string;
  social?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
  };
  addresses?: IChannelAddress[];
  about?: {
    quienesSomos?: string;
    mision?: string;
    vision?: string;
    valores?: string[];
  };
}

export interface IChannel extends Document {
  name: string;
  slug: string;
  bodegas: string[];
  marcas: string[];
  settings?: IChannelSettings;
  createdAt?: Date;
}

const AddressSchema = new Schema<IChannelAddress>(
  {
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    mapUrl: { type: String, default: "" },
  },
  { _id: false }
);

const SettingsSchema = new Schema<IChannelSettings>(
  {
    brandName: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    social: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
    addresses: { type: [AddressSchema], default: [] },
    about: {
      quienesSomos: { type: String, default: "" },
      mision: { type: String, default: "" },
      vision: { type: String, default: "" },
      valores: { type: [String], default: [] },
    },
  },
  { _id: false }
);

const ChannelSchema = new Schema<IChannel>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bodegas: { type: [String], required: true },
    marcas: { type: [String], default: [] },
    settings: { type: SettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// slug unique index already declared via `unique: true` on the field

export const Channel =
  mongoose.models.Channel || mongoose.model<IChannel>("Channel", ChannelSchema);
