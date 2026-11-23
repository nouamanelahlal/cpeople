<#ftl output_format="HTML">
<#--
  Sent to the account's owner when too many failed sign-ins lock it (M02 / HR-08).

  Keycloak's `email` event listener sends this; the realm limits that listener to
  this one event, so nobody gets a message for an ordinary mistyped password.

  There is no link to the sign-in page in it on purpose: an e-mail template has no
  way to know the environment's URL, and a lockout notice is the wrong place to
  invent one.
-->
<#import "template.ftl" as layout>
<@layout.emailLayout>
  <p style="margin:0">${kcSanitize(msg("eventUserDisabledByTemporaryLockoutHtml"))?no_esc}</p>
</@layout.emailLayout>
