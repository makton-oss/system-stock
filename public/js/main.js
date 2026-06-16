/* =============================================
   MAIN.JS — minimal vanilla JS
   ============================================= */

(function () {
  'use strict';

  // ----- NAV: hide/show on scroll -----
  const nav = document.querySelector('.nav');
  let lastY = 0;

  window.addEventListener('scroll', function () {
    const currentY = window.scrollY;

    if (currentY > 80) {
      nav.style.transform = currentY > lastY
        ? 'translateY(-100%)'  // scrolling down → hide
        : 'translateY(0)';     // scrolling up → show
    } else {
      nav.style.transform = 'translateY(0)';
    }

    lastY = currentY;
  }, { passive: true });

  // nav transition
  if (nav) {
    nav.style.transition = 'transform 0.3s ease';
  }

  // ----- SCROLL REVEAL -----
  const revealEls = document.querySelectorAll(
    '.feat-card, .step, .role-card, .testimonial-card, .pain-card'
  );

  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealEls.forEach(function (el) {
      el.classList.add('reveal');
      observer.observe(el);
    });
  }

})();
