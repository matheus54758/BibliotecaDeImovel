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
  city: z.string().optional(),
  logo_url: z.string().url("Logo must be a valid URL").optional().or(z.literal("")),
});

export const developmentSchema = z.object({
  builder_id: z.string().uuid("Please select a construction partner"),
  title: z.string().min(3, "Project title is required"),
  location: z.string().min(3, "Location is required"),
  price_starting_at: z.coerce.number().positive("Price must be greater than 0"),
  status: z.enum(["available", "pre_launch", "under_construction"]),
  description: z.string().min(10, "Description must be more detailed"),
  hero_image_url: z.string().url("Hero image must be a valid URL"),
  sq_ft: z.coerce.number().positive("Area is required"),
  bedrooms: z.coerce.number().nonnegative(),
  bathrooms: z.coerce.number().nonnegative(),
  parking_spaces: z.coerce.number().nonnegative(),
  has_garage: z.boolean().default(false),
  near_beach: z.boolean().default(false),
  has_deed: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type BuilderInput = z.infer<typeof builderSchema>;
export type DevelopmentInput = z.infer<typeof developmentSchema>;
