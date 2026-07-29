import { ThinkingMark } from "../../components/brand/ThinkingMark";

/**
 * The in-frame loading state: while a page inside the app frame streams
 * in, the sidebar and top bar hold still and the main column shows the
 * waking mark (same treatment as chat's thinking bubble; goes still
 * under reduced motion via the shared CSS). A page load is short, so it
 * keeps the calm opening mood rather than escalating.
 */
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-[60dvh] items-center justify-center"
    >
      <ThinkingMark size={28} />
    </div>
  );
}
