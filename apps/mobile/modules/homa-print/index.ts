import { requireOptionalNativeModule } from "expo";

export type NativePrintStatus = "completed" | "canceled" | "failed";

export interface NativePrintResult {
  status: NativePrintStatus;
  reason?: string | null;
}

interface NativeHomaPrintModule {
  print(
    uri: string,
    authorization: string,
    title: string,
    pageIndexes: number[],
    requestedCopies: number,
  ): Promise<NativePrintResult>;
}

const nativeModule = requireOptionalNativeModule<NativeHomaPrintModule>("HomaPrint");

export async function printWithSystemSheet(input: {
  uri: string;
  authorization: string;
  title: string;
  pageIndexes: number[];
  requestedCopies: number;
}): Promise<NativePrintResult> {
  if (!nativeModule) return { status: "failed", reason: "printing-unavailable" };
  return nativeModule.print(
    input.uri,
    input.authorization,
    input.title,
    input.pageIndexes,
    input.requestedCopies,
  );
}
