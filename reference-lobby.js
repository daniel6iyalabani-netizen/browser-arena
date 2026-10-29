/* Transparent hit areas over the pixel-accurate lobby artwork. */
(() => {
  const online = document.querySelector('[data-queue="online"]');
  const training = document.querySelector('[data-queue="training"]');
  const custom = document.getElementById('reference-custom-hitbox');
  const privateMatch = document.getElementById('reference-private-hitbox');

  // The reference artwork already contains the button labels. These buttons
  // preserve the working queue selection underneath those labels.
  custom?.addEventListener('click', () => {
    online?.click();
  });

  privateMatch?.addEventListener('click', () => {
    training?.click();
  });
})();
