import { Logo } from "../../components/brand/Logo";

/**
 * The in-frame loading state: while a page inside the app frame streams
 * in, the sidebar and top bar hold still and the main column shows the
 * bobbing mark (same treatment as chat's thinking bubble; goes still
 * under reduced motion via the shared CSS).
 */
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-[60dvh] items-center justify-center"
    >
      <span className="chat-think-mark inline-flex">
        <Logo size={28} variant="mark" />
      </span>
    </div>
  );
}
