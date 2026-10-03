/**
 * @description Inline `<script>` that runs only from server-rendered HTML.
 * On the server it renders as `text/javascript`, so the browser executes it while parsing (before first paint).
 * On the client it renders as `text/plain`: React re-renders (e.g. the `[locale]` root layout on a language
 * switch) would otherwise create a `<script>` element that never runs and React warns about it.
 * Must be rendered from a Client Component so the two environments produce different `type`s.
 * @param props.html - Script source.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
