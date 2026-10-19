// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, scene action
// errors and results. Four languages, the four of the Gladys interface;
// German says "du", Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './vikunja/client.js';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noUrl: {
    en: 'Enter the address of your Vikunja in the configuration.',
    fr: "Saisissez l'adresse de votre Vikunja dans la configuration.",
    de: 'Gib die Adresse deines Vikunja in der Konfiguration ein.',
    es: 'Introduzca la dirección de su Vikunja en la configuración.',
  },
  invalidUrl: {
    en: 'Address not understood, e.g. http://192.168.1.20:3456',
    fr: 'Adresse incomprise, ex. http://192.168.1.20:3456',
    de: 'Adresse nicht verstanden, z. B. http://192.168.1.20:3456',
    es: 'Dirección no válida, p. ej. http://192.168.1.20:3456',
  },
  noToken: {
    en: 'Enter a Vikunja API token in the configuration (Settings, API Tokens).',
    fr: "Saisissez un jeton d'API Vikunja dans la configuration (Settings, API Tokens).",
    de: 'Gib in der Konfiguration ein Vikunja-API-Token ein (Settings, API Tokens).',
    es: 'Introduzca un token de API de Vikunja en la configuración (Settings, API Tokens).',
  },
};

// One short explanation per error kind (src/vikunja/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'Vikunja does not answer',
    fr: 'Vikunja ne répond pas',
    de: 'Vikunja antwortet nicht',
    es: 'Vikunja no responde',
  },
  [ERROR_KINDS.TLS]: {
    en: 'certificate refused: tick "Accept self-signed certificates"',
    fr: 'certificat refusé : cochez « Accepter les certificats auto-signés »',
    de: 'Zertifikat abgelehnt: Aktiviere „Selbstsignierte Zertifikate akzeptieren“',
    es: 'certificado rechazado: marque «Aceptar certificados autofirmados»',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'API token refused or missing a permission: see the documentation',
    fr: "jeton d'API refusé ou sans une permission : voir la documentation",
    de: 'API-Token abgelehnt oder ohne eine Berechtigung: Sieh in der Dokumentation nach',
    es: 'token de API rechazado o sin un permiso: consulte la documentación',
  },
  [ERROR_KINDS.NOT_VIKUNJA]: {
    en: 'no Vikunja API at this address',
    fr: 'aucune API Vikunja à cette adresse',
    de: 'keine Vikunja-API unter dieser Adresse',
    es: 'no hay ninguna API de Vikunja en esta dirección',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'the address redirects: enter the https:// address',
    fr: "l'adresse redirige : saisissez l'adresse en https://",
    de: 'die Adresse leitet um: Gib die https://-Adresse ein',
    es: 'la dirección redirige: introduzca la dirección https://',
  },
  [ERROR_KINDS.RATE_LIMIT]: {
    en: 'too many requests, retrying later',
    fr: 'trop de requêtes, nouvel essai plus tard',
    de: 'zu viele Anfragen, neuer Versuch später',
    es: 'demasiadas solicitudes, se reintentará más tarde',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'unexpected answer, see the logs',
    fr: 'réponse inattendue, voir les logs',
    de: 'unerwartete Antwort, sieh in den Protokollen nach',
    es: 'respuesta inesperada, consulte los registros',
  },
};

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (version, tasks, projects) =>
      `Vikunja ${version} OK: ${tasks} open task(s) in ${projects} followed project(s).`,
    failed: (reason) => `Vikunja: ${reason}.`,
  },
  fr: {
    ok: (version, tasks, projects) =>
      `Vikunja ${version} OK : ${tasks} tâche(s) ouverte(s) dans ${projects} projet(s) suivi(s).`,
    failed: (reason) => `Vikunja : ${reason}.`,
  },
  de: {
    ok: (version, tasks, projects) =>
      `Vikunja ${version} OK: ${tasks} offene Aufgabe(n) in ${projects} verfolgten Projekt(en).`,
    failed: (reason) => `Vikunja: ${reason}.`,
  },
  es: {
    ok: (version, tasks, projects) =>
      `Vikunja ${version} OK: ${tasks} tarea(s) abierta(s) en ${projects} proyecto(s) seguido(s).`,
    failed: (reason) => `Vikunja: ${reason}.`,
  },
};

// Logged and shown when a project typed in the configuration does not exist.
export const UNKNOWN_PROJECTS = {
  en: (names) => `Unknown project(s) ignored: ${names}.`,
  fr: (names) => `Projet(s) inconnu(s) ignoré(s) : ${names}.`,
  de: (names) => `Unbekannte(s) Projekt(e) ignoriert: ${names}.`,
  es: (names) => `Proyecto(s) desconocido(s) ignorado(s): ${names}.`,
};

// Errors of the scene actions and the widget buttons (shown in Gladys).
export const ACTION_TEXT = {
  notConfigured: {
    en: 'Vikunja is not configured.',
    fr: "Vikunja n'est pas configuré.",
    de: 'Vikunja ist nicht konfiguriert.',
    es: 'Vikunja no está configurado.',
  },
  emptyTask: {
    en: 'Give the title or the number of the task.',
    fr: 'Indiquez le titre ou le numéro de la tâche.',
    de: 'Gib den Titel oder die Nummer der Aufgabe an.',
    es: 'Indique el título o el número de la tarea.',
  },
  taskNotFound: {
    en: 'No open task has this title or number in Vikunja.',
    fr: 'Aucune tâche ouverte ne porte ce titre ou ce numéro dans Vikunja.',
    de: 'Keine offene Aufgabe in Vikunja hat diesen Titel oder diese Nummer.',
    es: 'Ninguna tarea abierta tiene este título o número en Vikunja.',
  },
  taskAmbiguous: {
    en: 'Several open tasks have this title: give its number (#12) instead.',
    fr: 'Plusieurs tâches ouvertes portent ce titre : indiquez plutôt son numéro (#12).',
    de: 'Mehrere offene Aufgaben haben diesen Titel: Gib stattdessen ihre Nummer an (#12).',
    es: 'Varias tareas abiertas tienen este título: indique su número (#12).',
  },
  emptyTitle: {
    en: 'Give the title of the new task.',
    fr: 'Indiquez le titre de la nouvelle tâche.',
    de: 'Gib den Titel der neuen Aufgabe an.',
    es: 'Indique el título de la nueva tarea.',
  },
  projectNotFound: {
    en: 'No project has this name or number in Vikunja.',
    fr: 'Aucun projet ne porte ce nom ou ce numéro dans Vikunja.',
    de: 'Kein Projekt in Vikunja hat diesen Namen oder diese Nummer.',
    es: 'Ningún proyecto tiene este nombre o número en Vikunja.',
  },
  projectAmbiguous: {
    en: 'Several projects have this name: give its number instead.',
    fr: 'Plusieurs projets portent ce nom : indiquez plutôt son numéro.',
    de: 'Mehrere Projekte haben diesen Namen: Gib stattdessen ihre Nummer an.',
    es: 'Varios proyectos tienen este nombre: indique su número.',
  },
  noProject: {
    en: 'Vikunja has no project to add the task to.',
    fr: "Vikunja n'a aucun projet où ajouter la tâche.",
    de: 'Vikunja hat kein Projekt, in das die Aufgabe kommen kann.',
    es: 'Vikunja no tiene ningún proyecto donde añadir la tarea.',
  },
  alreadyDone: {
    en: 'This task was already done meanwhile: the list is refreshed.',
    fr: 'Cette tâche a déjà été faite entre-temps : la liste est mise à jour.',
    de: 'Diese Aufgabe wurde inzwischen schon erledigt: Die Liste wird aktualisiert.',
    es: 'Esta tarea ya se ha hecho entretanto: la lista se actualiza.',
  },
};

// Toasts and scene results (≤ 200 characters).
export const DONE_TEXT = {
  en: { done: (title) => `"${title}" marked done.`, created: (title) => `"${title}" added.` },
  fr: {
    done: (title) => `« ${title} » marquée comme faite.`,
    created: (title) => `« ${title} » ajoutée.`,
  },
  de: {
    done: (title) => `„${title}“ als erledigt markiert.`,
    created: (title) => `„${title}“ hinzugefügt.`,
  },
  es: {
    done: (title) => `«${title}» marcada como hecha.`,
    created: (title) => `«${title}» añadida.`,
  },
};

// The sentence of the "Read today's tasks" scene action, for a message or a
// voice announcement.
const join = (titles, and) =>
  titles.length < 2 ? titles.join('') : `${titles.slice(0, -1).join(', ')} ${and} ${titles.at(-1)}`;

export const TODAY_TEXT = {
  en: {
    none: 'Nothing to do today.',
    list: (count, titles) => `${count} task(s) to do today: ${join(titles, 'and')}.`,
    overdue: (count) => ` ${count} overdue.`,
  },
  fr: {
    none: "Rien à faire aujourd'hui.",
    list: (count, titles) => `${count} tâche(s) à faire aujourd'hui : ${join(titles, 'et')}.`,
    overdue: (count) => ` ${count} en retard.`,
  },
  de: {
    none: 'Heute gibt es nichts zu tun.',
    list: (count, titles) => `${count} Aufgabe(n) für heute: ${join(titles, 'und')}.`,
    overdue: (count) => ` ${count} überfällig.`,
  },
  es: {
    none: 'No hay nada que hacer hoy.',
    list: (count, titles) => `${count} tarea(s) para hoy: ${join(titles, 'y')}.`,
    overdue: (count) => ` ${count} atrasada(s).`,
  },
};

export const LANGUAGE_FALLBACK = 'en';

export const pick = (text, language) => text[language] ?? text[LANGUAGE_FALLBACK];

/** A multi-language object from a function of the language. */
export const allLanguages = (render) =>
  Object.fromEntries(Object.keys(INIT_FAILED).map((language) => [language, render(language)]));
