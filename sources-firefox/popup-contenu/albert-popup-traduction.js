/*
 * albert-popup-traduction.js - Popup de traduction.
 *
 * Affiche une popup de traduction après un clic sur "Traduire avec
 * Albert" dans le menu contextuel. Fonctionnalités :
 *   - Sélecteur de langue cible (français, anglais, espagnol, allemand).
 *   - Traduction automatique à l'ouverture (dernière langue utilisée).
 *   - Bouton "Traduire" pour changer de langue sans rouvrir la popup.
 *   - Affichage de la direction (ex. : "Français -> Anglais").
 *   - Bouton "Copier" avec fallback execCommand pour les navigateurs
 *     qui ne supportent pas navigator.clipboard.
 *   - Persistance de la dernière langue dans browser.storage.local.
 *
 * Langues supportées : fr, en, es, de.
 *
 * Dépendances :
 *   - albert-popup-common.js  (closePopup, trapFocus)
 *   - albert-popup-layout.js  (positionPopupAtClick, initPopupDrag,
 *                               createPopupHeader)
 *   - albert-toast.js         (showToast, pour les erreurs)
 *
 * Auteur : O. Booklage
 * Date : Avril 2026
 * Licence : MIT
 */

"use strict";

const TRANSLATE_LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "Anglais" },
  { code: "es", label: "Espagnol" },
  { code: "de", label: "Allemand" },
];

const LANG_LABELS = { fr: "Français", en: "Anglais", es: "Espagnol", de: "Allemand" };

/* Dernière langue sélectionnée (persistée dans storage). */
Albert.lastTranslateLang = "en";
browser.storage.local.get("lastTranslateLang").then((r) => {
  if (r.lastTranslateLang) Albert.lastTranslateLang = r.lastTranslateLang;
});

/* Lance la traduction et met à jour la popup. */
Albert.doTranslate = async function (originalText, targetLang, resultDiv, copyBtn, loadingMsg, langInfoEl) {
  if (loadingMsg) loadingMsg.textContent = "Traduction en cours…";
  if (langInfoEl) langInfoEl.textContent = "";
  resultDiv.style.display = "none";
  copyBtn.style.display = "none";

  Albert.lastTranslateLang = targetLang;
  browser.storage.local.set({ lastTranslateLang: targetLang });

  const response = await browser.runtime.sendMessage({
    type: "translate",
    text: originalText,
    targetLang,
  });

  if (response.error) {
    Albert.showToast(response.error, 5000);
    if (loadingMsg) loadingMsg.textContent = "";
    return;
  }

  if (loadingMsg) loadingMsg.textContent = "";
  if (langInfoEl && response.langSource) {
    const srcLabel = LANG_LABELS[response.langSource] || response.langSource;
    const tgtLabel = LANG_LABELS[targetLang] || targetLang;
    langInfoEl.textContent = srcLabel + " → " + tgtLabel;
  }
  resultDiv.textContent = response.translation;
  resultDiv.setAttribute("lang", targetLang);
  resultDiv.style.display = "block";
  copyBtn.style.display = "inline-block";
};

Albert.showTranslationPopup = function (originalText) {
  Albert.closePopup();

  const themeClass = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup" + (themeClass ? " " + themeClass : "");
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Traduction");
  popup.setAttribute("aria-modal", "true");
  const h2 = document.createElement("h2");
  h2.className = "albert-sr-only";
  h2.textContent = "Traduction";
  popup.appendChild(h2);

  /* --- Header --- */
  const { headerLeft, handle } = Albert.createPopupHeader(popup);

  /* Sélecteur de langue */
  const langSelect = document.createElement("select");
  langSelect.className = "albert-popup-lang-select";
  TRANSLATE_LANGS.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = l.label;
    if (l.code === Albert.lastTranslateLang) opt.selected = true;
    langSelect.appendChild(opt);
  });
  headerLeft.appendChild(langSelect);

  /* Bouton traduire */
  const translateBtn = document.createElement("button");
  translateBtn.className = "albert-popup-translate-btn";
  translateBtn.textContent = "Traduire";
  headerLeft.appendChild(translateBtn);

  /* --- Corps --- */
  const body = document.createElement("div");
  body.className = "albert-popup-body";

  const langInfoEl = document.createElement("div");
  langInfoEl.className = "albert-popup-extract";
  body.appendChild(langInfoEl);

  const loadingMsg = document.createElement("div");
  loadingMsg.className = "albert-popup-message";
  loadingMsg.textContent = "Traduction en cours…";
  body.appendChild(loadingMsg);

  const resultDiv = document.createElement("div");
  resultDiv.className = "albert-popup-translation-result";
  resultDiv.style.display = "none";
  body.appendChild(resultDiv);

  const copyBtn = document.createElement("button");
  copyBtn.className = "albert-popup-suggestion";
  copyBtn.textContent = "Copier";
  copyBtn.style.display = "none";
  copyBtn.style.marginTop = "8px";
  body.appendChild(copyBtn);

  popup.appendChild(body);
  document.body.appendChild(popup);

  /* Positionnement */
  Albert.positionPopupAtClick(popup);
  Albert.initPopupDrag(popup, handle);
  Albert.trapFocus(popup);
  Albert.activePopup = popup;

  /* --- Actions --- */

  translateBtn.addEventListener("click", () => {
    Albert.doTranslate(originalText, langSelect.value, resultDiv, copyBtn, loadingMsg, langInfoEl);
  });

  /* Tout changement de langue cible déclenche une nouvelle traduction,
     pour éviter une incohérence entre la langue affichée dans le menu
     et le texte visible à l'écran. */
  langSelect.addEventListener("change", () => {
    Albert.doTranslate(originalText, langSelect.value, resultDiv, copyBtn, loadingMsg, langInfoEl);
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(resultDiv.textContent).then(() => {
      copyBtn.textContent = "Copié !";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 2000);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = resultDiv.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      copyBtn.textContent = "Copié !";
      setTimeout(() => { copyBtn.textContent = "Copier"; }, 2000);
    });
  });

  /* Traduction automatique à l'ouverture */
  Albert.doTranslate(originalText, Albert.lastTranslateLang, resultDiv, copyBtn, loadingMsg, langInfoEl);
};
