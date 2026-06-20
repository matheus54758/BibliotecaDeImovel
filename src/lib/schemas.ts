import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const builderSchema = z.object({
  name: z.string().min(3, "Company name is required"),
  cnpj: z.string().min(14, "Invalid CNPJ").max(18),
  specialization: z.string().min(1, "Please select a specialization"),
  email: z.string().email("Invalid corporate email"),
  phone: z.string().min(10, "Invalid phone number"),
  address: z.string().min(5, "Address is required"),
  city: z.string().nullable().optional(),
  logo_url: z.string().url("Logo must be a valid URL").nullable().optional().or(z.literal("")),
});

export const developmentSchema = z.object({
  builder_id: z.string().uuid("Please select a construction partner").nullable().optional().or(z.literal("")),
  title: z.string().min(3, "Project title is required"),
  location: z.string().optional().or(z.literal("")),
  street: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  price_starting_at: z.coerce.number().nonnegative().default(0),
  status: z.enum(["available", "pre_launch", "under_construction", "reserved", "sold"]).default("available"),
  description: z.string().nullable().or(z.literal("")),
  hero_image_url: z.string().url("Hero image must be a valid URL").nullable().optional().or(z.literal("")),
  floor_plan_url: z.array(z.string().url()).nullable().default([]),
  floor_layout_url: z.array(z.string().url()).nullable().default([]),
  ebook_url: z.array(z.string().url()).nullable().default([]),
  video_url: z.array(z.string().url()).nullable().default([]),
  sq_ft: z.coerce.number().nonnegative().default(0),
  bedrooms: z.coerce.number().nonnegative().default(0),
  bathrooms: z.coerce.number().nonnegative().default(0),
  parking_spaces: z.coerce.number().nonnegative().default(0),
  has_garage: z.boolean().default(false),
  near_beach: z.boolean().default(false),
  has_deed: z.boolean().default(false),
  is_penthouse: z.boolean().default(false),
  has_balcony_grill: z.boolean().default(false),
  is_furnished: z.boolean().default(false),
  has_sea_view: z.boolean().default(false),
  is_pet_friendly: z.boolean().default(false),
  has_complete_leisure: z.boolean().default(false),
  has_automation: z.boolean().default(false),
  type: z.string().optional().or(z.literal("")),
  payment_entry: z.coerce.number().nonnegative().nullable().default(0),
  payment_installment_value: z.coerce.number().nonnegative().nullable().default(0),
  payment_installment_count: z.coerce.number().nonnegative().nullable().default(0),
  payment_reinforcement_value: z.coerce.number().nonnegative().nullable().default(0),
  payment_reinforcement_count: z.coerce.number().nonnegative().nullable().default(0),
  payment_post_construction: z.coerce.number().nonnegative().nullable().default(0),
  parent_id: z.string().uuid().nullable().optional(),
  cub_monthly_rate: z.coerce.number().nullable().default(0),
  months_until_keys: z.coerce.number().nonnegative().nullable().default(0),
  sale_value_after_keys: z.coerce.number().nonnegative().nullable().default(0),
  rent_seasonal: z.coerce.number().nonnegative().nullable().default(0),
  rent_annual: z.coerce.number().nonnegative().nullable().default(0),
  roi_appreciation_1y: z.coerce.number().nullable().default(0),
  roi_appreciation_2y: z.coerce.number().nullable().default(0),
  roi_appreciation_3y: z.coerce.number().nullable().default(0),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type BuilderInput = z.infer<typeof builderSchema>;
export type DevelopmentInput = z.infer<typeof developmentSchema>;
