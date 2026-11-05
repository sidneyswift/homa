import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";

import { signInWithApple } from "../../src/features/auth/apple-sign-in";
import { supabase } from "../../src/lib/supabase";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(), formatFullName: jest.fn(() => "Alex Parent"),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { signInWithIdToken: jest.fn(), updateUser: jest.fn() } },
}));

beforeEach(() => {
  jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
    user: "apple-account", identityToken: "fixture", fullName: { givenName: "Alex", familyName: "Parent" },
  } as AppleAuthentication.AppleAuthenticationCredential);
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({
    data: { user: { user_metadata: {} } }, error: null,
  } as never);
  jest.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as never);
});

test("saves Apple's initial name and clears its account-scoped retry copy only after confirmation", async () => {
  expect(await signInWithApple()).toEqual({ status: "signed-in" });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("homa.apple-profile:apple-account", "Alex Parent");
  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { full_name: "Alex Parent" } });
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith("homa.apple-profile:apple-account");
});

test("keeps the one-time name on a failed save without failing established authentication", async () => {
  jest.mocked(supabase.auth.updateUser).mockResolvedValue({ error: { message: "offline" } } as never);
  expect(await signInWithApple()).toEqual({ status: "signed-in" });
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

test("retries the saved name when Apple no longer supplies it", async () => {
  jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
    user: "apple-account", identityToken: "fixture", fullName: null,
  } as AppleAuthentication.AppleAuthenticationCredential);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue("Alex Parent");
  expect(await signInWithApple()).toEqual({ status: "signed-in" });
  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { full_name: "Alex Parent" } });
});

test("does not overwrite an existing chosen profile name", async () => {
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({
    data: { user: { user_metadata: { full_name: "My chosen name" } } }, error: null,
  } as never);
  await signInWithApple();
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
});
