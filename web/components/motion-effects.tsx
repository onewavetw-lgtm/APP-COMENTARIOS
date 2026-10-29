"use client";
import { useEffect } from "react";
// Progressive enhancement: content remains visible if scripts or observers are unavailable.
export default function MotionEffects() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    const selector = "main .hero, main .card, main .sectionTitle, main .empty";
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "shown");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -24px 0px" },
    );
    function register(element: Element) {
      if (element.hasAttribute("data-reveal")) return;
      element.setAttribute("data-reveal", "pending");
      observer.observe(element);
    }
    document.querySelectorAll(selector).forEach(register);
    const mutations = new MutationObserver((records) =>
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches(selector)) register(node);
            node.querySelectorAll(selector).forEach(register);
          }
        }),
      ),
    );
    mutations.observe(document.body, { childList: true, subtree: true });
    const revealFocused = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        const panel = event.target.closest('[data-reveal="pending"]');
        panel?.setAttribute("data-reveal", "shown");
      }
    };
    const reduceMotion = () => {
      if (preference.matches) {
        observer.disconnect();
        document
          .querySelectorAll("[data-reveal]")
          .forEach((el) => el.removeAttribute("data-reveal"));
      }
    };
    preference.addEventListener("change", reduceMotion);
    document.addEventListener("focusin", revealFocused);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      preference.removeEventListener("change", reduceMotion);
      document.removeEventListener("focusin", revealFocused);
      document
        .querySelectorAll("[data-reveal]")
        .forEach((el) => el.removeAttribute("data-reveal"));
    };
  }, []);
  return null;
}
