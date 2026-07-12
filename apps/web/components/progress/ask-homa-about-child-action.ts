export async function focusChildThenOpenChat(
  childId: string,
  dependencies: {
    setViewContext(childId: string): Promise<void>;
    navigate(href: "/app"): void;
  },
): Promise<void> {
  await dependencies.setViewContext(childId);
  dependencies.navigate("/app");
}
