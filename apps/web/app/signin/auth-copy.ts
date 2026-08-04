const SIGN_IN_ERROR_COPY = {
  oauth: "We couldn't sign you in with Google. Try again, or use email and password.",
} as const;

export function signInErrorMessage(error: string | null | undefined): string | null {
  return error === "oauth" ? SIGN_IN_ERROR_COPY.oauth : null;
}
