import { Icon } from "../../../components/design/Icon";

export function DeleteFamilyDataCard() {
  return (
    <section className="rounded-lg border border-danger/40 bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-danger/10 p-2 text-danger">
          <Icon name="warning" size={20} />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-strong">
            Delete account and family data
          </h2>
          <p className="mt-1 text-sm leading-6 text-body">
            Account deletion is paused while Homa repairs the final deletion
            step. This pause does not change or expose your family data.
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">
        Need a copy first?{" "}
        <a
          className="font-medium text-brand underline underline-offset-2"
          href="/api/account-deletion/export"
        >
          Download your family record
        </a>
        .
      </p>
      <p className="mt-4 text-sm leading-6 text-body">
        Billing continues unless you cancel it separately in the subscription
        section above.
      </p>
      <p className="mt-4 text-sm leading-6 text-body">
        Need deletion now?{" "}
        <a
          className="font-medium text-brand underline underline-offset-2"
          href="mailto:hello@thankshoma.com?subject=Please%20delete%20my%20family%27s%20data"
        >
          Email Homa to record your request
        </a>
        . We will reply with the next safe step.
      </p>
    </section>
  );
}
