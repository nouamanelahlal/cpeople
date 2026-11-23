<#ftl output_format="HTML">
<#--
  The CPeople password-reset e-mail.

  Wording comes from messages/messages_{en,fr}.properties, so it reads the same way
  as the sign-in pages and is translated alongside them. Styles are inline because
  mail clients drop stylesheets, and the ConSAP colours are repeated here for the
  same reason — a mail client cannot reach packages/ui.
-->
<html>
<body style="margin:0;padding:0;background:#F0F0F0;font-family:'Montserrat',Arial,Helvetica,sans-serif;color:#4E566B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F0F0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E3E7EE;border-radius:16px;padding:32px">
          <tr>
            <td style="font-size:22px;font-weight:300;color:#0F1937;padding-bottom:8px">
              CPeople
            </td>
          </tr>
          <tr>
            <td style="font-size:15px;line-height:1.6;padding-bottom:24px">
              ${msg("passwordResetBodyHtml", link, linkExpiration, realmName, linkExpirationFormatter(linkExpiration))?no_esc}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:8px">
              <a href="${link}" style="display:inline-block;background:#0E7BB0;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:12px">
                ${msg("passwordResetSubject")}
              </a>
            </td>
          </tr>
          <tr>
            <td style="font-size:12px;line-height:1.6;color:#4E566B;padding-top:24px;border-top:1px solid #E3E7EE">
              CPeople by ConSAP
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
