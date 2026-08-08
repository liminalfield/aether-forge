import type { ReactNode, TextareaHTMLAttributes } from 'react';

import { labelStyle } from './Label.js';
import { slot } from './theme.js';
import { tokens } from './tokens.js';

export interface WritingSurfaceProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
> {
  readonly label: string;
  /** Hidden when the surface sits where its purpose is already obvious. */
  readonly showLabel?: boolean;
}

/**
 * Somewhere to write prose.
 *
 * Set in the reading typeface rather than the interface one, because what is
 * typed here is the same text that will be read back afterwards, and a person
 * should be looking at the shapes they are going to live with rather than at a
 * form field that happens to contain them.
 *
 * It grows with what is in it rather than scrolling inside a fixed box. A
 * writing surface that hides the beginning of a paragraph while its end is
 * being typed is a worse place to think.
 */
export function WritingSurface({
  label,
  showLabel = true,
  id,
  rows = 3,
  ...rest
}: WritingSurfaceProps): ReactNode {
  return (
    <div style={{ display: 'grid', gap: tokens.space[8] }}>
      <label
        htmlFor={id}
        style={{
          ...labelStyle(),
          ...(showLabel
            ? {}
            : {
                position: 'absolute',
                width: tokens.border.hair,
                height: tokens.border.hair,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
              }),
        }}
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-label={showLabel ? undefined : label}
        style={{
          background: slot('ground', 'raised'),
          color: slot('ink', 'primary'),
          border: `1px solid ${slot('ink', 'hairline')}`,
          borderRadius: tokens.radius.md,
          padding: `${tokens.space[16]} ${tokens.space[16]}`,
          fontFamily: 'var(--font-prose)',
          fontSize: tokens.type.prose,
          fontWeight: 300,
          lineHeight: tokens.lineHeight.prose,
          resize: 'vertical',
          outlineColor: slot('accent', 'accent'),
        }}
        {...rest}
      />
    </div>
  );
}
