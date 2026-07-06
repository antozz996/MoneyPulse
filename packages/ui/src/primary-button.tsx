interface PrimaryButtonProps {
  label: string;
}

export function PrimaryButton({ label }: PrimaryButtonProps) {
  return <button className="mp-button" type="button">{label}</button>;
}

