import { Icon } from "./Icon";

export function QuietTag({
  label,
  selected = false,
  removable = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  removable?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`quiet-tag${selected ? " quiet-tag--selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>{label}</span>
      {removable ? <Icon name="close" size={16} /> : null}
    </button>
  );
}
