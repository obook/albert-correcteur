// test-react-editors.js - Simule le comportement React (re-rendu du DOM à la sélection).
// Objectif : vérifier que l'extension utilise un overlay et non des spans injectés
// dans le DOM, car React écrase toute modification DOM extérieure lors du re-rendu.

"use strict";

(function () {
  // Sauvegarde le texte brut initial de chaque éditeur simulé
  const editors = document.querySelectorAll(".draft-editor, .lexical-editor");
  const originalTexts = new Map();

  editors.forEach((el) => {
    originalTexts.set(el, el.innerText);
  });

  // Simule un re-rendu React quand l'utilisateur fait une sélection.
  // React reconstruit le DOM depuis son état interne → tout span étranger disparaît.
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const anchor = sel.anchorNode;
    if (!anchor) return;

    // Trouver l'éditeur simulé parent
    const editor = anchor.nodeType === Node.ELEMENT_NODE
      ? anchor.closest(".draft-editor, .lexical-editor")
      : anchor.parentElement && anchor.parentElement.closest(".draft-editor, .lexical-editor");
    if (!editor) return;

    // Vérifier s'il y a des spans albert-error injectés (= bug)
    const injectedSpans = editor.querySelectorAll(".albert-error");
    if (injectedSpans.length > 0) {
      console.warn(
        "[test-react-editors] BUG REPRODUIT : %d span(s) .albert-error trouvé(s) dans le DOM de l'éditeur.",
        injectedSpans.length,
        "React les aurait supprimés en production (x.com)."
      );

      // Simuler le re-rendu React : restaurer le texte brut, les spans disparaissent
      const currentText = editor.innerText;
      editor.textContent = currentText;
      editor.classList.add("react-rerender-flash");
      setTimeout(() => editor.classList.remove("react-rerender-flash"), 300);

      console.warn("[test-react-editors] Re-rendu React simulé → corrections visuelles perdues.");
    }
  });

  console.log("[test-react-editors] Simulation React active pour %d éditeur(s).", editors.length);
})();
