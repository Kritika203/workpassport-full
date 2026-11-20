// A keyboard-accessible show/hide control shared by sign in, sign up and reset.
import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput({ label, value, onChange, autoComplete, minLength, required = true, lang = 'en', inputClassName = '', wrapperClassName = '' }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const action = visible ? (lang === 'ne' ? 'लुकाउनुहोस्' : 'Hide') : (lang === 'ne' ? 'देखाउनुहोस्' : 'Show');

  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="block font-medium">{label}</label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={onChange}
          className={`${inputClassName} pr-14`}
        />
        <button
          type="button"
          onClick={() => setVisible(showing => !showing)}
          aria-label={`${action} ${label}`}
          aria-pressed={visible}
          title={`${action} ${label}`}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-[#615B55] hover:bg-[#F6F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C73E33]"
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
