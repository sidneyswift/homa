export function retryProgressPage(dependencies: {
  refresh(): void;
}): void {
  dependencies.refresh();
}
