const METAR_KNOWLEDGE = {
  METAR: {
    category: "about.knowledge.METAR.category",
    explanation: "about.knowledge.METAR.explanation",
    note: "about.knowledge.METAR.note"
  },
  SBGR: {
    category: "about.knowledge.SBGR.category",
    explanation: "about.knowledge.SBGR.explanation",
    note: "about.knowledge.SBGR.note"
  },
  "252100Z": {
    category: "about.knowledge.252100Z.category",
    explanation: "about.knowledge.252100Z.explanation",
    note: "about.knowledge.252100Z.note"
  },
  "09003KT": {
    category: "about.knowledge.09003KT.category",
    explanation: "about.knowledge.09003KT.explanation",
    note: "about.knowledge.09003KT.note"
  },
  "0500": {
    category: "about.knowledge.0500.category",
    explanation: "about.knowledge.0500.explanation",
    note: "about.knowledge.0500.note"
  },
  "0200N": {
    category: "about.knowledge.0200N.category",
    explanation: "about.knowledge.0200N.explanation",
    note: "about.knowledge.0200N.note"
  },
  FG: {
    category: "about.knowledge.FG.category",
    explanation: "about.knowledge.FG.explanation",
    note: "about.knowledge.FG.note"
  },
  VV002: {
    category: "about.knowledge.VV002.category",
    explanation: "about.knowledge.VV002.explanation",
    note: "about.knowledge.VV002.note"
  },
  "12/12": {
    category: "about.knowledge.12/12.category",
    explanation: "about.knowledge.12/12.explanation",
    note: "about.knowledge.12/12.note"
  },
  Q1016: {
    category: "about.knowledge.Q1016.category",
    explanation: "about.knowledge.Q1016.explanation",
    note: "about.knowledge.Q1016.note"
  }
};

function t(key) {
  return window.DecMETI18n?.t(key) || key;
}

export function initMetarKnowledgeTree() {
  const sections = document.querySelectorAll("[data-metar-knowledge]");

  sections.forEach(function (section) {
    const buttons = Array.from(section.querySelectorAll("[data-metar-token]"));
    const code = section.querySelector("[data-knowledge-code]");
    const category = section.querySelector("[data-knowledge-category]");
    const explanation = section.querySelector("[data-knowledge-explanation]");
    const note = section.querySelector("[data-knowledge-note]");

    if (!buttons.length || !code || !category || !explanation || !note) {
      return;
    }

    function selectToken(token) {
      const data = METAR_KNOWLEDGE[token];

      if (!data) {
        return;
      }

      buttons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.metarToken === token);
        button.setAttribute("aria-pressed", String(button.dataset.metarToken === token));
      });

      code.textContent = token;
      category.textContent = t(data.category);
      explanation.textContent = t(data.explanation);
      note.textContent = t(data.note);
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        selectToken(button.dataset.metarToken);
      });

      button.addEventListener("mouseenter", function () {
        selectToken(button.dataset.metarToken);
      });

      button.addEventListener("focus", function () {
        selectToken(button.dataset.metarToken);
      });
    });

    selectToken(buttons[0].dataset.metarToken);

    window.addEventListener("decmet:languagechange", function () {
      const activeButton = buttons.find(function (button) {
        return button.classList.contains("is-active");
      }) || buttons[0];

      selectToken(activeButton.dataset.metarToken);
    });
  });
}
