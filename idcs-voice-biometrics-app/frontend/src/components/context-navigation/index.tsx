import { h } from "preact";

export interface ContextNavigationProps {
  readonly current: string;
  readonly onAccount: () => void;
}

export function ContextNavigation({ current, onAccount }: ContextNavigationProps) {
  return (
    <nav class="context-navigation" aria-label="Breadcrumb">
      <ol>
        <li><button type="button" onClick={onAccount}>Account</button></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}
