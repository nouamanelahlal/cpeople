import { useState, type JSX, type Ref } from 'react';
import type { I18n } from '../i18n';
import { EyeIcon, EyeOffIcon } from './Icons';

/** A password box with a show/hide toggle, as the design has it. */
export function PasswordField(props: {
  i18n: I18n;
  id: string;
  name: string;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement>;
}): JSX.Element {
  const { i18n, id, name, placeholder, autoComplete, invalid = false, autoFocus = false, ref } = props;
  const [shown, setShown] = useState(false);

  return (
    <div className="cp-password">
      <label className="cp-visually-hidden" htmlFor={id}>
        {placeholder}
      </label>
      <input
        ref={ref}
        className="cp-input"
        id={id}
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="cp-password-toggle"
        aria-label={i18n.msgStr(shown ? 'cpHidePassword' : 'cpShowPassword')}
        aria-pressed={shown}
        onClick={() => setShown((wasShown) => !wasShown)}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
