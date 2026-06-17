(function () {
  const TOTAL_STEPS = 3;
  const stepLabels = {
    1: "Continuă",
    2: "Mai departe",
    3: "Vreau acces la tur",
  };

  const body = document.body;
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  const nextButtons = Array.from(document.querySelectorAll("[data-next-step]"));
  const stickyButton = document.getElementById("stickyButton");
  const leadForm = document.getElementById("leadForm");
  const formMessage = document.getElementById("formMessage");
  const successCard = document.getElementById("successCard");
  const scrollToFormButtons = Array.from(document.querySelectorAll("[data-scroll-to-form]"));

  let currentStep = 1;

  function setStep(step, shouldFocus) {
    const safeStep = Math.max(1, Math.min(TOTAL_STEPS, Number(step) || 1));
    currentStep = safeStep;
    body.dataset.step = String(safeStep);

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === String(safeStep);
      panel.classList.toggle("is-active", isActive);
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    if (stickyButton) {
      const label = stepLabels[safeStep];
      stickyButton.firstChild.textContent = label + " ";
    }

    const targetPanel = document.querySelector(`[data-panel="${safeStep}"]`);
    if (targetPanel) {
      targetPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      if (shouldFocus) {
        const focusTarget =
          targetPanel.querySelector("input, select, button") || targetPanel;
        window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 260);
      }
    }
  }

  function getUtmSnapshot() {
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer ? new URL(document.referrer).hostname : "";
    const utmSource = params.get("utm_source") || "";
    const utmMedium = params.get("utm_medium") || "";
    const utmCampaign = params.get("utm_campaign") || "";
    const utmContent = params.get("utm_content") || "";
    const utmTerm = params.get("utm_term") || "";

    return {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      source: utmSource || referrer || "direct",
      medium: utmMedium || (referrer ? "referral" : "direct"),
      campaign: utmCampaign || "",
      content: utmContent || "",
      landing_page: window.location.href,
      timestamp: new Date().toISOString(),
    };
  }

  function populateHiddenFields() {
    if (!leadForm) {
      return;
    }

    const tracking = getUtmSnapshot();
    Object.entries(tracking).forEach(([key, value]) => {
      const field = leadForm.elements.namedItem(key);
      if (field) {
        field.value = value;
      }
    });
  }

  function validateForm(form) {
    const email = form.elements.email;
    const interest = form.elements.interes_principal;
    let message = "";

    [email, interest].forEach((field) => field.classList.remove("is-invalid"));

    if (!email.value.trim()) {
      message = "Te rugăm să introduci emailul.";
      email.classList.add("is-invalid");
      email.focus();
    } else if (!email.validity.valid) {
      message = "Te rugăm să introduci un email valid.";
      email.classList.add("is-invalid");
      email.focus();
    } else if (!interest.value) {
      message = "Alege ce te interesează cel mai mult.";
      interest.classList.add("is-invalid");
      interest.focus();
    }

    formMessage.textContent = message;
    return !message;
  }

  function formDataToPayload(form) {
    populateHiddenFields();
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      ...data,
      email: String(data.email || "").trim().toLowerCase(),
      interes_principal: String(data.interes_principal || ""),
      tag: "tur_casa",
      lead_source: "corimo_home_landing",
    };
  }

  async function submitLead(event) {
    event.preventDefault();

    if (!leadForm || !validateForm(leadForm)) {
      return;
    }

    const submitButtons = leadForm.querySelectorAll("button[type='submit']");
    const payload = formDataToPayload(leadForm);
    const endpoint = leadForm.getAttribute("action") || "/api/corimo-leads";

    body.classList.add("is-submitting");
    formMessage.textContent = "";
    submitButtons.forEach((button) => {
      button.disabled = true;
      button.dataset.originalText = button.textContent.trim();
      button.firstChild.textContent = "Se trimite ";
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Nu am putut trimite formularul. Încearcă din nou.");
      }

      leadForm.hidden = true;
      successCard.hidden = false;
      if (stickyButton) {
        stickyButton.closest(".sticky-action").style.display = "none";
      }
      successCard.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      formMessage.textContent =
        error instanceof Error
          ? error.message
          : "Nu am putut trimite formularul. Încearcă din nou.";
    } finally {
      body.classList.remove("is-submitting");
      submitButtons.forEach((button) => {
        button.disabled = false;
        if (button.dataset.originalText) {
          button.firstChild.textContent = button.dataset.originalText + " ";
        }
      });
    }
  }

  nextButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setStep(button.dataset.nextStep, Number(button.dataset.nextStep) === TOTAL_STEPS);
    });
  });

  if (stickyButton) {
    stickyButton.addEventListener("click", () => {
      if (currentStep < TOTAL_STEPS) {
        setStep(currentStep + 1, currentStep + 1 === TOTAL_STEPS);
      } else if (leadForm) {
        leadForm.requestSubmit();
      }
    });
  }

  scrollToFormButtons.forEach((button) => {
    button.addEventListener("click", () => setStep(TOTAL_STEPS, true));
  });

  if (leadForm) {
    populateHiddenFields();
    leadForm.addEventListener("submit", submitLead);
    window.addEventListener("popstate", populateHiddenFields);
  }

  setStep(1, false);
})();
