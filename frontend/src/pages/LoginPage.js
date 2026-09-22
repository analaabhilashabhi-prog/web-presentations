import { h, render } from '../utils/dom.js';
import { state } from '../context/appStore.js';
import * as authService from '../services/authService.js';
import { navigate } from '../utils/router.js';
import { toastError } from '../components/Toast.js';

/* The three decks, as shown on the sign-in page. Static on purpose: the orgs
   endpoint needs a session and this page is where you get one. Colours are the
   same values as config/themes.js — keep the two in step. The third carries no
   slogan because none has been given; its full name is the line instead. */
const ORG_TILES = [
  { mark: 'NGI', name: 'NGI', tag: 'Engineering depth, industry ready.', bg: '#008638', fg: '#FFBB00' },
  { mark: 'T', name: 'Torii', tag: 'Step in. Stand out.', bg: '#000000', fg: '#E95A22' },
  { mark: 'N', name: 'NCET', tag: 'Nagarjuna College of Engineering & Technology', bg: '#047738', fg: '#D6AB30' },
];

/** Role-aware sign-in. Admin lands on content control, presenter on the deck. */
export function LoginPage(container) {
  const hint = state.loginHint;
  /* The presenter's details, served by the API when PRESENTER_PREFILL is on
     (the default). With them the page opens on Presenter with both fields
     already filled, so anyone given the link signs in with one press
     (2026-09-22, on request). The admin's are never served this way; that
     side of the toggle is filled only by the local-work SHOW_LOGIN_HINT. */
  const prefill = state.prefill;
  let role = prefill ? 'presenter' : 'admin';

  const credentialsFor = (value) => (value === 'presenter'
    ? { email: prefill?.email || hint?.presenter || '', password: prefill?.password || hint?.presenterPassword || '' }
    : { email: hint?.admin || '', password: hint?.adminPassword || '' });

  const initial = credentialsFor(role);
  const emailInput = h('input', {
    class: 'input',
    type: 'email',
    autocomplete: 'username',
    placeholder: 'you@organization.com',
    value: initial.email,
  });
  const passwordInput = h('input', {
    class: 'input',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: '••••••••',
    value: initial.password,
  });
  const errorSlot = h('div', {});
  const submit = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Sign in');

  const roleButton = (value, label, description) =>
    h(
      'button',
      {
        type: 'button',
        class: `role-toggle__btn${role === value ? ' is-active' : ''}`,
        title: description,
        onclick: () => {
          role = value;
          /* Always rewritten, so switching to Admin clears the presenter's
             details rather than leaving them in the admin's boxes. */
          const next = credentialsFor(value);
          emailInput.value = next.email;
          passwordInput.value = next.password;
          paint();
          /* `paint` rebuilds the card, which drops focus on the body — so put
             it where the next press belongs: the button if the boxes are
             filled, the first empty box if not. */
          if (next.email && next.password) submit.focus({ preventScroll: true });
          else emailInput.focus();
        },
      },
      label,
    );

  async function onSubmit(event) {
    event.preventDefault();
    render(errorSlot);
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    try {
      const result = await authService.login(emailInput.value.trim(), passwordInput.value);
      state.user = result.user;
      navigate('/orgs');
    } catch (err) {
      render(errorSlot, h('p', { class: 'form-error' }, err.message));
      toastError(err.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  }

  function paint() {
    render(
      container,
      h(
        'div',
        { class: 'login' },
        h(
          'div',
          { class: 'login__brand' },
          h(
            'div',
            {},
            h('div', { class: 'login__eyebrow' }, 'Organization Presentation Portal'),
            h(
              'h1',
              { class: 'login__headline' },
              'Three organizations. One projector-ready story.',
            ),
            h(
              'p',
              { class: 'login__sub' },
              'A live digital brochure for college and university partnerships — profile, programs, placements, centres of excellence and MOUs, presented section by section.',
            ),
          ),
          h(
            'div',
            { class: 'login__orgs' },
            ...ORG_TILES.map((o) => h(
              'div',
              { class: 'login__org' },
              h('span', { class: 'login__swatch', style: { background: o.bg, color: o.fg } }, o.mark),
              h(
                'span',
                {},
                h('div', { class: 'login__org-name' }, o.name),
                h('div', { class: 'login__org-tag' }, o.tag),
              ),
            )),
          ),
        ),
        h(
          'div',
          { class: 'login__panel' },
          h(
            'form',
            { class: 'login__card', onsubmit: onSubmit },
            h('h2', {}, 'Sign in'),
            h(
              'p',
              { class: 'login__hint-text' },
              prefill && role === 'presenter'
                ? 'The presenter’s details are filled in — press Sign in to open the deck. Admins switch to Admin and enter theirs.'
                : 'Choose how you are signing in. Admins manage content; presenters get a clean read-only deck.',
            ),
            h(
              'div',
              { class: 'role-toggle' },
              roleButton('admin', 'Admin', 'Add, edit, reorder and publish content'),
              roleButton('presenter', 'Presenter', 'Read-only presentation view'),
            ),
            errorSlot,
            h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Email'), emailInput),
            h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Password'), passwordInput),
            submit,
            hint
              ? h(
                  'div',
                  { class: 'login__creds' },
                  h('div', {}, 'Demo accounts (set SHOW_LOGIN_HINT=false to hide):'),
                  h(
                    'div',
                    { style: { marginTop: '6px' } },
                    'Admin ',
                    h('code', {}, hint.admin),
                    ' / ',
                    h('code', {}, hint.adminPassword),
                  ),
                  h(
                    'div',
                    { style: { marginTop: '4px' } },
                    'Presenter ',
                    h('code', {}, hint.presenter),
                    ' / ',
                    h('code', {}, hint.presenterPassword),
                  ),
                )
              : null,
          ),
        ),
      ),
    );
  }

  paint();
  /* Filled in, the one thing left to do is press the button — so Enter does it
     without a click into the form first. */
  if (prefill && role === 'presenter') submit.focus({ preventScroll: true });
}
