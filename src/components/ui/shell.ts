/**
 * The application shell: header, navigation, main region, footer.
 *
 * Semantics first — a real `<header>`, `<nav>`, `<main>` and `<footer>`, one `<h1>`
 * per view, a skip link, and status conveyed as text rather than colour alone.
 */

import { el, externalLink, clear } from '../utilities/dom';
import { navigate, routeToHash, type Route, type RouteName } from './router';
import { appVersion, deployEnvironment } from '../utilities/assets';

export interface Shell {
  root: HTMLElement;
  main: HTMLElement;
  setActiveRoute(route: Route): void;
  setOnline(online: boolean): void;
  showUpdateNotice(apply: () => void, hasUnsavedWork: () => boolean): void;
  setStorageWarning(message: string | null): void;
}

interface NavItem {
  name: RouteName;
  label: string;
  hint: string;
}

const NAV: NavItem[] = [
  { name: 'library', label: 'Memory box', hint: 'Every letter you have written' },
  { name: 'write', label: 'Write', hint: 'Start or continue a letter' },
  { name: 'print-check', label: 'Print check', hint: 'Calibrate your printer' },
  { name: 'settings', label: 'Settings', hint: 'Appearance, storage and backups' },
  { name: 'privacy', label: 'Privacy', hint: 'Where your letters live' },
];

export function buildShell(): Shell {
  const root = el('div', { class: 'app' });

  const skip = el('a', { class: 'skip-link', href: '#main', text: 'Skip to main content' });

  const header = el('header', { class: 'app__header' });
  const brand = el('a', { class: 'brand', href: '#/library' });
  brand.append(
    el('span', { class: 'brand__name', text: 'Dearly' }),
    el('span', { class: 'brand__by', text: 'by Storitellah' }),
  );

  const connection = el('p', { class: 'connection', id: 'connection-state' });

  const nav = el('nav', { class: 'app__nav', 'aria-label': 'Sections' });
  const list = el('ul', { class: 'nav-list' });
  const links = new Map<RouteName, HTMLAnchorElement>();

  for (const item of NAV) {
    const link = el('a', {
      class: 'nav-link',
      href: routeToHash({ name: item.name, id: null }),
      title: item.hint,
    });
    link.textContent = item.label;
    links.set(item.name, link);
    list.append(el('li', {}, [link]));
  }
  nav.append(list);
  header.append(brand, nav, connection);

  const banners = el('div', { class: 'app__banners' });

  if (deployEnvironment() !== 'production') {
    const preview = el('div', { class: 'banner banner--preview', role: 'note' });
    preview.append(
      el('strong', { text: 'Preview build.' }),
      el('span', {
        text:
          ` This is a ${deployEnvironment()} deployment of Dearly ${appVersion}. Use test letters only —` +
          ' letters are stored per site address, so anything written here stays here.',
      }),
    );
    banners.append(preview);
  }

  const storageWarning = el('div', {
    class: 'banner banner--warning',
    role: 'status',
    hidden: true,
  });
  banners.append(storageWarning);

  const updateNotice = el('div', { class: 'banner banner--update', role: 'status', hidden: true });
  banners.append(updateNotice);

  const main = el('main', { class: 'app__main', id: 'main', tabindex: '-1' });

  const footer = el('footer', { class: 'app__footer' });
  const madeWith = el('p', { class: 'footer__made' });
  madeWith.append(
    document.createTextNode('Made with love by '),
    externalLink('https://storitellah.com', 'Storitellah', 'footer__link'),
  );
  const footerLinks = el('ul', { class: 'footer__links' });
  footerLinks.append(
    el('li', {}, [externalLink('https://storitellah.com/support', 'Support the project', 'footer__link')]),
    el('li', {}, [
      externalLink(
        'https://github.com/storitellah/dearly/issues/new?template=bug_report.yml',
        'Report a bug',
        'footer__link',
      ),
    ]),
    el('li', {}, [
      externalLink('mailto:hello@storitellah.com?subject=Dearly%20feedback', 'Share feedback', 'footer__link'),
    ]),
    el('li', {}, [externalLink('mailto:hello@storitellah.com', 'hello@storitellah.com', 'footer__link')]),
  );
  footer.append(
    el('p', { class: 'footer__tagline', text: 'Write what deserves to be kept.' }),
    madeWith,
    footerLinks,
    el('p', { class: 'footer__version', text: `Version ${appVersion} · works offline · no account` }),
  );

  root.append(skip, header, banners, main, footer);

  return {
    root,
    main,
    setActiveRoute(route: Route): void {
      for (const [name, link] of links) {
        const active = name === route.name;
        link.classList.toggle('nav-link--active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },
    setOnline(online: boolean): void {
      connection.textContent = online ? 'Online' : 'Offline — everything still works';
      connection.classList.toggle('connection--offline', !online);
    },
    showUpdateNotice(apply: () => void, hasUnsavedWork: () => boolean): void {
      clear(updateNotice);
      updateNotice.hidden = false;
      updateNotice.append(
        el('strong', { text: 'A new version of Dearly is ready.' }),
        el('span', {
          text: ' It will be applied when you choose — nothing is interrupted.',
        }),
      );
      const applyButton = el('button', {
        type: 'button',
        class: 'button button--primary button--small',
        text: 'Update now',
      });
      applyButton.addEventListener('click', () => {
        if (hasUnsavedWork()) {
          updateNotice.append(
            el('span', {
              class: 'banner__note',
              text: ' Save or finish your letter first, then update.',
            }),
          );
          return;
        }
        apply();
      });
      const later = el('button', {
        type: 'button',
        class: 'button button--quiet button--small',
        text: 'Later',
      });
      later.addEventListener('click', () => {
        updateNotice.hidden = true;
      });
      updateNotice.append(applyButton, later);
    },
    setStorageWarning(message: string | null): void {
      clear(storageWarning);
      if (message === null) {
        storageWarning.hidden = true;
        return;
      }
      storageWarning.hidden = false;
      storageWarning.append(el('strong', { text: 'Storage: ' }), el('span', { text: message }));
      const settingsLink = el('a', {
        class: 'banner__link',
        href: '#/settings',
        text: 'Open Settings',
      });
      settingsLink.addEventListener('click', () => navigate({ name: 'settings', id: null }));
      storageWarning.append(settingsLink);
    },
  };
}
