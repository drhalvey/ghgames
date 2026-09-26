/* GH Games: Google Analytics 4
   One place to set the measurement ID for the whole site.
   Advertising features, Google signals and ad personalisation are switched off:
   this only counts visits and which games get played.
   Frondi Clicker pages deliberately do NOT load this file (its privacy policy
   promises no analytics). */
(function () {
  var GA_ID = "G-XXXXXXXXXX"; // replace with the GH Games measurement ID
  if (!/^G-[A-Z0-9]{6,}$/.test(GA_ID) || GA_ID === "G-XXXXXXXXXX") return;
  if (location.hostname !== "ghgames.au" && location.hostname !== "www.ghgames.au") return; // no stats from local testing
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
})();
