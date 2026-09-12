import { z } from "zod";

const validatedEmail = z.string().email();

/**
 * Keep Zod's email validation at execution time without advertising its
 * lookaround pattern, which Astra rejects for the entire tool catalog (#1164).
 */
export const agentEmailSchema = z.string().refine(
  (value) => validatedEmail.safeParse(value).success,
  { message: "Invalid email address" },
);
