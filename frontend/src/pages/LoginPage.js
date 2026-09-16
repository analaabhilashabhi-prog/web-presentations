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
  let role = 'admin';
  const hint = state.loginHint;

  const emailInput = h('input', {
    class: 'input',
    type: 'email',
    autocomplete: 'username',
    placeholder: 'you@organization.com',
    value: hint?.admin || '',
  });
  const passwordInput = h('input', {
    class: 'input',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: '••••••••',
    value: hint?.adminPassword || '',
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
          if (hint) {
            emailInput.value = value === 'admin' ? hint.admin : hint.presenter;
            passwordInput.value = value === 'admin' ? hint.adminPassword : hint.presenterPassword;
          }
          paint();
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
              'Choose how you are signing in. Admins manage content; presenters get a clean read-only deck.',
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
}
