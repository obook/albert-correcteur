// compose-toast.js --- Notifications toast dans le compose Thunderbird.

"use strict";

Albert.showToast = function (message, duration) {
  duration = duration || 3000;
  let container = document.querySelector(".albert-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "albert-toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "albert-toast";
  toast.textContent = message;
  toast.setAttribute("role", "alert");
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("albert-toast-fade");
    setTimeout(() => toast.remove(), 300);
  }, duration);
};
