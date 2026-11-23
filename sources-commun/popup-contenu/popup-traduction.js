/*
 * popup-traduction.js - Popup de traduction (Firefox et Thunderbird).
 *
 * Affiche une popup après un clic sur "Traduire avec Albert" dans le
 * menu contextuel :
 *   - Liste déroulante de langue cible (français, anglais, espagnol,
 *     allemand) ; choisir à nouveau la langue courante relance.
 *   - Traduction automatique à l'ouverture, dans la dernière langue
 *     utilisée.
 *   - Direction affichée en clair ("Français → Anglais").
 *   - Bouton "Copier", avec repli execCommand quand l'API
 *     presse-papiers est refusée.
 *
 * Chaque cible avait sa version : bandeau différent, popup non
 * déplaçable côté Thunderbird, direction de traduction remplacée par
 * la seule langue détectée, et un repli de copie qui annonçait "Copié"
 * même en cas d'échec. Les deux sont réunies ici.
 *
 * Dépendances (chargées avant ce fichier) :
 *   - util/ui-root.js         (uiRoot)
 *   - util/lang-names.js      (LANG_LABELS, nomLangue)
 *   - util/popup-base.js      (getPopupThemeClass)
 *   - util/popup-focus.js     (trapFocus, restoreFocus)
 *   - popup-contenu/popup-layout.js (createPopupHeader,
 *                              positionPopupAtClick, initPopupDrag)
 *   - notification/toast.js   (showToast)
 *
 * Auteur : O. Booklage
 * Date : avril 2026
 * Licence : MIT
 */

"use strict";

window.Albert = window.Albert || {};

Albert.translationPopup = null;

/* La clé de storage est commune aux deux extensions pour que le choix
   de langue suive l'utilisateur. lastTranslateLang est l'ancien nom,
   relu une seule fois pour ne pas perdre le choix des installations
   antérieures à l'harmonisation. */
Albert.lastTranslationLang = "en";
browser.storage.local.get(["lastTranslationLang", "lastTranslateLang"])
  .then((r) => {
    const langue = r.lastTranslationLang || r.lastTranslateLang;
    if (langue) Albert.lastTranslationLang = langue;
    if (!r.lastTranslationLang && r.lastTranslateLang) {
      browser.storage.local.set({ lastTranslationLang: r.lastTranslateLang });
      browser.storage.local.remove("lastTranslateLang");
    }
  });

Albert.closeTranslationPopup = function () {
  const popup = Albert.translationPopup;
  if (popup) {
    if (popup._focusTrapHandler) {
      popup.removeEventListener("keydown", popup._focusTrapHandler);
      popup._focusTrapHandler = null;
    }
    popup.remove();
    Albert.translationPopup = null;
    /* Firefox ferme aussi par son closePopup global : lui retirer la
       référence évite qu'il agisse sur une popup déjà détachée. */
    if (Albert.activePopup === popup) Albert.activePopup = null;
  }
  Albert.restoreFocus();
};

/**
 * Traduit le texte et met à jour la popup.
 *
 * @param {string} texte      - Texte d'origine.
 * @param {string} langueCible - Code de la langue visée.
 * @param {Object} elements   - Éléments de la popup à renseigner.
 */
Albert.doTranslate = async function (texte, langueCible, elements) {
  const { resultat, copie, chargement, direction } = elements;

  chargement.textContent = "Traduction en cours…";
  direction.textContent = "";
  resultat.style.display = "none";
  copie.style.display = "none";

  Albert.lastTranslationLang = langueCible;
  browser.storage.local.set({ lastTranslationLang: langueCible });

  let reponse;
  try {
    reponse = await browser.runtime.sendMessage({
      type: "translate",
      text: texte,
      targetLang: langueCible,
    });
  } catch (err) {
    /* Script de fond injoignable (extension en cours de mise à jour,
       par exemple). Sans ce rattrapage, "Traduction en cours" restait
       affiché sans fin et sans explication. */
    reponse = { error: "Albert ne répond pas : " + (err && err.message) };
  }

  chargement.textContent = "";

  if (!reponse || reponse.error) {
    Albert.showToast((reponse && reponse.error) || "Albert ne répond pas.", 5000);
    return;
  }

  if (reponse.langSource) {
    direction.textContent = Albert.nomLangue(reponse.langSource, true)
      + " → " + Albert.nomLangue(langueCible, true);
  }
  resultat.textContent = reponse.translation;
  resultat.setAttribute("lang", langueCible);
  resultat.style.display = "block";
  copie.style.display = "inline-block";
};

Albert.showTranslationPopup = function (texte) {
  Albert.closeTranslationPopup();
  /* Les autres popups n'existent pas dans les deux cibles. */
  if (Albert.closePopup) Albert.closePopup();
  if (Albert.closeCorrectionPopup) Albert.closeCorrectionPopup();
  if (Albert.closeReformulationPopup) Albert.closeReformulationPopup();

  const theme = Albert.getPopupThemeClass();
  const popup = document.createElement("div");
  popup.className = "albert-popup albert-popup-traduction"
    + (theme ? " " + theme : "");
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Traduction");
  popup.setAttribute("aria-modal", "true");

  const titre = document.createElement("h2");
  titre.className = "albert-sr-only";
  titre.textContent = "Traduction";
  popup.appendChild(titre);

  const { headerLeft, handle } =
    Albert.createPopupHeader(popup, Albert.closeTranslationPopup);

  /* Liste maison et non un <select> : dans la fenêtre de composition de
     Thunderbird, en designMode, Gecko ne déroule pas la liste d'un
     <select> au clic, il y place le curseur d'édition. */
  const choix = document.createElement("div");
  choix.className = "albert-popup-langue-choix";
  const boutonLangue = document.createElement("button");
  boutonLangue.className = "albert-popup-langue albert-popup-langue-select";
  boutonLangue.setAttribute("aria-haspopup", "listbox");
  boutonLangue.setAttribute("aria-expanded", "false");
  const liste = document.createElement("ul");
  liste.className = "albert-popup-langue-liste";
  liste.setAttribute("role", "listbox");
  liste.setAttribute("aria-label", "Langue cible");
  liste.hidden = true;
  const options = [];
  for (const [code, libelle] of Object.entries(Albert.LANG_LABELS)) {
    const option = document.createElement("li");
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.tabIndex = -1;
    option.textContent = libelle;
    option.dataset.langue = code;
    liste.appendChild(option);
    options.push(option);
  }
  choix.append(boutonLangue, liste);
  headerLeft.appendChild(choix);

  const marquerLangue = (code) => {
    for (const option of options) {
      option.setAttribute("aria-selected",
        option.dataset.langue === code ? "true" : "false");
    }
    const libelle = Albert.LANG_LABELS[code] || code;
    boutonLangue.textContent = libelle;
    boutonLangue.setAttribute("aria-label", "Langue cible : " + libelle);
  };

  const ouvrirListe = () => {
    liste.hidden = false;
    boutonLangue.setAttribute("aria-expanded", "true");
    (options.find((o) => o.getAttribute("aria-selected") === "true")
      || options[0]).focus();
  };

  const fermerListe = () => {
    if (liste.hidden) return;
    liste.hidden = true;
    boutonLangue.setAttribute("aria-expanded", "false");
    boutonLangue.focus();
  };

  const corps = document.createElement("div");
  corps.className = "albert-popup-body";

  const direction = document.createElement("div");
  direction.className = "albert-popup-extract";
  corps.appendChild(direction);

  const chargement = document.createElement("div");
  chargement.className = "albert-popup-message";
  chargement.textContent = "Traduction en cours…";
  corps.appendChild(chargement);

  const resultat = document.createElement("div");
  resultat.className = "albert-popup-translation-result";
  resultat.style.display = "none";
  corps.appendChild(resultat);

  const copie = document.createElement("button");
  copie.className = "albert-popup-suggestion";
  copie.textContent = "Copier";
  copie.style.display = "none";
  copie.style.marginTop = "8px";
  corps.appendChild(copie);

  popup.appendChild(corps);
  Albert.uiRoot().appendChild(popup);

  Albert.positionPopupAtClick(popup);
  Albert.initPopupDrag(popup, handle);
  Albert.trapFocus(popup);
  Albert.translationPopup = popup;
  Albert.activePopup = popup;

  const elements = { resultat, copie, chargement, direction };
  const traduire = (code) => {
    marquerLangue(code);
    Albert.doTranslate(texte, code, elements);
  };

  /* Choisir à nouveau la langue courante relance la traduction. */
  const choisir = (code) => {
    fermerListe();
    traduire(code);
  };

  /* Sans preventDefault, le compose Thunderbird reprend le focus et
     place son curseur au mousedown. */
  choix.addEventListener("mousedown", (e) => e.preventDefault());
  popup.addEventListener("mousedown", (e) => {
    if (!choix.contains(e.target)) fermerListe();
  });

  boutonLangue.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (liste.hidden) ouvrirListe();
    else fermerListe();
  });

  boutonLangue.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    ouvrirListe();
  });

  liste.addEventListener("click", (e) => {
    const option = e.target.closest("[role=option]");
    if (!option) return;
    e.preventDefault();
    e.stopPropagation();
    choisir(option.dataset.langue);
  });

  liste.addEventListener("keydown", (e) => {
    const i = options.indexOf(e.target);
    const deplacer = {
      ArrowDown: (i + 1) % options.length,
      ArrowUp: (i - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    }[e.key];
    if (deplacer !== undefined) {
      e.preventDefault();
      options[deplacer].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choisir(e.target.dataset.langue);
    } else if (e.key === "Escape") {
      /* Échap ferme la liste seule : les écouteurs du document
         fermeraient toute la popup. */
      e.preventDefault();
      e.stopPropagation();
      fermerListe();
    } else if (e.key === "Tab") {
      fermerListe();
    }
  });

  copie.addEventListener("click", (e) => {
    /* Sans arrêt de la propagation, l'écouteur de fermeture au clic en
       dehors ne serait pas gêné (le bouton est dans la popup), mais
       l'éditeur du compose Thunderbird voit passer le clic et peut
       reprendre le focus avant que la copie n'ait lieu. */
    e.preventDefault();
    e.stopPropagation();

    const annoncer = (texteBouton) => {
      copie.textContent = texteBouton;
      setTimeout(() => { copie.textContent = "Copier"; }, 2000);
    };

    const texteACopier = resultat.textContent;

    /* Trois voies, de la plus directe à la plus coûteuse. Dans le
       compose Thunderbird, aucune écriture locale n'aboutit : l'API
       presse-papiers échoue, et execCommand("copy") renvoie vrai sans
       rien copier. Le script de fond, lui, écrit avec la permission
       clipboardWrite ; il est donc consulté en premier et les voies
       locales ne servent que là où il ne l'a pas (Firefox, Chromium). */
    const copierParSelection = () => {
      const zone = document.createElement("textarea");
      zone.value = texteACopier;
      zone.setAttribute("readonly", "");
      zone.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      Albert.uiRoot().appendChild(zone);
      zone.focus();
      zone.select();
      let copiee = false;
      try {
        copiee = document.execCommand("copy");
      } catch (err) {
        Albert.warn && Albert.warn("execCommand copy :", err && err.message);
      }
      zone.remove();
      annoncer(copiee ? "Copié !" : "Copie impossible");
    };

    const copierLocalement = () => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        copierParSelection();
        return;
      }
      navigator.clipboard.writeText(texteACopier)
        .then(() => annoncer("Copié !"))
        .catch((err) => {
          Albert.warn && Albert.warn("clipboard.writeText :", err && err.message);
          copierParSelection();
        });
    };

    browser.runtime.sendMessage({ type: "copyToClipboard", text: texteACopier })
      .then((reponse) => {
        if (reponse && reponse.ok) annoncer("Copié !");
        else copierLocalement();
      })
      .catch(copierLocalement);
  });

  traduire(Albert.lastTranslationLang);
};

/* Fermeture au clic en dehors. Thunderbird centralise Échap dans
   compose-popup-utils.js, Firefox dans albert-popup-common.js. */
document.addEventListener("mousedown", (e) => {
  /* composedPath : sous shadow DOM, la cible vue du document est le
     conteneur hôte, jamais la popup. */
  if (Albert.translationPopup
    && !e.composedPath().includes(Albert.translationPopup)) {
    Albert.closeTranslationPopup();
  }
});
