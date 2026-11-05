import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

type Workspace = {
  question: string | null;
  prepareQuestion: (text: string) => void;
  dismissQuestion: () => void;
};
const Context = createContext<Workspace | null>(null);
export const useNativeWorkspace = () => useContext(Context);

/** Prepared material questions survive navigation but never send automatically. */
export function NativeWorkspaceProvider({ children }: { children: ReactNode }) {
  const [question, setQuestion] = useState<string | null>(null);
  const router = useRouter();
  return <Context.Provider value={{ question, dismissQuestion: () => setQuestion(null), prepareQuestion: text => {
    setQuestion(text);
    router.navigate("/chat");
  } }}>{children}</Context.Provider>;
}
