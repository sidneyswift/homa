/** Only the external auth boundary is replaced. Product delivery/feed hooks,
 * browser storage and composer components are the real application modules. */
const userId = "00000000-0000-4000-8000-000000000002";
type Session = { user: { id: string }; access_token: string } | null;
let session: Session = localStorage.getItem("fixture-signed-out") ? null : { user: { id: userId }, access_token: "fixture-adult-token" };
const listeners = new Set<(event: string, session: Session) => void>();
const authChannel = new BroadcastChannel("fixture-auth");
function update(next: Session, broadcast: boolean) {
  session = next;
  if (next) localStorage.removeItem("fixture-signed-out"); else localStorage.setItem("fixture-signed-out", "1");
  for (const listener of listeners) listener(next ? "SIGNED_IN" : "SIGNED_OUT", next);
  if (broadcast) authChannel.postMessage(next);
}
window.addEventListener("fixture-auth", event => update((event as CustomEvent<Session>).detail, true));
authChannel.onmessage = event => update(event.data, false);
const client = { auth: {
  getSession: async () => ({ data: { session }, error: null }),
  getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
  onAuthStateChange(callback: (event: string, session: Session) => void) {
    listeners.add(callback); queueMicrotask(() => callback("INITIAL_SESSION", session));
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  },
} };
export function createSupabaseBrowserClient() { return client; }
